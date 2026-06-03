import React from "react";
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Megaphone, 
  MessageSquareShare, 
  LineChart, 
  Sparkles,
  ChevronRight,
  LogOut,
  Shield,
  Settings
} from "lucide-react";
import { TabType } from "../types";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { userProfile, logout } = useAuth();

  const menuItems = [
    {
      label: "TỔNG QUAN" as TabType,
      title: "Tổng quan Doanh nghiệp",
      icon: LayoutDashboard,
      desc: "Chỉ số doanh thu & tiến độ",
      color: "text-blue-600 bg-blue-50"
    },
    {
      label: "NHÂN SỰ" as TabType,
      title: "Quản lý Nhân sự",
      icon: Users,
      desc: "Sơ đồ, KPI & đào tạo",
      color: "text-emerald-600 bg-emerald-50"
    },
    {
      label: "KHO & SẢN PHẨM" as TabType,
      title: "Quản lý Kho hàng",
      icon: Package,
      desc: "Sản phẩm & Dự báo nhu cầu",
      color: "text-amber-600 bg-amber-50"
    },
    {
      label: "MARKETING" as TabType,
      title: "AI Marketing Hub",
      icon: Megaphone,
      desc: "Sáng tạo viết bài & đăng lịch",
      color: "text-purple-600 bg-purple-50"
    },
    {
      label: "SALES CRM" as TabType,
      title: "Sales CRM Omni-Inbox",
      icon: MessageSquareShare,
      desc: "Chăm sóc & Phễu khách hàng",
      color: "text-rose-600 bg-rose-50"
    },
    {
      label: "HIỆU SUẤT AI" as TabType,
      title: "Hiệu suất AI",
      icon: LineChart,
      desc: "So sánh hiệu suất máy & người",
      color: "text-indigo-600 bg-indigo-50"
    }
  ];

  if (userProfile?.role === "superadmin") {
    menuItems.push({
      label: "QUẢN TRỊ USER" as TabType,
      title: "Quản trị User",
      icon: Shield,
      desc: "Cấp quyền & phân vai trò",
      color: "text-indigo-600 bg-indigo-50"
    });
  }

  menuItems.push({
    label: "CÀI ĐẶT" as TabType,
    title: "Cài đặt hệ thống",
    icon: Settings,
    desc: "Thông tin cá nhân & Cấu hình",
    color: "text-slate-400 bg-slate-800/20"
  });

  return (
    <aside className="w-80 border-r border-gray-200 bg-[#0F172A] text-slate-100 flex flex-col h-screen shrink-0 sticky top-0" id="sidebar_container">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between" id="sidebar_brand_header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-sans font-bold tracking-tight text-white text-lg">iGen ERP</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Enterprise Hub v2.5</p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded-sm bg-slate-800 text-slate-400 font-mono text-[9px]">
          PRO
        </div>
      </div>

      {/* Main Navigation Menu */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-2 select-none" id="sidebar_nav">
        <p className="px-3 text-[10px] font-bold tracking-wider text-slate-500 font-mono uppercase mb-3">
          Phân khu Ứng dụng
        </p>

        {menuItems.map((item) => {
          const isActive = activeTab === item.label;
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`w-full flex items-center justify-between px-3.5 py-3.5 rounded-xl transition-all font-sans text-left group active:scale-[0.98] ${
                isActive 
                  ? "bg-slate-800/80 text-white shadow-xs border border-slate-700/50" 
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
              id={`sidebar_menu_${item.label.replace(/\s+/g, "_")}`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-lg transition-colors ${
                  isActive 
                    ? "text-blue-500 bg-blue-500/10" 
                    : "text-slate-400 group-hover:text-slate-300 bg-slate-800/30"
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={`text-sm font-semibold transition-colors ${
                    isActive ? "text-white" : "text-slate-300"
                  }`}>{item.title}</p>
                  <p className="text-[10px] text-slate-500 leading-normal mt-0.5">{item.desc}</p>
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-transform ${
                isActive ? "translate-x-0.5 text-blue-400" : ""
              }`} />
            </button>
          );
        })}
      </nav>

      {/* Account Info & Status Footer */}
      <div className="p-4 bg-[#0B0F19] border-t border-slate-900 flex flex-col gap-3" id="sidebar_footer">
        
        {/* User profile card info */}
        {userProfile && (
          <div className="flex items-center justify-between bg-slate-800/30 p-2.5 rounded-xl border border-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              {userProfile.photoURL ? (
                <img 
                  src={userProfile.photoURL} 
                  alt={userProfile.displayName} 
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-650 flex items-center justify-center font-bold text-white text-[11px]">
                  {userProfile.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-snug">{userProfile.displayName}</p>
                <span className={`inline-block mt-0.5 px-1.5 py-0.25 rounded-sm font-mono font-bold text-[7.5px] uppercase border ${
                  userProfile.role === "superadmin" 
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                    : userProfile.role === "admin" 
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                }`}>
                  {userProfile.role}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => logout()}
              title="Đăng xuất tài khoản"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer active:scale-90"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>Hệ thống ERP:</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
        </div>
      </div>
    </aside>
  );
}
