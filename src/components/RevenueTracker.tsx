import React, { useState, useRef, useEffect } from "react";
import { RevenueClosure } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, doc, setDoc, serverTimestamp, deleteDoc, getDoc } from "firebase/firestore";
import { 
  TrendingUp, Search, PlusCircle, ArrowUpDown, ChevronLeft, 
  ChevronRight, ArrowUpRight, Upload, AlertCircle, CheckCircle, 
  Trash2, X, Download, HelpCircle, FileSpreadsheet 
} from "lucide-react";

interface RevenueTrackerProps {
  userId: string;
  revenueClosures: RevenueClosure[];
}

export default function RevenueTracker({ userId, revenueClosures }: RevenueTrackerProps) {
  // Navigation grid controllers
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof RevenueClosure>("closureDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Add closure modal controllers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [packageDetails, setPackageDetails] = useState("");
  const [packageCost, setPackageCost] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [cashPaid, setCashPaid] = useState("");
  const [nextInstallmentDate, setNextInstallmentDate] = useState("");
  const [paymentType, setPaymentType] = useState<'EMI' | 'EQI' | 'ESAI' | 'Full Payment'>("Full Payment");
  const [closureDate, setClosureDate] = useState(new Date().toISOString().substring(0, 10));

  // Notification feedbacks
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // File CSV drag states
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Config Default Tax
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId, "config", "tax"));
        if (snap.exists() && snap.data().defaultTaxRate !== undefined) {
          setDefaultTaxRate(Number(snap.data().defaultTaxRate));
        }
      } catch (err) {
        console.error("Failed to fetch tax rate:", err);
      }
    };
    fetchConfig();
  }, [userId]);

  // Handle addition of custom elements
  const handleAddClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (!customerName || !customerEmail || !packageDetails || !packageCost || !taxAmount || !cashPaid || !nextInstallmentDate || !closureDate) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    const pCost = parseFloat(packageCost);
    const tAmt = parseFloat(taxAmount);
    const cPaid = parseFloat(cashPaid);

    if (isNaN(pCost) || pCost < 0 || isNaN(tAmt) || tAmt < 0 || isNaN(cPaid) || cPaid < 0) {
      setError("Valid dynamic non-negative monetary numbers must be supplied.");
      setSubmitting(false);
      return;
    }

    const remaining = (pCost + tAmt) - cPaid;
    const path = `users/${userId}/revenueClosures`;
    const closureId = "rev_" + Math.random().toString(36).substring(2, 11);

    try {
      const docRef = doc(db, "users", userId, "revenueClosures", closureId);
      const newClosure: RevenueClosure = {
        id: closureId,
        userId,
        customerName,
        customerEmail,
        packageDetails,
        packageCost: pCost,
        taxAmount: tAmt,
        cashPaid: cPaid,
        remainingAmount: remaining,
        nextInstallmentDate,
        paymentType,
        closureDate,
        createdAt: new Date(), // Local fallback, serverTimestamp works inside rule time validations
        updatedAt: new Date(),
      };

      // Write document matching exactly with schema structure & validation helpers
      await setDoc(docRef, {
        ...newClosure,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess("Client sales closure registered successfully!");
      setIsModalOpen(false);
      // Reset
      setCustomerName("");
      setCustomerEmail("");
      setPackageDetails("");
      setPackageCost("");
      setTaxAmount("");
      setCashPaid("");
      setNextInstallmentDate("");
      setPaymentType("Full Payment");
      setClosureDate(new Date().toISOString().substring(0, 10));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete matching element
  const handleDeleteClosure = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this revenue closure record? This action cannot be undone.")) return;
    setError(null);
    setSuccess(null);
    const path = `users/${userId}/revenueClosures/${id}`;

    try {
      await deleteDoc(doc(db, "users", userId, "revenueClosures", id));
      setSuccess("Revenue closure deleted successfully.");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // CSV Drag and drop / Manual file selection handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  // Pure JavaScript parsing without requiring heavy mapping plugins
  const processCSVFile = (file: File) => {
    setError(null);
    setSuccess(null);

    if (!file.name.endsWith(".csv")) {
      setError("Please upload a valid .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          setError("Empty file supplied.");
          return;
        }

        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          setError("CSV file should have a header row and at least one data row.");
          return;
        }

        // Standardise Headers: match common terms
        const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
        
        let customerNameIdx = rawHeaders.findIndex(h => h.includes("customer") && h.includes("name"));
        let customerEmailIdx = rawHeaders.findIndex(h => h.includes("email"));
        let packageDetailsIdx = rawHeaders.findIndex(h => h.includes("package") && h.includes("detail"));
        let pCostIdx = rawHeaders.findIndex(h => h.includes("cost") || h.includes("value"));
        let tAmtIdx = rawHeaders.findIndex(h => h.includes("tax") || h.includes("gst"));
        let cPaidIdx = rawHeaders.findIndex(h => h.includes("paid") || h.includes("cash"));
        let nextDateIdx = rawHeaders.findIndex(h => h.includes("next") || h.includes("installment"));
        let payTypeIdx = rawHeaders.findIndex(h => h.includes("type") || h.includes("payment"));
        let dateIdx = rawHeaders.findIndex(h => h.includes("date") || h.includes("closure"));

        // Fallback defaults if indexes not found to enforce safety
        if (customerNameIdx === -1) customerNameIdx = 0;
        if (customerEmailIdx === -1) customerEmailIdx = 1;
        if (packageDetailsIdx === -1) packageDetailsIdx = 2;
        if (pCostIdx === -1) pCostIdx = 3;
        if (tAmtIdx === -1) tAmtIdx = 4;
        if (cPaidIdx === -1) cPaidIdx = 5;
        if (nextDateIdx === -1) nextDateIdx = 6;
        if (payTypeIdx === -1) payTypeIdx = 7;
        if (dateIdx === -1) dateIdx = 8;

        let addedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple CSV splitter accommodating escaped commas within text
          const parts: string[] = [];
          let currentPart = "";
          let insideQuotes = false;
          
          for (let charIndex = 0; charIndex < line.length; charIndex++) {
            const char = line[charIndex];
            if (char === '"' || char === "'") {
              insideQuotes = !insideQuotes;
            } else if (char === "," && !insideQuotes) {
              parts.push(currentPart.trim());
              currentPart = "";
            } else {
              currentPart += char;
            }
          }
          parts.push(currentPart.trim());

          if (parts.length < 5) {
            skippedCount++;
            continue;
          }

          const rawCost = parts[pCostIdx];
          const rawTax = parts[tAmtIdx];
          const rawPaid = parts[cPaidIdx];

          const pCost = Math.max(0, parseFloat((rawCost || "0").replace(/[^0-9.]/g, "")));
          const tAmt = Math.max(0, parseFloat((rawTax || "0").replace(/[^0-9.]/g, "")));
          const cPaid = Math.max(0, parseFloat((rawPaid || "0").replace(/[^0-9.]/g, "")));

          const customer = (parts[customerNameIdx] || "CSV Client").replace(/^["']|["']$/g, "");
          const email = (parts[customerEmailIdx] || "client@company.org").replace(/^["']|["']$/g, "");
          const details = (parts[packageDetailsIdx] || "Legacy Contract").replace(/^["']|["']$/g, "");
          
          let instDate = parts[nextDateIdx]?.replace(/^["']|["']$/g, "") || "";
          if (!instDate || instDate.length < 8) instDate = new Date(Date.now() + 30*24*60*60*1000).toISOString().substring(0, 10);
          
          let pType = (parts[payTypeIdx]?.replace(/^["']|["']$/g, "") || "Full Payment") as any;
          if (!["EMI", "EQI", "ESAI", "Full Payment"].includes(pType)) {
            pType = "Full Payment";
          }

          let clDate = parts[dateIdx]?.replace(/^["']|["']$/g, "") || "";
          if (!clDate || clDate.length < 8) clDate = new Date().toISOString().substring(0, 10);

          const cId = `csv_${Math.random().toString(36).substring(2, 11)}`;
          const cRef = doc(db, "users", userId, "revenueClosures", cId);

          await setDoc(cRef, {
            id: cId,
            userId,
            customerName: customer,
            customerEmail: email,
            packageDetails: details,
            packageCost: pCost,
            taxAmount: tAmt,
            cashPaid: cPaid,
            remainingAmount: (pCost + tAmt) - cPaid,
            nextInstallmentDate: instDate,
            paymentType: pType,
            closureDate: clDate,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          addedCount++;
        }

        setSuccess(`Bulk Ingestion Finished! Successfully imported ${addedCount} closures.${skippedCount > 0 ? ` Skipped ${skippedCount} bad rows.` : ""}`);
      } catch (err: any) {
        console.error("CSV Import error:", err);
        setError("Error processing files. Ensure columns match customer name, email, package cost, cash paid, etc.");
      }
    };
    reader.readAsText(file);
  };

  // Download Sample CSV Helper
  const downloadSampleCSV = () => {
    const csvContent = 
      "Customer Name,Customer Email,Package Details,Package Cost,Tax GST Amount,Cash Paid,Next Installment Date,Payment Type,Closure Date\n" +
      "Acme Corp,contact@acme.com,Standard Enterprise Enterprise Licence,12500,2250,5000,2026-07-05,EMI,2026-06-01\n" +
      "Beta Systems,billing@betasys.io,Fasttrack Engineering Suite,8000,1440,8000,2026-06-15,Full Payment,2026-06-02\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_closures_sample.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sort and Search Filtering Logic
  const handleSort = (field: keyof RevenueClosure) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredItems = revenueClosures.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      c.customerName.toLowerCase().includes(term) ||
      c.customerEmail.toLowerCase().includes(term) ||
      c.packageDetails.toLowerCase().includes(term) ||
      c.paymentType.toLowerCase().includes(term)
    );
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc" 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      // numeric type parsing
      return sortOrder === "asc"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }
  });

  // Paginated selection
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;
  const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 font-sans bg-[#020617] text-slate-100 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Client Sales Closures
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Log, analyze, and manage customer contracts and outstanding dues.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.35)] shrink-0 cursor-pointer"
          >
            <PlusCircle className="h-4.5 w-4.5" /> Log Custom Closure
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {error && (
        <div className="bg-red-950/40 p-4 border border-red-900/50 rounded-xl flex items-start gap-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-blue-950/40 p-4 border border-blue-900/50 rounded-xl flex items-start gap-3 text-sm text-blue-200">
          <CheckCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* CSV Ingestion Box & Drag-and-Drop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CSV Ingestion Interface */}
        <div className="lg:col-span-1 bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <FileSpreadsheet className="h-4.5 w-4.5 text-blue-400" /> Bulk CSV Ingestion
              </h3>
              <button 
                onClick={downloadSampleCSV}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                title="Download Sample CSV Template"
              >
                <Download className="h-3 w-3" /> Template
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
              Drastically speed up logging by uploading a CSV of closures. Subscriptions, recurring packages, or bulk sales.
            </p>
          </div>

          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all min-h-32 ${
              dragActive 
                ? "border-blue-500 bg-blue-950/30 text-blue-400"
                : "border-[#1e293b] bg-[#020617] hover:bg-[#1e293b]/30 text-slate-400 hover:border-blue-500/65"
            }`}
          >
            <Upload className="h-7 w-7 text-blue-400 mb-2" />
            <p className="text-xs font-semibold text-slate-200">Drag & Drop CSV</p>
            <p className="text-[10px] text-slate-500 mt-0.5">or click to browse filesystem</p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </div>

        {/* Database Search & Core Grid */}
        <div className="lg:col-span-2 bg-[#0f172a] rounded-2xl border border-[#1e293b] p-5 bento-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-white text-base">Closure Ledger</h3>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-550 search-glow"
              />
            </div>
          </div>

          {/* Grid Layout Data Desk */}
          <div className="overflow-x-auto rounded-xl border border-[#1e293b] bg-[#020617]/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#020617] text-slate-400 font-semibold border-b border-[#1e293b] font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th onClick={() => handleSort("customerName")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors">
                    <span className="flex items-center gap-1">Client Name <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("packageCost")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors text-right">
                    <span className="flex items-center gap-1 justify-end">Package Cost <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("cashPaid")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors text-right">
                    <span className="flex items-center gap-1 justify-end">Paid till Date <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("remainingAmount")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors text-right">
                    <span className="flex items-center gap-1 justify-end">Outstanding <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("paymentType")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors">
                    <span className="flex items-center gap-1">Method <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("closureDate")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors">
                    <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b] text-slate-300">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No matching sales closures located.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((closure) => (
                    <tr key={closure.id} className="hover:bg-[#1e293b]/30 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-slate-100">{closure.customerName}</div>
                        <div className="text-[10px] text-slate-500 leading-none mt-1 font-mono">{closure.customerEmail}</div>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-100 font-mono">
                        {formatCurrency(closure.packageCost)}
                      </td>
                      <td className="p-3 text-right text-blue-400 font-semibold font-mono">
                        {formatCurrency(closure.cashPaid)}
                      </td>
                      <td className={`p-3 text-right font-medium font-mono ${closure.remainingAmount > 0 ? "text-amber-400" : "text-slate-500"}`}>
                        {formatCurrency(closure.remainingAmount)}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                          closure.paymentType === "Full Payment" 
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : closure.paymentType === "EMI"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        }`}>
                          {closure.paymentType}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-400 font-mono">
                        {closure.closureDate}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteClosure(closure.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all inline-flex cursor-pointer"
                          title="Delete closure record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Navigation */}
          <div className="flex items-center justify-between border-t border-[#1e293b] pt-3">
            <span className="text-[11px] text-slate-400 font-mono">
              Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredItems.length} closures)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-[#1e293b] bg-[#020617] text-slate-300 hover:bg-[#1e293b] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-[#1e293b] bg-[#020617] text-slate-300 hover:bg-[#1e293b] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Add Closure Modal overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#020617]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-[#1e293b] animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between px-6 py-4 bg-[#020617] border-b border-[#1e293b]">
              <h3 className="font-bold text-white text-base">Log Customer Sales Closure</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#1e293b] transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddClosure} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Sterling LLC"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Customer Email *</label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="contact@customer.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Package / Product Details *</label>
                <input
                  type="text"
                  required
                  value={packageDetails}
                  onChange={(e) => setPackageDetails(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Software license + onboarding service block"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Package Cost (USD) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={packageCost}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPackageCost(val);
                      if (val && defaultTaxRate > 0) {
                        setTaxAmount((parseFloat(val) * (defaultTaxRate / 100)).toFixed(2));
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold font-mono"
                    placeholder="10000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tax/GST (USD) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-400 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="1800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cash Paid (USD) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={cashPaid}
                    onChange={(e) => setCashPaid(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-blue-400 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold font-mono"
                    placeholder="6000"
                  />
                </div>
              </div>

              {/* Dynamic Auto-calculated output feedback within modal */}
              {packageCost && cashPaid && (
                <div className="bg-[#020617] p-2.5 rounded-lg border border-[#1e293b] flex justify-between items-center text-xs text-slate-400">
                  <span>Calculated remaining outstanding dues:</span>
                  <strong className="text-sm font-bold text-amber-400 font-mono">
                    {formatCurrency(parseFloat(packageCost) + (parseFloat(taxAmount) || 0) - parseFloat(cashPaid))}
                  </strong>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Plan *</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Full Payment">Full Payment</option>
                    <option value="EMI">EMI</option>
                    <option value="EQI">EQI</option>
                    <option value="ESAI">ESAI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Installment Date *</label>
                  <input
                    type="date"
                    required
                    value={nextInstallmentDate}
                    onChange={(e) => setNextInstallmentDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Closure Date *</label>
                  <input
                    type="date"
                    required
                    value={closureDate}
                    onChange={(e) => setClosureDate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#1e293b] pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-1.5 px-4 rounded-lg text-slate-400 hover:bg-[#1e293b] hover:text-slate-200 transition-all text-xs font-semibold border border-[#1e293b] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-1.5 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Logging..." : "Create Closure Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
