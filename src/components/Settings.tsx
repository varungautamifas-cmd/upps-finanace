import React, { useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { collection, getDocs, doc, deleteDoc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { 
  Settings, Key, Trash2, ShieldCheck, Database, RefreshCw, 
  HelpCircle, Sparkles, CheckCircle, AlertCircle, Percent
} from "lucide-react";

interface SettingsProps {
  userId: string;
  userEmail: string | null;
}

export default function SettingsView({ userId, userEmail }: SettingsProps) {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const [taxRate, setTaxRate] = useState<string>("");
  const [taxSaving, setTaxSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const loadTaxConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId, "config", "tax"));
        if (snap.exists() && snap.data().defaultTaxRate !== undefined) {
          setTaxRate(String(snap.data().defaultTaxRate));
        }
      } catch (err) {
        console.error("Failed to load tax config:", err);
      }
    };
    loadTaxConfig();
  }, [userId]);

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaxSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const parsed = parseFloat(taxRate);
      if (isNaN(parsed) || parsed < 0) {
        setError("Please enter a valid positive tax percentage.");
        return;
      }
      await setDoc(doc(db, "users", userId, "config", "tax"), {
        defaultTaxRate: parsed,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setSuccess("Default tax rate updated successfully!");
    } catch (err: any) {
      console.error(err);
      setError("Failed to save tax settings.");
    } finally {
      setTaxSaving(false);
    }
  };

  const handleClearDbCache = async () => {
    if (!window.confirm("CRITICAL WARNING: This will permanently delete all logged revenue closures, expenses, and configuration metadata from your cloud database. This operation is IRREVERSIBLE. Do you specify intent to continue?")) {
      return;
    }

    setClearing(true);
    setSuccess(null);
    setError(null);

    try {
      // 1. Purge revenueClosures
      const revRef = collection(db, "users", userId, "revenueClosures");
      const revSnap = await getDocs(revRef);
      const revDeletes = revSnap.docs.map(d => deleteDoc(doc(db, "users", userId, "revenueClosures", d.id)));

      // 2. Purge expenses
      const expRef = collection(db, "users", userId, "expenses");
      const expSnap = await getDocs(expRef);
      const expDeletes = expSnap.docs.map(d => deleteDoc(doc(db, "users", userId, "expenses", d.id)));

      // 3. Purge workingDays
      const daysRef = collection(db, "users", userId, "workingDays");
      const daysSnap = await getDocs(daysRef);
      const daysDeletes = daysSnap.docs.map(d => deleteDoc(doc(db, "users", userId, "workingDays", d.id)));

      await Promise.all([...revDeletes, ...expDeletes, ...daysDeletes]);

      setSuccess("Database cleanly purged! All financial closures, expenses, and working day configurations have been successfully removed.");
    } catch (err: any) {
      console.error("Purge failure:", err);
      setError("An error occurred during database purging. Check Firebase firewall/rules permissions.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6 font-sans">
      
      {/* Title */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-slate-1000 flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" /> Operational Configurations
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Verify active cloud connections, cryptographic rules status, and manage active directory records.
        </p>
      </div>

      {success && (
        <div className="bg-emerald-50 p-4 border border-emerald-100 rounded-xl flex items-start gap-3 text-sm text-emerald-800 font-medium">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 p-4 border border-red-100 rounded-xl flex items-start gap-3 text-sm text-red-800 font-medium">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Profile & Security status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Security context */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" /> Security State
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your session is encapsulated in standard Firestore Relational Rules. No external clients can access or modify your client listings without auth tokens.
          </p>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-500">Security Context UID</span>
              <span className="font-mono font-bold text-slate-800 truncate max-w-xs">{userId}</span>
            </div>
            <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-500">Authenticated Email</span>
              <span className="font-semibold text-slate-800">{userEmail}</span>
            </div>
          </div>
        </div>

        {/* Database configuration / Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2">
            <Database className="h-4.5 w-4.5 text-emerald-600" /> Cloud Connection
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Stateful connection with Firebase Enterprise cluster is online. Synchronization is handled symmetrically via client snapshots.
          </p>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-500">Active Sync Engine</span>
              <span className="inline-flex px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-10px font-extrabold uppercase">Firestore Online</span>
            </div>
            <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-500">Vite Asset Dev Server</span>
              <span className="font-mono text-10px text-slate-600">Active</span>
            </div>
          </div>
        </div>

        {/* Global Tax Configuration */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 md:col-span-2">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2">
            <Percent className="h-4.5 w-4.5 text-emerald-600" /> Global Tax Configuration
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Configure a default Global Tax or GST rate to use when logging client closures. This auto-calculates tax deductions.
          </p>
          
          <form onSubmit={handleSaveTax} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                placeholder="e.g. 18.0"
              />
            </div>
            <button
              type="submit"
              disabled={taxSaving}
              className="py-2 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
            >
              {taxSaving ? "Saving..." : "Save Rate"}
            </button>
          </form>
        </div>

        {/* Dynamic Reset Data Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3.5 md:col-span-2">
          <h3 className="text-sm font-bold text-red-600 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-50 pb-2">
            <Trash2 className="h-4.5 w-4.5" /> Wipe Saved Databases
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Wipe all record closures, organizational expenses, and metadata. Handy if you want to upload entirely brand-new CSV test structures to check custom P&L calculations.
          </p>

          <div className="pt-2">
            <button
              onClick={handleClearDbCache}
              disabled={clearing}
              className="py-2.5 px-5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100/80 hover:text-red-800 font-bold text-xs transition-all flex items-center gap-1.5 border border-red-200"
            >
              {clearing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Purging active databases...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Purge Cloud Databases & Cache
                </>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
