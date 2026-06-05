import React, { useState, useRef } from "react";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { 
  FileSpreadsheet, Upload, Download, CheckCircle, AlertCircle, 
  Settings, Building, ListPlus, Camera, Trash2, X
} from "lucide-react";

interface ExpenseEntryModuleProps {
  userId: string;
}

export default function ExpenseEntryModule({ userId }: ExpenseEntryModuleProps) {
  const [activeTab, setActiveTab] = useState<'marketing' | 'salary' | 'infrastructure' | 'miscellaneous'>('marketing');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual States
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [expenseName, setExpenseName] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [amount, setAmount] = useState("");
  const [paidThrough, setPaidThrough] = useState("");
  const [receiptImage, setReceiptImage] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await resizeImage(e.target.files[0]);
        setReceiptImage(base64);
      } catch (err) {
        console.error(err);
        setError("Error parsing image.");
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!expenseName || !amount || !date) {
      setError("Please fill in required fields.");
      setLoading(false);
      return;
    }

    const expAmount = parseFloat(amount);
    if (isNaN(expAmount) || expAmount <= 0) {
      setError("Invalid amount.");
      setLoading(false);
      return;
    }

    const category = activeTab === 'infrastructure' ? 'Infrastructure' : 'Miscellaneous';

    const id = "exp_" + Math.random().toString(36).substring(2, 11);
    try {
      await setDoc(doc(db, "users", userId, "expenses", id), {
        id,
        userId,
        category,
        description: expenseName,
        type: expenseType,
        amount: expAmount,
        date,
        paidThrough: paidThrough,
        receiptImage: receiptImage || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess(`${category} expense recorded.`);
      setExpenseName("");
      setExpenseType("");
      setAmount("");
      setPaidThrough("");
      setReceiptImage("");
      setDate(new Date().toISOString().substring(0, 10));
    } catch (err) {
      console.error(err);
      setError("Failed to add record.");
    } finally {
      setLoading(false);
    }
  };

  // CSV processing
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSV(e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processCSV = (file: File) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!file.name.endsWith(".csv")) {
      setError("Please upload a .csv file.");
      setLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file.");
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) throw new Error("Missing data rows.");

        const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());

        let addedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const parts: string[] = [];
          let currentPart = "";
          let insideQuotes = false;
          for (let charIndex = 0; charIndex < lines[i].length; charIndex++) {
            const char = lines[i][charIndex];
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

          const cleanPart = (idx: number) => (parts[idx] || "").replace(/^["']|["']$/g, "");
          const id = `exp_csv_${Math.random().toString(36).substring(2, 11)}`;
          const docRef = doc(db, "users", userId, "expenses", id);

          if (activeTab === 'marketing') {
            // Marketing columns: Date, Transaction ID, Transaction Description, Payment Method, Amount, Currency
            let pDate = cleanPart(0);
            if (!pDate) pDate = new Date().toISOString().substring(0, 10);
            
            const amtStr = cleanPart(4);
            const pAmount = Math.max(0.01, parseFloat(amtStr.replace(/[^0-9.]/g, "")));
            if (isNaN(pAmount)) continue;

            await setDoc(docRef, {
              id, userId,
              category: 'Marketing Ads',
              date: pDate,
              transactionId: cleanPart(1),
              description: cleanPart(2) || "Marketing CSV",
              paymentMethod: cleanPart(3),
              amount: pAmount,
              currency: cleanPart(5),
              createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            addedCount++;
          } else if (activeTab === 'salary') {
            // Salary columns: Name of employee, Designation, Employment type, Monthly Salary, Days Worked, Salary given, Paid Through
            const empName = cleanPart(0);
            const desg = cleanPart(1);
            const empType = cleanPart(2);
            const monthSal = parseFloat(cleanPart(3).replace(/[^0-9.]/g, "")) || 0;
            const daysW = parseFloat(cleanPart(4).replace(/[^0-9.]/g, "")) || 0;
            const salGivenStr = cleanPart(5);
            const sGiven = Math.max(0.01, parseFloat(salGivenStr.replace(/[^0-9.]/g, "")));
            const pThrough = cleanPart(6);

            if (isNaN(sGiven)) continue;
            
            await setDoc(docRef, {
              id, userId,
              category: 'Salaries',
              date: new Date().toISOString().substring(0, 10),
              employeeName: empName,
              designation: desg,
              employmentType: empType,
              monthlySalary: monthSal,
              daysWorked: daysW,
              amount: sGiven,
              paidThrough: pThrough,
              description: `Salary: ₹{empName} (₹{empType})`,
              createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            addedCount++;
          }
        }
        setSuccess(`Successfully imported ₹{addedCount} records.`);
      } catch (err: any) {
        console.error(err);
        setError("Error parsing CSV. Please ensure column structure matches.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const getMarketingTemplate = () => {
    const csvContent = 
      "Date,Transaction ID,Transaction Description,Payment Method,Amount,Currency\n" +
      "2026-06-05,TXN-101,Google Search Ads,Corporate Card,2500,INR\n";
    download(csvContent, "marketing_template.csv");
  }

  const getSalaryTemplate = () => {
    const csvContent = 
      "Name of employee,Designation,Employment type,Monthly Salary,Days Worked,Salary given,Paid Through\n" +
      "John Doe,Senior Engineer,Full Time,8000,22,8000,Bank Transfer\n";
    download(csvContent, "salary_template.csv");
  }

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-[#1e293b] bento-card overflow-hidden">
      <div className="border-b border-[#1e293b] bg-[#020617]">
        <div className="flex overflow-x-auto px-2">
          <button 
            onClick={() => { setActiveTab('marketing'); setError(null); setSuccess(null); }}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ₹{activeTab === 'marketing' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Marketing (CSV)
          </button>
          <button 
            onClick={() => { setActiveTab('salary'); setError(null); setSuccess(null); }}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ₹{activeTab === 'salary' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Salary (CSV)
          </button>
          <button 
            onClick={() => { setActiveTab('infrastructure'); setError(null); setSuccess(null); }}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ₹{activeTab === 'infrastructure' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Building className="h-4 w-4" /> Infrastructure (Manual)
          </button>
          <button 
            onClick={() => { setActiveTab('miscellaneous'); setError(null); setSuccess(null); }}
            className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ₹{activeTab === 'miscellaneous' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <ListPlus className="h-4 w-4" /> Miscellaneous (Manual)
          </button>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-950/40 p-3 border border-red-900/50 rounded-xl flex items-start gap-3 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-emerald-950/40 p-3 border border-emerald-900/50 rounded-xl flex items-start gap-3 text-xs text-emerald-200">
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {(activeTab === 'marketing' || activeTab === 'salary') ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-slate-200">Bulk Upload {activeTab === 'marketing' ? 'Marketing' : 'Salaries'}</h4>
                <p className="text-xs text-slate-400">Please prepare a CSV matching the required columns.</p>
              </div>
              <button onClick={activeTab === 'marketing' ? getMarketingTemplate : getSalaryTemplate} className="text-xs font-semibold px-3 py-1.5 border border-[#1e293b] bg-[#020617] rounded-lg text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer">
                <Download className="h-3.5 w-3.5" /> Template
              </button>
            </div>
            
            <div 
              onClick={() => !loading && fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ₹{loading ? 'opacity-50 border-[#1e293b]' : 'border-[#1e293b] hover:border-blue-500/50 hover:bg-[#1e293b]/20 text-slate-400'}`}
            >
              <Upload className="h-8 w-8 text-blue-500 mb-3" />
              <p className="text-sm font-semibold text-slate-200">{loading ? "Processing CSV..." : "Click to select CSV File"}</p>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <h4 className="text-sm font-bold text-slate-200 mb-4">{activeTab === 'infrastructure' ? 'Infrastructure Cost' : 'Miscellaneous Cost'}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date *</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Expense Name *</label>
                <input type="text" required value={expenseName} onChange={e => setExpenseName(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Office Rent" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Type</label>
                <input type="text" value={expenseType} onChange={e => setExpenseType(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Lease" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Amount *</label>
                <input type="number" step="0.01" min="0" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none font-mono" placeholder="1500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Paid Through</label>
                <input type="text" value={paidThrough} onChange={e => setPaidThrough(e.target.value)} className="w-full bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-emerald-500 outline-none" placeholder="e.g. Corporate Bank Account" />
              </div>
            </div>
            
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-400 mb-2">Receipt Image / Screenshot Upload</label>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="h-20 w-20 shrink-0 rounded-xl border border-dashed border-[#1e293b] bg-[#020617] hover:bg-[#1e293b]/50 text-slate-400 flex flex-col items-center justify-center transition-colors cursor-pointer">
                  <Camera className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-semibold">Upload</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                
                {receiptImage ? (
                  <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-[#1e293b]">
                    <img src={receiptImage} alt="Receipt preview" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setReceiptImage("")} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-sm cursor-pointer border border-white">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 leading-relaxed italic max-w-sm">No image attached. Uploading a screenshot is recommended for auditing infrastructure and misc outlays.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-6 border-t border-[#1e293b]">
               <button type="submit" disabled={loading} className="py-2 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer">
                 {loading ? "Saving..." : "Record Entry"}
               </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
