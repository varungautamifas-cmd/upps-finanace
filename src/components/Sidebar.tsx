import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { 
  X, 
  TrendingUp, 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  User
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  userEmail: string | null;
}

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  collapsed, 
  setCollapsed, 
  userEmail 
}: SidebarProps) {
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "revenue", label: "Revenue Tracker", icon: ArrowUpRight },
    { id: "cost", label: "Cost Tracker", icon: ArrowDownRight },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside 
      className={`bg-[#0f172a] text-slate-100 flex flex-col justify-between transition-all duration-300 border-r border-[#1e293b] shrink-0 h-screen sticky top-0 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between px-4 py-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex items-center justify-center p-2 rounded-lg bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]">
              <TrendingUp className="h-5 w-5 shrink-0" />
            </div>
            {!collapsed && (
              <span className="font-bold tracking-tight text-base whitespace-nowrap text-white">
                FinControl Room
              </span>
            )}
          </div>
          
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md hover:bg-[#1e293b] text-slate-400 hover:text-white hidden md:block"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="mt-6 px-2 space-y-1.5">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive 
                    ? "bg-blue-600 text-white font-semibold shadow-[0_0_15px_rgba(59,130,246,0.25)] border-l-4 border-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-[#1e293b]/50"
                }`}
                title={item.label}
              >
                <IconComponent className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="p-3 border-t border-[#1e293b]">
        {!collapsed && userEmail && (
          <div className="px-3 py-2 mb-3 bg-[#1e293b]/50 rounded-lg flex items-center gap-2 border border-[#1e293b]">
            <div className="h-7 w-7 rounded-md bg-[#020617] flex items-center justify-center text-xs font-semibold text-blue-400 capitalize border border-[#1e293b]">
              {userEmail.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase leading-none">Security context</p>
              <p className="text-xs font-semibold text-slate-200 truncate leading-tight mt-1" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>
        )}
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-colors duration-150"
          title="Secure sign-out"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
