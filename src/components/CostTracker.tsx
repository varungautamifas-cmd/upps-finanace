// Imports
import React, { useState, useRef } from "react";
import { Expense } from "../types";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { 
  PlusCircle, FolderClosed, DollarSign, Upload, Trash2, 
  HelpCircle, Download, FileSpreadsheet, AlertCircle, CheckCircle, 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, X, Calendar, Settings 
} from "lucide-react";
import ExpenseEntryModule from "./ExpenseEntryModule";

interface CostTrackerProps {
  userId: string;
  expenses: Expense[];
  workingDaysMap: Record<string, number>;
  isAdmin: boolean;
}

export default function CostTracker({ userId, expenses, workingDaysMap, isAdmin }: CostTrackerProps) {
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
  const [metadataSubmitting, setMetadataSubmitting] = useState(false);

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

      setSuccess(`Saved metadata! Set ₹{workingDaysCount} working days for ₹{configYearMonth}.`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setMetadataSubmitting(false);
    }
  };

  // Delete matching expense
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
      currency: "INR",
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

        <div className="lg:col-span-2">
          <ExpenseEntryModule userId={userId} />
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ₹{
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
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all inline-flex cursor-pointer"
                            title="Delete expense entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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

    </div>
  );
}
