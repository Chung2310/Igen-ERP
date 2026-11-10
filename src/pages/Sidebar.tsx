import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Users,
  Lock,
  Handshake,
  BriefcaseBusiness,
  ShoppingCart,
  Landmark,
  Wrench,
  ContactRound,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { BookOpenIcon } from "@phosphor-icons/react/dist/csr/BookOpen";
import { BriefcaseIcon } from "@phosphor-icons/react/dist/csr/Briefcase";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/csr/ChatCircle";
import { CubeIcon } from "@phosphor-icons/react/dist/csr/Cube";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { HeadsetIcon } from "@phosphor-icons/react/dist/csr/Headset";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { ShieldIcon } from "@phosphor-icons/react/dist/csr/Shield";
import { ShoppingCartIcon } from "@phosphor-icons/react/dist/csr/ShoppingCart";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { StudentIcon } from "@phosphor-icons/react/dist/csr/Student";
import { StethoscopeIcon } from "@phosphor-icons/react/dist/csr/Stethoscope";
import { UsersIcon } from "@phosphor-icons/react/dist/csr/Users";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react/lib";
import {
  BRAND_FULL_LOGO_PATH,
  BRAND_LOGO_PATH,
  BRAND_NAME,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
  USER_DATA_DELETION_URL,
} from "../config/brand";
import type { TabType } from "../types";
import type { UserProfile } from "../types";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useMediaQuery";
import { canViewAiSubscription, filterEnabledTabs, MODULE_READ_PERMISSIONS } from "../config/modules";
import { MARKETING_SUITE_MENU } from "../modules/marketing-suite/navigation";

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  /** Mobile: drawer đang mở */
  mobileOpen: boolean;
  /** Mobile: đóng drawer (bấm backdrop hoặc chọn menu) */
  onMobileClose: () => void;
}

export interface MenuItem {
  label: TabType;
  title: string;
  icon: React.ElementType;
  group: "main" | "operations" | "marketing" | "subscription" | "tools" | "system";
  locked?: boolean;
  lockReason?: "module" | "permission";
}

const baseMenuItems: MenuItem[] = [
  { label: "BÁO GIÁ", title: "Báo giá", icon: FileTextIcon, group: "operations" },
  { label: "QUẢN LÝ Y TẾ", title: "Quản lý y tế", icon: StethoscopeIcon, group: "operations" },
  { label: "GÓI AI & LƯỢT SỬ DỤNG", title: "Gói AI & lượt sử dụng", icon: Sparkles, group: "subscription" },
  ...MARKETING_SUITE_MENU.map((item) => ({ ...item, group: "marketing" as const })),
  {
    label: "TỔNG QUAN",
    title: "Tổng quan",
    icon: LayoutDashboard,
    group: "main",
  },
  {
    label: "TRỢ LÝ AI",
    title: "Trợ lý ERP",
    icon: Sparkles,
    group: "operations",
  },
  {
    label: "NHÂN SỰ",
    title: "Nhân sự",
    icon: Users,
    group: "operations",
  },
  {
    label: "ĐỐI TÁC LAO ĐỘNG",
    title: "Đối tác lao động",
    icon: Handshake,
    group: "operations",
  },
  {
    label: "ĐỐI TÁC",
    title: "Đối tác học viên",
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
    label: "SỬA CHỮA & BẢO HÀNH",
    title: "Sửa chữa & bảo hành",
    icon: Wrench,
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
    label: "BÁN LẺ",
    title: "Bán lẻ",
    icon: ShoppingCart,
    group: "operations",
  },
  {
    label: "ĐỐI TÁC BÁN LẺ",
    title: "Đối tác bán lẻ",
    icon: Handshake,
    group: "operations",
  },
  {
    label: "TÀI CHÍNH",
    title: "Tài chính",
    icon: Landmark,
    group: "operations",
  },
  {
    label: "QUẢN LÝ TÀI NGUYÊN",
    title: "Tài nguyên",
    icon: FolderOpen,
    group: "tools",
  },
  {
    label: "TRÒ CHUYỆN",
    title: "Trò chuyện",
    icon: MessageSquare,
    group: "tools",
  },
];

const groupTitles: Record<MenuItem["group"], string> = {
  main: "Tổng quan",
  operations: "Vận hành",
  marketing: "Marketing",
  subscription: "Gói dịch vụ",
  tools: "Công cụ",
  system: "Hệ thống",
};

const menuIcons: Partial<Record<TabType, PhosphorIcon>> = {
  "TỔNG QUAN": ChartBarIcon,
  "NHÂN SỰ": UsersIcon,
  "ĐỐI TÁC": UsersThreeIcon,
  "ĐỐI TÁC LAO ĐỘNG": UsersThreeIcon,
  "KHO & SẢN PHẨM": CubeIcon,
  "SỬA CHỮA & BẢO HÀNH": WrenchIcon,
  "QUẢN LÝ HỌC VIÊN": StudentIcon,
  "QUẢN LÝ LAO ĐỘNG": BriefcaseIcon,
  "QUẢN LÝ KHÁCH HÀNG": HeadsetIcon,
  "BÁN LẺ": ShoppingCartIcon,
  "ĐỐI TÁC BÁN LẺ": UsersThreeIcon,
  "BÁO GIÁ": FileTextIcon,
  "QUẢN LÝ Y TẾ": StethoscopeIcon,
  "TÀI CHÍNH": FileTextIcon,
  "OMNI INBOX": ChatCircleIcon,
  "MARKETING": UsersThreeIcon,
  "KHO TRI THỨC": BookOpenIcon,
  "TÍCH HỢP MARKETING": GearIcon,
  "GÓI AI & LƯỢT SỬ DỤNG": SparkleIcon,
  "QUẢN LÝ TÀI NGUYÊN": FolderIcon,
  "TRÒ CHUYỆN": ChatCircleIcon,
  "TRỢ LÝ AI": SparkleIcon,
  "QUẢN TRỊ USER": ShieldIcon,
  "CÀI ĐẶT": GearIcon,
};

export function getAvailableMenuItems(userProfile: UserProfile | null, hasPermission: (permission: string) => boolean, includeDisabled = false): MenuItem[] {
  const enabledTabs = new Set(filterEnabledTabs(baseMenuItems.map((item) => item.label), userProfile?.enabledModules, userProfile?.businessType));
  const menuItems: MenuItem[] = baseMenuItems
    .filter((item) => includeDisabled || enabledTabs.has(item.label))
    .filter((item) => includeDisabled || item.label !== "TÍCH HỢP MARKETING" || userProfile?.enabledModules?.some((key) => ["social-marketing", "omni-inbox"].includes(key)))
    .filter((item) => item.label !== "CHIẾN DỊCH NỘI DUNG")
    .map((item) => {
      const requiredPerms = MODULE_READ_PERMISSIONS[item.label];
      const isPartnerAdmin =
        ["ĐỐI TÁC", "ĐỐI TÁC LAO ĐỘNG"].includes(item.label) &&
        (userProfile?.role === "admin" || userProfile?.role === "superadmin");
      const locked = item.label === "GÓI AI & LƯỢT SỬ DỤNG" ? !canViewAiSubscription(userProfile) : item.label === "TRỢ LÝ AI" ? !hasPermission("chat:read") : requiredPerms
        ? !isPartnerAdmin && !requiredPerms.some((code) => hasPermission(code))
        : false;
      const moduleDisabled = !enabledTabs.has(item.label) || (item.label === "TÍCH HỢP MARKETING" && !userProfile?.enabledModules?.some((key) => ["social-marketing", "omni-inbox"].includes(key)));
      return { ...item, locked: moduleDisabled || locked, lockReason: moduleDisabled ? "module" as const : locked ? "permission" as const : undefined };
    });

  if (userProfile?.role === "superadmin" || userProfile?.role === "admin") {
    menuItems.push({ label: "QUẢN TRỊ USER", title: "Tài khoản", icon: Shield, group: "system" });
  }
  menuItems.push({ label: "CÀI ĐẶT", title: "Hệ thống", icon: Settings, group: "system" });
  return menuItems;
}

export default function Sidebar({ activeTab, setActiveTab, mobileOpen, onMobileClose }: SidebarProps) {
  const { userProfile, hasPermission } = useAuth();
  const [isCollapsedState, setIsCollapsed] = useState(false);
  const [isMarketingExpanded, setIsMarketingExpanded] = useState(true);
  const isMobile = useIsMobile();
  const isCollapsed = isCollapsedState && !isMobile;

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, mobileOpen]);
  const menuItems = getAvailableMenuItems(userProfile, hasPermission);

  const groups: MenuItem["group"][] = ["main", "operations", "marketing", "subscription", "tools", "system"];

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
        <div className={`flex items-center border-b border-slate-100 ${isCollapsed ? "justify-center px-3 py-3" : "justify-start pl-3.5 pr-2 pt-1.5 pb-2"}`} id="sidebar_brand_header">
          {isCollapsed ? (
            <img
              src={BRAND_LOGO_PATH}
              alt={BRAND_NAME}
              onClick={() => setActiveTab("TỔNG QUAN")}
              title="Về trang Tổng quan"
              className="h-9 w-9 shrink-0 rounded-xl object-contain cursor-pointer transition-transform hover:scale-105 active:scale-95"
            />
          ) : (
            <img
              src={BRAND_FULL_LOGO_PATH}
              alt={BRAND_NAME}
              onClick={() => setActiveTab("TỔNG QUAN")}
              title="Về trang Tổng quan"
              className="h-[64px] w-auto max-w-[220px] shrink-0 object-contain object-left -translate-y-1 cursor-pointer transition-transform hover:scale-102 active:scale-98"
            />
          )}
        </div>

        <a href="/modules" className={`mx-3 mt-3 flex min-h-11 items-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isCollapsed ? "justify-center" : "gap-3"}`} title="Chọn phân hệ" aria-label={isCollapsed ? "Chọn phân hệ" : undefined}>
          <span className="grid size-6 grid-cols-2 gap-0.5" aria-hidden="true"><span className="rounded-sm bg-primary"/><span className="rounded-sm bg-tertiary"/><span className="rounded-sm bg-secondary"/><span className="rounded-sm bg-primary"/></span>
          {!isCollapsed && <span>Chọn phân hệ</span>}
        </a>

        {/* Navigation Menu */}
        <nav className={`flex-1 select-none space-y-5 overflow-y-auto ${isCollapsed ? "px-2 py-4" : "px-3 py-4"}`} id="sidebar_nav">
          {groups.map((groupKey) => {
            const itemsInGroup = menuItems.filter((item) => item.group === groupKey);
            if (itemsInGroup.length === 0) return null;

            return (
              <div key={groupKey} className="space-y-1">
                {groupKey === "marketing" ? (
                  <button
                    type="button"
                    id="sidebar_marketing_group"
                    aria-expanded={!isCollapsed && isMarketingExpanded}
                    aria-controls="sidebar_marketing_children"
                    title={isCollapsed ? "Marketing" : undefined}
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false);
                        setIsMarketingExpanded(true);
                      } else setIsMarketingExpanded((current) => !current);
                    }}
                    className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sans text-sm font-medium transition-all active:scale-[0.98] hover:bg-surface-container-low hover:text-on-surface focus-visible:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isCollapsed ? "justify-center" : "justify-between"} ${itemsInGroup.some((item) => item.label === activeTab) ? "text-on-surface" : "text-on-surface-variant"}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="relative size-6 shrink-0 text-primary" aria-hidden="true">
                        <MegaphoneIcon size={24} weight="regular" className={`${itemsInGroup.some((item) => item.label === activeTab) ? "hidden" : "group-hover:hidden group-focus-visible:hidden"}`} />
                        <MegaphoneIcon size={24} weight="fill" className={`${itemsInGroup.some((item) => item.label === activeTab) ? "" : "hidden group-hover:block group-focus-visible:block"} absolute inset-0`} />
                      </span>
                      {!isCollapsed && <span>Marketing</span>}
                    </span>
                    {!isCollapsed && <ChevronDown className={`h-4 w-4 transition-transform ${isMarketingExpanded ? "" : "-rotate-90"}`} />}
                  </button>
                ) : !isCollapsed ? (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {groupTitles[groupKey]}
                  </p>
                ) : null}

                <div
                  id={groupKey === "marketing" ? "sidebar_marketing_children" : undefined}
                  role={groupKey === "marketing" ? "group" : undefined}
                  aria-label={groupKey === "marketing" ? "Các chức năng Marketing" : undefined}
                  className={groupKey === "marketing"
                    ? isCollapsed || !isMarketingExpanded ? "hidden" : "ml-3 space-y-1 border-l border-slate-200 pl-2"
                    : "space-y-1"}
                >
                {itemsInGroup.map((item) => {
                  const isActive = activeTab === item.label;
                  const Icon = menuIcons[item.label] ?? item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.locked) return;
                        setActiveTab(item.label);
                        onMobileClose();
                      }}
                      aria-disabled={item.locked}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex w-full items-center rounded-xl px-3 py-2.5 text-left font-sans text-sm font-medium transition-all active:scale-[0.98] ${
                        item.locked
                          ? "cursor-not-allowed text-slate-300 opacity-60"
                          : isActive
                          ? "bg-surface-container-low text-primary font-semibold"
                          : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface focus-visible:bg-surface-container-low"
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
                        <span className={`relative size-6 shrink-0 transition-colors ${item.locked ? "text-on-surface-variant/50" : "text-on-surface group-hover:text-primary group-focus-visible:text-primary group-aria-[current=page]:text-primary"}`} aria-hidden="true">
                          <Icon size={24} weight="regular" className={isActive ? "hidden" : item.locked ? "" : "group-hover:hidden group-focus-visible:hidden"} />
                          {!item.locked && <Icon size={24} weight="fill" className={`${isActive ? "" : "hidden group-hover:block group-focus-visible:block"} absolute inset-0`} />}
                        </span>
                        {!isCollapsed ? (
                          <span className="truncate">{item.title}</span>
                        ) : null}
                      </div>

                      {item.locked ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      ) : !isCollapsed && isActive ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  );
                })}
                </div>
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
