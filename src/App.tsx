import React, { useState, useEffect } from "react";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { RevenueClosure, Expense } from "./types";

// Components
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import RevenueTracker from "./components/RevenueTracker";
import CostTracker from "./components/CostTracker";
import SettingsView from "./components/Settings";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App views state
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  // Database synchronised state
  const [revenueClosures, setRevenueClosures] = useState<RevenueClosure[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workingDaysMap, setWorkingDaysMap] = useState<Record<string, number>>({});
  
  // Data loading / permissions handlers
  const [dataLoading, setDataLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 1. Subscribe to Firebase Authentication change cycles
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      // Reset caches on logouts
      if (!currentUser) {
        setRevenueClosures([]);
        setExpenses([]);
        setWorkingDaysMap({});
        setCurrentTab("dashboard");
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Database synchronization upon authentication
  useEffect(() => {
    if (!user) return;

    setDataLoading(true);
    setSyncError(null);

    const userId = user.uid;

    // A. Sync Revenue Closures
    const closuresPath = `users/${userId}/revenueClosures`;
    const closuresQuery = query(collection(db, "users", userId, "revenueClosures"), orderBy("closureDate", "desc"));
    const unsubscribeClosures = onSnapshot(
      closuresQuery,
      (snapshot) => {
        const closures: RevenueClosure[] = [];
        snapshot.forEach((doc) => {
          closures.push({ id: doc.id, ...doc.data() } as any);
        });
        setRevenueClosures(closures);
        setDataLoading(false);
      },
      (error) => {
        console.error("Error syncing revenue closures:", error);
        setSyncError("Your account does not have sufficient permissions yet or database is offline.");
        handleFirestoreError(error, OperationType.LIST, closuresPath);
      }
    );

    // B. Sync Expenses
    const expensesPath = `users/${userId}/expenses`;
    const expensesQuery = query(collection(db, "users", userId, "expenses"), orderBy("date", "desc"));
    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const exps: Expense[] = [];
        snapshot.forEach((doc) => {
          exps.push({ id: doc.id, ...doc.data() } as any);
        });
        setExpenses(exps);
      },
      (error) => {
        console.error("Error syncing expenses:", error);
        handleFirestoreError(error, OperationType.LIST, expensesPath);
      }
    );

    // C. Sync Working Days configuration metadata
    const workingDaysPath = `users/${userId}/workingDays`;
    const unsubscribeWorkingDays = onSnapshot(
      collection(db, "users", userId, "workingDays"),
      (snapshot) => {
        const daysMap: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.monthYear && data.workingDays !== undefined) {
            daysMap[data.monthYear] = data.workingDays;
          }
        });
        setWorkingDaysMap(daysMap);
      },
      (error) => {
        console.error("Error syncing working days map:", error);
        handleFirestoreError(error, OperationType.LIST, workingDaysPath);
      }
    );

    return () => {
      unsubscribeClosures();
      unsubscribeExpenses();
      unsubscribeWorkingDays();
    };
  }, [user]);

  // Loading Splash Screen while checking Credentials
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Verifying security parameters...</p>
        </div>
      </div>
    );
  }

  // 3. Force Redirect for guests
  if (!user) {
    return <Login />;
  }

  // Active view router mapping
  const renderTabContent = () => {
    switch (currentTab) {
      case "dashboard":
        return <Dashboard revenueClosures={revenueClosures} expenses={expenses} workingDaysMap={workingDaysMap} />;
      case "revenue":
        return <RevenueTracker userId={user.uid} revenueClosures={revenueClosures} />;
      case "cost":
        return <CostTracker userId={user.uid} expenses={expenses} workingDaysMap={workingDaysMap} />;
      case "settings":
        return <SettingsView userId={user.uid} userEmail={user.email} />;
      default:
        return <Dashboard revenueClosures={revenueClosures} expenses={expenses} workingDaysMap={workingDaysMap} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex font-sans overflow-hidden">
      {/* Side collapsible navigator */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        collapsed={collapsed} 
        setCollapsed={setCollapsed}
        userEmail={user.email}
      />
      
      {/* Main Panel */}
      <main className="flex-1 overflow-y-auto h-screen relative pb-12">
        {syncError && (
          <div className="m-4 md:m-8 bg-red-950/40 p-4 rounded-xl border border-red-900/50 flex items-start gap-3 text-red-200 text-xs">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <h4 className="font-bold">Sync Error</h4>
              <p className="mt-0.5">{syncError}</p>
            </div>
          </div>
        )}

        {/* Global Loading Indicator inside UI */}
        {dataLoading && (
          <div className="absolute top-4 right-4 bg-slate-900 text-slate-200 font-mono text-[10px] py-1 px-2.5 border border-slate-800 rounded-full flex items-center gap-1.5 shadow-sm z-50">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping"></span> Real-time Syncing...
          </div>
        )}

        {/* Dynamic viewport */}
        <div className="animate-fade-in">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
