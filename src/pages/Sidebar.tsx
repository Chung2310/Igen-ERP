import React, { useState } from "react";
import {
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessageSquareShare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import {
  BRAND_LOGO_PATH,
  BRAND_NAME,
  BRAND_TAGLINE,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  USER_DATA_DELETION_URL,
} from "../config/brand";
import type { TabType } from "../types";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

type MenuTone = "blue" | "green" | "amber" | "purple" | "rose" | "indigo" | "slate";

interface MenuItem {
  label: TabType;
  title: string;
  desc: string;
  icon: React.ElementType;
  tone: MenuTone;
}

const toneClasses: Record<MenuTone, { active: string; icon: string; hoverIcon: string }> = {
  blue: {
    active: "bg-blue-50 text-blue-800 border-blue-100",
    icon: "bg-blue-50 text-blue-600",
    hoverIcon: "group-hover:bg-blue-50 group-hover:text-blue-600",
  },
  green: {
    active: "bg-green-50 text-green-800 border-green-100",
    icon: "bg-green-50 text-green-600",
    hoverIcon: "group-hover:bg-green-50 group-hover:text-green-600",
  },
  amber: {
    active: "bg-amber-50 text-amber-800 border-amber-100",
    icon: "bg-amber-50 text-amber-600",
    hoverIcon: "group-hover:bg-amber-50 group-hover:text-amber-600",
  },
  purple: {
    active: "bg-purple-50 text-purple-800 border-purple-100",
    icon: "bg-purple-50 text-purple-600",
    hoverIcon: "group-hover:bg-purple-50 group-hover:text-purple-600",
  },
  rose: {
    active: "bg-red-50 text-red-800 border-red-100",
    icon: "bg-red-50 text-red-600",
    hoverIcon: "group-hover:bg-red-50 group-hover:text-red-600",
  },
  indigo: {
    active: "bg-indigo-50 text-indigo-800 border-indigo-100",
    icon: "bg-indigo-50 text-indigo-600",
    hoverIcon: "group-hover:bg-indigo-50 group-hover:text-indigo-600",
  },
  slate: {
    active: "bg-gray-50 text-gray-900 border-gray-100",
    icon: "bg-gray-50 text-gray-600",
    hoverIcon: "group-hover:bg-gray-50 group-hover:text-gray-700",
  },
};

const baseMenuItems: MenuItem[] = [
  {
    label: "TỔNG QUAN",
    title: "Tổng quan doanh nghiệp",
    desc: "Chỉ số doanh thu và tiến độ",
    icon: LayoutDashboard,
    tone: "blue",
  },
  {
    label: "NHÂN SỰ",
    title: "Quản lý nhân sự",
    desc: "Sơ đồ, KPI và đào tạo",
    icon: Users,
    tone: "green",
  },
  {
    label: "KHO & SẢN PHẨM",
    title: "Quản lý kho hàng",
    desc: "Sản phẩm và dự báo nhu cầu",
    icon: Package,
    tone: "amber",
  },
  {
    label: "MARKETING",
    title: "AI Marketing Hub",
    desc: "Sáng tạo nội dung và đăng lịch",
    icon: Megaphone,
    tone: "purple",
  },
  {
    label: "SALES CRM",
    title: "Sales CRM Omni-Inbox",
    desc: "Chăm sóc và phễu khách hàng",
    icon: MessageSquareShare,
    tone: "rose",
  },
  {
    label: "QUẢN LÝ TÀI NGUYÊN",
    title: "Quản lý tài nguyên",
    desc: "Tài liệu nội bộ và Google Drive",
    icon: FolderOpen,
    tone: "indigo",
  },
];

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { userProfile } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const menuItems = [...baseMenuItems];

  if (userProfile?.role === "superadmin" || userProfile?.role === "admin") {
    menuItems.push({
      label: "QUẢN TRỊ USER",
      title: "Quản trị user",
      desc: "Cấp quyền và phân vai trò",
      icon: Shield,
      tone: "indigo",
    });
  }

  if (userProfile?.role === "superadmin") {
    menuItems.push({
      label: "HIỆU SUẤT AI",
      title: "Hiệu suất AI",
      desc: "So sánh máy và con người",
      icon: LineChart,
      tone: "indigo",
    });
  }

  if (userProfile) {
    menuItems.push({
      label: "VÍ & NẠP TIỀN",
      title: "Ví & Nạp tiền",
      desc: "Số dư ví và cổng PayOS",
      icon: Wallet,
      tone: "blue",
    });
  }

  menuItems.push({
    label: "CÀI ĐẶT",
    title: "Cài đặt hệ thống",
    desc: "Thông tin cá nhân và cấu hình",
    icon: Settings,
    tone: "slate",
  });

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-gray-100 bg-white text-gray-800 shadow-[18px_0_45px_rgba(15,23,42,0.04)] transition-all duration-300 ${
        isCollapsed ? "w-24" : "w-72"
      }`}
      id="sidebar_container"
    >
      <div className={`flex items-center border-b border-gray-100 ${isCollapsed ? "justify-center px-3 py-5" : "p-6"}`} id="sidebar_brand_header">
        <div className={`flex min-w-0 items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <img
            src={BRAND_LOGO_PATH}
            alt={BRAND_NAME}
            onClick={() => setActiveTab("TỔNG QUAN")}
            title="Về trang Tổng quan"
            className="h-11 w-11 shrink-0 rounded-2xl border border-blue-100 object-cover shadow-lg shadow-blue-500/15 cursor-pointer transition-transform hover:scale-110 active:scale-95"
          />
          {!isCollapsed ? (
            <div className="min-w-0">
              <h2 className="truncate font-sans text-lg font-bold tracking-tight text-blue-700">{BRAND_NAME}</h2>
              <p className="truncate font-mono text-[10px] uppercase tracking-widest text-gray-500">{BRAND_TAGLINE}</p>
            </div>
          ) : null}
        </div>
      </div>

      <nav className={`flex-1 select-none space-y-2 overflow-y-auto ${isCollapsed ? "px-3 py-5" : "px-4 py-6"}`} id="sidebar_nav">
        {!isCollapsed ? (
          <p className="mb-3 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-400">Phân khu ứng dụng</p>
        ) : null}

        {menuItems.map((item) => {
          const isActive = activeTab === item.label;
          const Icon = item.icon;
          const tone = toneClasses[item.tone];

          return (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`group flex w-full items-center justify-between rounded-2xl border px-3.5 py-3.5 text-left font-sans transition-all active:scale-[0.98] ${isActive ? `${tone.active} shadow-xs` : "border-transparent text-gray-600 hover:border-gray-100 hover:bg-gray-50 hover:text-gray-900"
                }`}
              id={`sidebar_menu_${item.label.replace(/\s+/g, "_")}`}
              title={isCollapsed ? item.title : undefined}
            >
              <div className={`flex min-w-0 items-center ${isCollapsed ? "justify-center" : "gap-3.5"}`}>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${isActive ? tone.icon : `bg-gray-50 text-gray-500 ${tone.hoverIcon}`
                    }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {!isCollapsed ? (
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className={`mt-0.5 truncate text-[10px] leading-normal ${isActive ? "text-gray-600" : "text-gray-400"}`}>
                      {item.desc}
                    </p>
                  </div>
                ) : null}
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 transition-transform ${isActive ? "translate-x-0.5 text-gray-500" : "text-gray-300 group-hover:text-gray-500"
                  }`}
              />
            </button>
          );
        })}
      </nav>

      <div className={`border-t border-gray-100 ${isCollapsed ? "px-3 py-4" : "px-4 py-4"}`}>
        <button
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
          className={`flex items-center rounded-2xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 ${
            isCollapsed ? "mx-auto h-11 w-11 justify-center" : "w-full justify-between px-4 py-3"
          }`}
          title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          aria-label={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        >
          <span className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!isCollapsed ? <span className="text-sm font-semibold">Thu gọn danh sách</span> : null}
          </span>
          {!isCollapsed ? <ChevronRight className="h-4 w-4" /> : null}
        </button>
        {!isCollapsed ? (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 px-1 text-[11px] text-gray-500">
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-blue-700"
            >
              Privacy
            </a>
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-blue-700"
            >
              Terms
            </a>
            <a
              href={USER_DATA_DELETION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:text-blue-700"
            >
              Deletion
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
