import React, { useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Shield,
  GraduationCap,
  Users,
  BookOpen,
  Lock,
  Handshake,
  BriefcaseBusiness,
  ContactRound,
  UserSearch,
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
import { useIsMobile } from "../hooks/useMediaQuery";
import { filterEnabledTabs, MODULE_READ_PERMISSIONS } from "../config/modules";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  /** Mobile: drawer đang mở */
  mobileOpen: boolean;
  /** Mobile: đóng drawer (bấm backdrop hoặc chọn menu) */
  onMobileClose: () => void;
}

interface MenuItem {
  label: TabType;
  title: string;
  icon: React.ElementType;
  group: "main" | "operations" | "tools" | "system";
  locked?: boolean;
}

const baseMenuItems: MenuItem[] = [
  {
    label: "TỔNG QUAN",
    title: "Tổng quan",
    icon: LayoutDashboard,
    group: "main",
  },
  {
    label: "NHÂN SỰ",
    title: "Nhân sự",
    icon: Users,
    group: "operations",
  },
  {
    label: "ĐỐI TÁC",
    title: "Đối tác",
    icon: Handshake,
    group: "operations",
  },
  {
    label: "KHO & SẢN PHẨM",
    title: "Kho & Sản phẩm",
    icon: Package,
    group: "operations",
  },
  {
    label: "QUẢN LÝ HỌC VIÊN",
    title: "Học viên",
    icon: GraduationCap,
    group: "operations",
  },
  {
    label: "QUẢN LÝ LAO ĐỘNG",
    title: "Lao động",
    icon: BriefcaseBusiness,
    group: "operations",
  },
  {
    label: "QUẢN LÝ KHÁCH HÀNG",
    title: "Khách hàng",
    icon: ContactRound,
    group: "operations",
  },
  {
    label: "QUẢN LÝ ỨNG VIÊN",
    title: "Ứng viên",
    icon: UserSearch,
    group: "operations",
  },
  {
    label: "QUẢN LÝ TÀI NGUYÊN",
    title: "Quản lý tài nguyên",
    icon: FolderOpen,
    group: "tools",
  },
  {
    label: "TRÒ CHUYỆN",
    title: "Trò chuyện nội bộ",
    icon: MessageSquare,
    group: "tools",
  },
];

const groupTitles: Record<MenuItem["group"], string> = {
  main: "Tổng quan",
  operations: "Vận hành",
  tools: "Công cụ",
  system: "Hệ thống",
};

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, hasPermission } = useAuth();
  const [isCollapsedState, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const isCollapsed = isCollapsedState && !isMobile;
  const enabledTabs = new Set(filterEnabledTabs(baseMenuItems.map((item) => item.label), userProfile?.enabledModules, userProfile?.businessType));
  const menuItems: MenuItem[] = baseMenuItems
    .filter((item) => enabledTabs.has(item.label))
    .map((item) => {
      const requiredPerms = MODULE_READ_PERMISSIONS[item.label];
      const isPartnerAdmin =
        item.label === "ĐỐI TÁC" &&
        (userProfile?.role === "admin" || userProfile?.role === "superadmin");
      const locked = requiredPerms
        ? !isPartnerAdmin && !requiredPerms.some((code) => hasPermission(code))
        : false;
      return { ...item, locked };
    });

  if (userProfile?.role === "superadmin" || userProfile?.role === "admin") {
    // Phân tích & báo cáo doanh thu: đã bị loại bỏ theo yêu cầu của user
    menuItems.push({
      label: "QUẢN TRỊ USER",
      title: "Quản lý người dùng",
      icon: Shield,
      group: "system",
    });
  }

  menuItems.push({
    label: "CÀI ĐẶT",
    title: "Cài đặt hệ thống",
    icon: Settings,
    group: "system",
  });

  menuItems.push({
    label: "HƯỚNG DẪN",
    title: "Hướng dẫn sử dụng",
    icon: BookOpen,
    group: "system",
  });

  const groups: MenuItem["group"][] = ["main", "operations", "tools", "system"];

  return (
    <>
      {/* Backdrop trên mobile */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-slate-200/80 bg-white text-slate-800 shadow-[18px_0_45px_rgba(15,23,42,0.03)] transition-all duration-300 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "md:w-20" : "md:w-64"}`}
        id="sidebar_container"
      >
        {/* Brand Header */}
        <div className={`flex items-center border-b border-slate-100 ${isCollapsed ? "justify-center px-3 py-4" : "px-5 py-4.5"}`} id="sidebar_brand_header">
          <div className={`flex min-w-0 items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
            <img
              src={BRAND_LOGO_PATH}
              alt={BRAND_NAME}
              onClick={() => setActiveTab("TỔNG QUAN")}
              title="Về trang Tổng quan"
              className="h-10 w-10 shrink-0 rounded-xl border border-sky-100 object-cover shadow-sm cursor-pointer transition-transform hover:scale-105 active:scale-95"
            />
            {!isCollapsed ? (
              <div className="min-w-0">
                <h2 className="truncate font-sans text-base font-bold tracking-tight text-sky-700">{BRAND_NAME}</h2>
                <p className="truncate font-mono text-[10px] uppercase tracking-widest text-slate-400">{BRAND_TAGLINE}</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className={`flex-1 select-none space-y-5 overflow-y-auto ${isCollapsed ? "px-2 py-4" : "px-3 py-4"}`} id="sidebar_nav">
          {groups.map((groupKey) => {
            const itemsInGroup = menuItems.filter((item) => item.group === groupKey);
            if (itemsInGroup.length === 0) return null;

            return (
              <div key={groupKey} className="space-y-1">
                {!isCollapsed ? (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {groupTitles[groupKey]}
                  </p>
                ) : null}

                {itemsInGroup.map((item) => {
                  const isActive = activeTab === item.label;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.locked) return;
                        setActiveTab(item.label);
                        onMobileClose();
                      }}
                      aria-disabled={item.locked}
                      className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sans text-sm font-medium transition-all active:scale-[0.98] ${
                        item.locked
                          ? "cursor-not-allowed text-slate-300 opacity-60"
                          : isActive
                          ? "bg-sky-50 text-sky-700 font-semibold shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      } ${isCollapsed ? "justify-center" : "justify-between"}`}
                      id={`sidebar_menu_${item.label.replace(/\s+/g, "_")}`}
                      title={
                        item.locked
                          ? "Bạn không có quyền truy cập mục này. Liên hệ quản trị viên để được cấp quyền."
                          : isCollapsed
                          ? item.title
                          : undefined
                      }
                    >
                      <div className={`flex min-w-0 items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
                        <Icon
                          className={`h-5 w-5 shrink-0 transition-colors ${
                            item.locked
                              ? "text-slate-300"
                              : isActive
                              ? "text-sky-600"
                              : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        {!isCollapsed ? (
                          <span className="truncate">{item.title}</span>
                        ) : null}
                      </div>

                      {item.locked ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      ) : !isCollapsed && isActive ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer & Collapse Toggle */}
        <div className={`border-t border-slate-100 flex flex-col items-center ${isCollapsed ? "px-2 py-3" : "px-3 py-3"}`}>
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 shadow-xs cursor-pointer"
            title={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            aria-label={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {!isCollapsed ? (
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 text-[11px] text-slate-400">
              <a
                href={PRIVACY_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600 transition"
              >
                Bảo mật
              </a>
              <span>•</span>
              <a
                href={TERMS_OF_SERVICE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600 transition"
              >
                Điều khoản
              </a>
              <span>•</span>
              <a
                href={USER_DATA_DELETION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600 transition"
              >
                Xóa dữ liệu
              </a>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
