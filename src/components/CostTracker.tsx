import React, { useState, useRef } from "react";
import { Expense } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { 
  PlusCircle, FolderClosed, DollarSign, Upload, Trash2, 
  HelpCircle, Download, FileSpreadsheet, AlertCircle, CheckCircle, 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, X, Calendar, Settings 
} from "lucide-react";

interface CostTrackerProps {
  userId: string;
  expenses: Expense[];
  workingDaysMap: Record<string, number>;
}

export default function CostTracker({ userId, expenses, workingDaysMap }: CostTrackerProps) {
  // Navigation grid filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Expense>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Manual Add Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<'Salaries' | 'Marketing Ads' | 'Software Subscriptions' | 'Operations' | 'Other'>("Operations");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));

  // Operational Metadata config states
  const [configYearMonth, setConfigYearMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [configWorkingDays, setConfigWorkingDays] = useState("22");

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [metadataSubmitting, setMetadataSubmitting] = useState(false);

  // CSV elements upload references
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual submit handler
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    if (!description || !amount || !date) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    const expAmount = parseFloat(amount);
    if (isNaN(expAmount) || expAmount <= 0) {
      setError("Expense amount must be a positive number.");
      setSubmitting(false);
      return;
    }

    const id = "exp_" + Math.random().toString(36).substring(2, 11);
    const path = `users/${userId}/expenses/${id}`;

    try {
      const docRef = doc(db, "users", userId, "expenses", id);
      await setDoc(docRef, {
        id,
        userId,
        category,
        description,
        amount: expAmount,
        date,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess("Operational cost recorded successfully!");
      setIsModalOpen(false);
      // Reset
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().substring(0, 10));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete matching expense
  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this expense record? This will alter active Profit and Loss calculations.")) return;
    setError(null);
    setSuccess(null);
    const path = `users/${userId}/expenses/${id}`;

    try {
      await deleteDoc(doc(db, "users", userId, "expenses", id));
      setSuccess("Expense entry deleted successfully.");
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Metadata configure selector: input total working days for efficiency indexes
  const handleSaveWorkingDays = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setMetadataSubmitting(true);

    const workingDaysCount = parseInt(configWorkingDays);
    if (isNaN(workingDaysCount) || workingDaysCount < 1 || workingDaysCount > 31) {
      setError("Working days must be a valid number between 1 and 31.");
      setMetadataSubmitting(false);
      return;
    }

    const path = `users/${userId}/workingDays/${configYearMonth}`;

    try {
      const docRef = doc(db, "users", userId, "workingDays", configYearMonth);
      await setDoc(docRef, {
        monthYear: configYearMonth,
        workingDays: workingDaysCount,
        updatedAt: serverTimestamp()
      });

      setSuccess(`Saved metadata! Set ${workingDaysCount} working days for ${configYearMonth}.`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setMetadataSubmitting(false);
    }
  };

  // Drag and Drop CSV Handlers
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
      processExpenseCSV(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processExpenseCSV(e.target.files[0]);
    }
  };

  const processExpenseCSV = (file: File) => {
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
          setError("Empty file provided.");
          return;
        }

        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          setError("CSV file should contain headers and data rows.");
          return;
        }

        const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());

        let categoryIdx = rawHeaders.findIndex(h => h.includes("category"));
        let descIdx = rawHeaders.findIndex(h => h.includes("description") || h.includes("detail"));
        let amtIdx = rawHeaders.findIndex(h => h.includes("amount") || h.includes("value") || h.includes("cost"));
        let dateIdx = rawHeaders.findIndex(h => h.includes("date"));

        if (categoryIdx === -1) categoryIdx = 0;
        if (descIdx === -1) descIdx = 1;
        if (amtIdx === -1) amtIdx = 2;
        if (dateIdx === -1) dateIdx = 3;

        let addedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // comma escape logic
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

          if (parts.length < 3) {
            skippedCount++;
            continue;
          }

          let expCategory = (parts[categoryIdx]?.replace(/^["']|["']$/g, "") || "Operations") as any;
          if (!["Salaries", "Marketing Ads", "Software Subscriptions", "Operations", "Other"].includes(expCategory)) {
            expCategory = "Other";
          }

          const rawAmt = parts[amtIdx];
          const amountValue = Math.max(0.01, parseFloat((rawAmt || "0").replace(/[^0-9.]/g, "")));
          if (isNaN(amountValue)) {
            skippedCount++;
            continue;
          }

          const desc = (parts[descIdx] || "CSV expense record").replace(/^["']|["']$/g, "");
          
          let expDate = parts[dateIdx]?.replace(/^["']|["']$/g, "") || "";
          if (!expDate || expDate.length < 8) expDate = new Date().toISOString().substring(0, 10);

          const eId = `csv_exp_${Math.random().toString(36).substring(2, 11)}`;
          const docRef = doc(db, "users", userId, "expenses", eId);

          await setDoc(docRef, {
            id: eId,
            userId,
            category: expCategory,
            description: desc,
            amount: amountValue,
            date: expDate,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          addedCount++;
        }

        setSuccess(`Bulk Upload Completed! Successfully imported ${addedCount} industrial expenses.${skippedCount > 0 ? ` Skipped ${skippedCount} items.` : ""}`);
      } catch (err: any) {
        console.error("Bulk expense failure:", err);
        setError("Failed to parse CSV expenses folder correctly.");
      }
    };
    reader.readAsText(file);
  };

  const downloadExpenseTemplate = () => {
    const csvContent = 
      "Expense Category,Description,Amount,Date of Expense\n" +
      "Salaries,June payroll sales team,22000,2026-06-01\n" +
      "Marketing Ads,Q2 Google AdWords campaign,4500,2026-06-02\n" +
      "Software Subscriptions,Salesforce corporate suite license,1200,2026-06-05\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "corporate_expenses_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Grid Controls
  const handleSort = (field: keyof Expense) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredExpenses = expenses.filter(e => {
    const term = searchTerm.toLowerCase();
    return (
      e.category.toLowerCase().includes(term) ||
      e.description.toLowerCase().includes(term)
    );
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    } else {
      return sortOrder === "asc"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }
  });

  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = sortedExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            Cost & Expense Management
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Log overhead, vendor invoices, operational billing, and monitor monthly margins.
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.35)] shrink-0 cursor-pointer"
        >
          <PlusCircle className="h-4.5 w-4.5" /> Log Custom Cost
        </button>
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

      {/* Configurations & Bulk Ingestion layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Working Days Operational Configuration Selector */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-[#1e293b] pb-2 font-mono">
            <Calendar className="h-4.5 w-4.5 text-blue-400" /> Operational Working Days
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed font-sans">
            Enter the exact working days count for any month to compute efficiency, burn rates, and P&L indicators correctly.
          </p>

          <form onSubmit={handleSaveWorkingDays} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-10px font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Period</label>
                <input
                  type="month"
                  value={configYearMonth}
                  onChange={(e) => {
                    setConfigYearMonth(e.target.value);
                    const saved = workingDaysMap[e.target.value];
                    if (saved) setConfigWorkingDays(saved.toString());
                  }}
                  className="w-full px-2.5 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-10px font-semibold text-slate-500 uppercase tracking-wider mb-1">Working Days</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={configWorkingDays}
                  onChange={(e) => setConfigWorkingDays(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold font-mono"
                  placeholder="22"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={metadataSubmitting}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg border border-[#1e293b] hover:border-blue-500 bg-[#020617] text-slate-300 hover:text-white text-xs font-semibold hover:bg-[#1e293b]/40 transition-all duration-150 cursor-pointer"
            >
              <Settings className="h-4 w-4" /> Save Monthly Settings
            </button>
          </form>

          {workingDaysMap[configYearMonth] && (
            <div className="text-[10px] font-semibold bg-[#020617] border border-[#1e293b] rounded-lg p-2.5 text-slate-400 text-center font-mono">
              Active setting: <strong>{workingDaysMap[configYearMonth]} days</strong> configured for {configYearMonth}
            </div>
          )}
        </div>

        {/* CSV Cost Uploader */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <FileSpreadsheet className="h-4.5 w-4.5 text-blue-400" /> Bulk Cost Ingestion
              </h3>
              <button 
                onClick={downloadExpenseTemplate}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                title="Download Expense template"
              >
                <Download className="h-3 w-3" /> Template
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
              Import organizational overheads (salaries, ads, vendor payouts) in bulk using standard spreadsheet CSV folders.
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
                ? "border-blue-500 bg-blue-950/30 text-blue-400 animate-pulse"
                : "border-[#1e293b] bg-[#020617] hover:bg-[#1e293b]/30 text-slate-400 hover:border-blue-500/65"
            }`}
          >
            <Upload className="h-7 w-7 text-blue-400 mb-2" />
            <p className="text-xs font-semibold text-slate-200">Drag & Drop Expense CSV</p>
            <p className="text-[10px] text-slate-500 mt-0.5">or click to browse local folders</p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </div>

        {/* Search & Ledgers list */}
        <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] p-5 bento-card space-y-4 lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-white text-base">Cost Ledger</h3>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search costs..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 search-glow"
              />
            </div>
          </div>

          {/* Grid presentation */}
          <div className="overflow-x-auto rounded-xl border border-[#1e293b] bg-[#020617]/50">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#020617] text-slate-400 font-semibold border-b border-[#1e293b] font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th onClick={() => handleSort("category")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors">
                    <span className="flex items-center gap-1">Category <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("description")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors">
                    <span className="flex items-center gap-1">Description <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("amount")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors text-right">
                    <span className="flex items-center gap-1 justify-end">Amount <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th onClick={() => handleSort("date")} className="p-3 cursor-pointer hover:bg-[#1e293b]/70 transition-colors">
                    <span className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3 text-blue-500" /></span>
                  </th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b] text-slate-300">
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No matching overhead costs resolved.
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-[#1e293b]/30 transition-colors">
                      <td className="p-3 font-semibold text-slate-100 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                          exp.category === "Salaries"
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                            : exp.category === "Marketing Ads"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : exp.category === "Software Subscriptions"
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                            : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        }`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs truncate" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="p-3 text-right text-rose-450 font-semibold font-mono">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-400 font-mono">
                        {exp.date}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all inline-flex cursor-pointer"
                          title="Delete expense entry"
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

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-[#1e293b] pt-3">
            <span className="text-[11px] text-slate-400 font-mono">
              Showing page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredExpenses.length} overhead entries)
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

      {/* Log Custom Cost modal dialog overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#020617]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#1e293b] animate-in fade-in zoom-in-95 duration-150 text-slate-100">
            <div className="flex items-center justify-between px-6 py-4 bg-[#020617] border-b border-[#1e293b]">
              <h3 className="font-bold text-white text-base">Record Operational Cost</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#1e293b] transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cost Classification *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Salaries">Salaries</option>
                  <option value="Marketing Ads">Marketing Ads</option>
                  <option value="Software Subscriptions">Software Subscriptions</option>
                  <option value="Operations">Operations</option>
                  <option value="Other">Other Category</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Particulars *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. AWS server cloud hosting invoices"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Invoice Amount (USD) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold font-mono"
                      placeholder="450"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Billing Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
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
                  {submitting ? "Logging..." : "Create Cost Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
