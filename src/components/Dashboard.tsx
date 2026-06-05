import React, { useState, useEffect } from "react";
import { RevenueClosure, Expense, CustomChartPayload, PAndLStats } from "../types";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart 
} from "recharts";
import { 
  Sparkles, DollarSign, Calendar, TrendingUp, AlertCircle, 
  HelpCircle, Search, FileText, Landmark, Clock, RefreshCw, BarChart3, CheckCircle2 
} from "lucide-react";

interface DashboardProps {
  revenueClosures: RevenueClosure[];
  expenses: Expense[];
  workingDaysMap: Record<string, number>; // key: YYYY-MM
}

export default function Dashboard({ revenueClosures, expenses, workingDaysMap }: DashboardProps) {
  // Global Filters
  const [filterMode, setFilterMode] = useState<"All" | "MonthYear" | "Custom">("All");
  
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("All");

  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Query state
  const [naturalQuery, setNaturalQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [customChart, setCustomChart] = useState<CustomChartPayload | null>(null);

  // Auto-calculated stats
  const [stats, setStats] = useState<PAndLStats>({
    totalRevenue: 0,
    totalOutstanding: 0,
    totalCosts: 0,
    netProfitLossBeforeTax: 0,
    netProfitLossAfterTax: 0,
    dailyBurnRate: 0,
    totalWorkingDays: 22,
  });

  // Extract unique years and months from actual data to populate dropdowns dynamically
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  
  useEffect(() => {
    const years = new Set<string>();
    revenueClosures.forEach(c => {
      const yr = c.closureDate.substring(0, 4);
      if (yr) years.add(yr);
    });
    expenses.forEach(e => {
      const yr = e.date.substring(0, 4);
      if (yr) years.add(yr);
    });
    
    // Add current year if empty
    const cy = new Date().getFullYear().toString();
    years.add(cy);

    setAvailableYears(Array.from(years).sort().reverse());
  }, [revenueClosures, expenses]);

  // Utility to format values as currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  // Run filtering & P&L calculation whenever data or selectors change
  useEffect(() => {
    // Determine target month and year
    // Filter records
    const filteredClosures = revenueClosures.filter(c => {
      const expDate = c.closureDate;
      const yr = expDate.substring(0, 4);
      const mo = expDate.substring(5, 7);
      
      if (filterMode === "All") return true;
      if (filterMode === "Custom") {
        if (customStartDate && expDate < customStartDate) return false;
        if (customEndDate && expDate > customEndDate) return false;
        return true;
      }
      
      // MonthYear mode
      const yearMatch = yr === selectedYear;
      const monthMatch = selectedMonth === "All" || mo === selectedMonth;
      return yearMatch && monthMatch;
    });

    const filteredExpenses = expenses.filter(e => {
      const expDate = e.date;
      const yr = expDate.substring(0, 4);
      const mo = expDate.substring(5, 7);
      
      if (filterMode === "All") return true;
      if (filterMode === "Custom") {
        if (customStartDate && expDate < customStartDate) return false;
        if (customEndDate && expDate > customEndDate) return false;
        return true;
      }

      const yearMatch = yr === selectedYear;
      const monthMatch = selectedMonth === "All" || mo === selectedMonth;
      return yearMatch && monthMatch;
    });

    // 1. Total Revenue: Cash actually paid till date in closures
    const totalRev = filteredClosures.reduce((acc, curr) => acc + curr.cashPaid, 0);

    // 2. Total Outstanding: Remaining amount due in closures
    const totalOut = filteredClosures.reduce((acc, curr) => acc + curr.remainingAmount, 0);

    // 3. Total Costs: Expenses in period
    const totalCost = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    // 4. Net Profit before taxes
    const pnlBeforeTax = totalRev - totalCost;

    // 5. Net Profit post taxes (Tax/GST amount deducted)
    let totalTaxInFilters = 0;
    filteredClosures.forEach(curr => {
      const pCost = curr.packageCost || 0;
      const tAmt = curr.taxAmount || 0;
      const invoiceTotal = pCost + tAmt;
      if (invoiceTotal > 0 && tAmt > 0) {
        totalTaxInFilters += curr.cashPaid * (tAmt / invoiceTotal);
      }
    });
    
    const pnlAfterTax = totalRev - totalCost - totalTaxInFilters;

    // 6. Working Days & burn rate
    let workingDays = 22;
    if (filterMode === "MonthYear" && selectedMonth !== "All") {
      const key = `${selectedYear}-${selectedMonth}`;
      workingDays = workingDaysMap[key] || 22;
    } else if (filterMode === "MonthYear" && selectedMonth === "All") {
      let customSum = 0;
      let count = 0;
      for (let m = 1; m <= 12; m++) {
        const mm = m.toString().padStart(2, "0");
        const key = `${selectedYear}-${mm}`;
        if (workingDaysMap[key]) {
          customSum += workingDaysMap[key];
          count++;
        }
      }
      workingDays = customSum + (12 - count) * 22;
    } else if (filterMode === "Custom" && customStartDate && customEndDate) {
      // Rough approximation by diff days
      const d1 = new Date(customStartDate);
      const d2 = new Date(customEndDate);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      workingDays = Math.max(1, Math.floor(diffDays * (5/7))); // ~5 days out of 7
    } else {
      workingDays = 220; // Default generic multi-year factor
    }

    const burnRate = workingDays > 0 ? totalCost / workingDays : 0;

    setStats({
      totalRevenue: totalRev,
      totalOutstanding: totalOut,
      totalCosts: totalCost,
      netProfitLossBeforeTax: pnlBeforeTax,
      netProfitLossAfterTax: pnlAfterTax,
      dailyBurnRate: burnRate,
      totalWorkingDays: workingDays
    });
  }, [revenueClosures, expenses, filterMode, selectedYear, selectedMonth, customStartDate, customEndDate, workingDaysMap]);

  // Handle NLP query request to custom charting route
  const handleNLPQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalQuery.trim()) return;

    setQueryLoading(true);
    setQueryError(null);
    setCustomChart(null);

    try {
      const response = await fetch("/api/query-to-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: naturalQuery,
          revenueClosures,
          expenses
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process dynamic search query.");
      }

      const payload = await response.json();
      setCustomChart(payload);
    } catch (err: any) {
      console.error("NLP Chart retrieval failure:", err);
      setQueryError(err?.message || "An unexpected error occurred during AI parsing. Check your backend secrets.");
    } finally {
      setQueryLoading(false);
    }
  };

  // Pre-configured trend charts definitions based on current selectors
  // Month-on-Month Trends aggregator
  const getMoMTrendData = () => {
    const monthlyMap: Record<string, { name: string; revenue: number; expense: number }> = {};
    
    // Sort logic to order entries chronologically
    const targetClosures = [...revenueClosures].sort((a,b) => a.closureDate.localeCompare(b.closureDate));
    const targetExpenses = [...expenses].sort((a,b) => a.date.localeCompare(b.date));

    targetClosures.forEach(c => {
      const expDate = c.closureDate;
      const yr = expDate.substring(0, 4);
      
      if (filterMode === "MonthYear" && yr !== selectedYear) return;
      if (filterMode === "Custom") {
        if (customStartDate && expDate < customStartDate) return;
        if (customEndDate && expDate > customEndDate) return;
      }

      const monthName = expDate.substring(0, 7); // e.g., "2026-06"
      if (!monthlyMap[monthName]) {
        monthlyMap[monthName] = { name: monthName, revenue: 0, expense: 0 };
      }
      monthlyMap[monthName].revenue += c.cashPaid;
    });

    targetExpenses.forEach(e => {
      const expDate = e.date;
      const yr = expDate.substring(0, 4);

      if (filterMode === "MonthYear" && yr !== selectedYear) return;
      if (filterMode === "Custom") {
        if (customStartDate && expDate < customStartDate) return;
        if (customEndDate && expDate > customEndDate) return;
      }

      const monthName = expDate.substring(0, 7);
      if (!monthlyMap[monthName]) {
        monthlyMap[monthName] = { name: monthName, revenue: 0, expense: 0 };
      }
      monthlyMap[monthName].expense += e.amount;
    });

    return Object.values(monthlyMap).sort((a, b) => a.name.localeCompare(b.name)).slice(-12); // Limit to last 12 active months
  };

  // Payment Type percentage distribution
  const getPaymentDistributionData = () => {
    const distribution: Record<string, number> = {
      "EMI": 0,
      "EQI": 0,
      "ESAI": 0,
      "Full Payment": 0
    };

    revenueClosures.forEach(c => {
      const expDate = c.closureDate;
      const yr = expDate.substring(0, 4);
      const mo = expDate.substring(5, 7);
      
      if (filterMode === "MonthYear") {
        if (yr !== selectedYear) return;
        if (selectedMonth !== "All" && mo !== selectedMonth) return;
      }
      if (filterMode === "Custom") {
        if (customStartDate && expDate < customStartDate) return;
        if (customEndDate && expDate > customEndDate) return;
      }

      if (distribution[c.paymentType] !== undefined) {
        distribution[c.paymentType]++;
      }
    });

    const activeDistribution = Object.keys(distribution).map(key => ({
      name: key,
      value: distribution[key]
    })).filter(item => item.value > 0);

    return activeDistribution.length > 0 ? activeDistribution : [
      { name: "EMI", value: 0 },
      { name: "EQI", value: 0 },
      { name: "ESAI", value: 0 },
      { name: "Full Payment", value: 0 }
    ];
  };

  // Future Cash Flow projection chart: group remaining amount by next installment date
  const getCashFlowProjectionData = () => {
    const projectedMap: Record<string, number> = {};
    const todayStr = new Date().toISOString().substring(0, 10);

    revenueClosures.forEach(c => {
      // Future incoming milestones are entries with remainingAmount > 0 and nextInstallmentDate set
      if (c.remainingAmount > 0 && c.nextInstallmentDate) {
        const instDate = c.nextInstallmentDate.substring(0, 7); // Projecting by month: e.g., "2026-07"
        if (!projectedMap[instDate]) {
          projectedMap[instDate] = 0;
        }
        projectedMap[instDate] += c.remainingAmount;
      }
    });

    return Object.keys(projectedMap).map(key => ({
      name: key,
      value: projectedMap[key]
    })).sort((a,b) => a.name.localeCompare(b.name)).slice(0, 6); // next 6 months
  };

  // Color specs
  const momColorRev = "#3b82f6"; // Electric Blue
  const momColorCost = "#f43f5e"; // Rose
  const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#fb7185", "#10b981"];

  // Custom Chart Render Engine based on NLP response
  const renderCustomChartElement = () => {
    if (!customChart) return null;

    const { title, chartType, data, xAxisKey, series, explanation } = customChart;

    return (
      <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] shadow-2xl mt-6 transition-all duration-300 bento-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-2">
              <Sparkles className="h-3 w-3 animate-spin" /> AI Generated Visualization
            </span>
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
          </div>
          <button 
            onClick={() => setCustomChart(null)} 
            className="text-xs text-slate-400 hover:text-slate-200 border border-[#1e293b] px-2.5 py-1 bg-[#020617] rounded-lg transition-colors"
          >
            Clear Search Chart
          </button>
        </div>

        {data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-[#1e293b] rounded-xl">
            <BarChart3 className="h-8 w-8 mb-2 text-slate-600" />
            <p className="text-sm">No matching records found to render that dynamic chart.</p>
          </div>
        ) : (
          <>
            <div className="h-72 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey={xAxisKey} tickLine={false} style={{ fontSize: "12px", fill: "#94a3b8" }} />
                    <YAxis tickLine={false} style={{ fontSize: "12px", fill: "#94a3b8" }} tickFormatter={(tick) => formatCurrency(tick)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                    <Legend />
                    {series.map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />)}
                  </BarChart>
                ) : chartType === "pie" ? (
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label={({ name, percent }) => `${name}: ₹{(percent * 100).toFixed(0)}%`}>
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                    <Legend />
                  </PieChart>
                ) : chartType === "composed" ? (
                  <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey={xAxisKey} tickLine={false} style={{ fontSize: "12px", fill: "#94a3b8" }} />
                    <YAxis tickLine={false} style={{ fontSize: "12px", fill: "#94a3b8" }} tickFormatter={(tick) => formatCurrency(tick)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                    <Legend />
                    {series.filter(s => s.key === "revenue").map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />)}
                    {series.filter(s => s.key !== "revenue").map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 4 }} />)}
                  </ComposedChart>
                ) : (
                  // default to line chart
                  <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey={xAxisKey} tickLine={false} style={{ fontSize: "12px", fill: "#94a3b8" }} />
                    <YAxis tickLine={false} style={{ fontSize: "12px", fill: "#94a3b8" }} tickFormatter={(tick) => formatCurrency(tick)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                    <Legend />
                    {series.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} activeDot={{ r: 6 }} />)}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-[#020617] border border-[#1e293b] flex items-start gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-slate-200">Financial Smart Insights</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">{explanation}</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8 font-sans bg-[#020617] text-slate-100">
      
      {/* 1. Global Controls Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            P&L Business Intelligence
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Active financial health tracking in real-time.
          </p>
        </div>
        
        {/* Dropdowns */}
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
          <div className="flex w-full items-center gap-1.5 border border-[#1e293b] px-3 py-1.5 rounded-lg bg-[#020617] text-xs font-semibold text-slate-300 shrink-0">
            <Calendar className="h-4 w-4 text-emerald-400" /> Filter:
            
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="ml-1 bg-transparent border-none text-slate-100 focus:ring-0 focus:outline-none placeholder-slate-500 font-semibold text-xs min-w-[100px] cursor-pointer"
            >
              <option value="All">All Time</option>
              <option value="MonthYear">Year & Month</option>
              <option value="Custom">Custom Date Range</option>
            </select>
          </div>
          
          {filterMode === "MonthYear" && (
            <div className="flex items-center gap-2 w-full animate-fade-in">
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedMonth("All");
                }}
                className="block w-full py-1.5 px-3 border border-[#1e293b] bg-[#020617] text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="block w-full py-1.5 px-3 border border-[#1e293b] bg-[#020617] text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="All">All Months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
          )}

          {filterMode === "Custom" && (
            <div className="flex items-center gap-2 w-full animate-fade-in text-slate-300">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="block w-full py-1.5 px-2 border border-[#1e293b] bg-[#020617] text-slate-100 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="block w-full py-1.5 px-2 border border-[#1e293b] bg-[#020617] text-slate-100 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Intelligent AI NLP Query box */}
      <div className="bg-gradient-to-r from-blue-950 to-slate-900 border border-[#1e293b] text-white rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-4">
          <Sparkles className="h-64 w-64 text-blue-500 animate-spin" style={{ animationDuration: "35s" }} />
        </div>
        
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> LLM Insight Generator
          </span>
          <h3 className="text-xl font-bold mt-2.5">Instant AI Visualizer</h3>
          <p className="text-slate-300 text-sm mt-1 leading-relaxed">
            Prompt your local database directly. Say `"Show EMI distribution compared to Full Payment"` or `"Compare software expenses to overall revenues"`.
          </p>

          <form onSubmit={handleNLPQuery} className="mt-5 flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ask your financial data..."
                value={naturalQuery}
                onChange={(e) => setNaturalQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#020617]/70 hover:bg-[#020617]/90 text-white focus:bg-[#020617] placeholder-slate-500 rounded-xl border border-[#1e293b] focus:border-blue-500 focus:outline-none transition-all duration-200 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={queryLoading || !naturalQuery.trim()}
              className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all font-semibold text-sm active:scale-98 shrink-0 disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              {queryLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Synthesizing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Analyze
                </>
              )}
            </button>
          </form>

          {queryError && (
            <div className="mt-3 text-red-300 flex items-start gap-2 text-xs bg-red-950/40 p-2.5 rounded-lg border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span>{queryError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Render AI Dynamic Custom Chart */}
      {renderCustomChartElement()}

      {/* 3. Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Revenue */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Total Revenue</p>
            <p className="text-2xl font-bold text-white font-mono">{formatCurrency(stats.totalRevenue)}</p>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping"></span> Cash Cleared
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Total Outstanding</p>
            <p className="text-2xl font-bold text-white font-mono">{formatCurrency(stats.totalOutstanding)}</p>
            <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium font-mono">
              <Landmark className="h-3.5 w-3.5" /> Receivables
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Costs */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Total Costs</p>
            <p className="text-2xl font-bold text-white font-mono">{formatCurrency(stats.totalCosts)}</p>
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Operating Expenses
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        {/* Profit Loss Before Tax */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Net Profit before taxes</p>
            <p className={`text-2xl font-bold font-mono ${stats.netProfitLossBeforeTax >= 0 ? "text-slate-100" : "text-rose-400"}`}>
              {formatCurrency(stats.netProfitLossBeforeTax)}
            </p>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Rev - Costs</span>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${stats.netProfitLossBeforeTax >= 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]"}`}>
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Distributed Tax on Cash Paid */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Tax on Cash Received</p>
            <p className={`text-2xl font-bold font-mono text-amber-400`}>
              {formatCurrency(stats.netProfitLossBeforeTax - stats.netProfitLossAfterTax)}
            </p>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Proportional Tax Allocation</span>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center border bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]`}>
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Profit Loss Post-Tax */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between lg:col-span-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Net Profit post taxes</p>
            <p className={`text-2xl font-bold font-mono ${stats.netProfitLossAfterTax >= 0 ? "text-slate-100" : "text-rose-400"}`}>
              {formatCurrency(stats.netProfitLossAfterTax)}
            </p>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Rev - Costs - Tax alloc</span>
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${stats.netProfitLossAfterTax >= 0 ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]" : "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.1)]"}`}>
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Daily Burn Rate */}
        <div className="bg-[#0f172a] p-5 rounded-2xl border border-[#1e293b] bento-card flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Daily Burn/Cost Rate</p>
            <p className="text-2xl font-bold text-white font-mono">{formatCurrency(stats.dailyBurnRate)}</p>
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Costs / {stats.totalWorkingDays} Working Days</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.1)]">
            Burn
          </div>
        </div>
      </div>

      {/* 4. Core Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: MoM Profitability Trend */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] bento-card">
          <h3 className="text-base font-bold text-white mb-1">Month-on-Month Trend</h3>
          <p className="text-xs text-slate-400 mb-5">Side-by-side comparative analysis of actual cash flow vs overhead costs.</p>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {getMoMTrendData().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <BarChart3 className="h-8 w-8 mb-1 text-slate-600" />
                  <p className="text-xs">No active monthly trends to plot.</p>
                </div>
              ) : (
                <BarChart data={getMoMTrendData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="name" tickLine={false} style={{ fontSize: "11px", fill: "#94a3b8" }} />
                  <YAxis tickLine={false} style={{ fontSize: "11px", fill: "#94a3b8" }} tickFormatter={(tick) => formatCurrency(tick)} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar dataKey="revenue" name="Total Revenue (Cash)" fill={momColorRev} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Total Costs (Expenses)" fill={momColorCost} radius={[3, 3, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cash Flow Projections */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] bento-card">
          <h3 className="text-base font-bold text-white mb-1">Cash Flow Projections</h3>
          <p className="text-xs text-slate-400 mb-5">Forward-looking outstanding collection timeline based on client installment targets.</p>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {getCashFlowProjectionData().length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <Calendar className="h-8 w-8 mb-1 text-slate-600" />
                  <p className="text-xs">No forward-looking outstanding dues scheduled.</p>
                </div>
              ) : (
                <LineChart data={getCashFlowProjectionData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="name" tickLine={false} style={{ fontSize: "11px", fill: "#94a3b8" }} />
                  <YAxis tickLine={false} style={{ fontSize: "11px", fill: "#94a3b8" }} tickFormatter={(tick) => formatCurrency(tick)} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Line type="monotone" dataKey="value" name="Scheduled Collection Goal" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Client Payment Breakdown */}
        <div className="bg-[#0f172a] p-6 rounded-2xl border border-[#1e293b] bento-card lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Payment Type Distribution</h3>
              <p className="text-xs text-slate-400">Breakdown of customer financing structures (EMI vs EQI vs ESAI vs Full Payment).</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {getPaymentDistributionData().every(item => item.value === 0) ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <BarChart3 className="h-8 w-8 mb-1 text-slate-600" />
                    <p className="text-xs">No billing methods to distribute in this period selector.</p>
                  </div>
                ) : (
                  <PieChart>
                    <Pie
                      data={getPaymentDistributionData()}
                      cx="55%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {getPaymentDistributionData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Clients`, "Count"]} contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b", color: "#f8fafc" }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="space-y-3 pr-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2 border-b border-[#1e293b] pb-2">Series Labels</h4>
              {getPaymentDistributionData().map((item, idx) => (
                <div key={item.name} className="flex justify-between items-center bg-[#020617] p-2.5 rounded-lg border border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                    <span className="text-sm font-semibold text-slate-200">{item.name}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-400">{item.value} closures</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
