import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { TabType, UserProfile } from "../types";
import { isTabHidden } from "../config/modules";

export type LazyPageComponent = LazyExoticComponent<ComponentType<any>>;

export type AppRoute = {
  tab: TabType;
  component: LazyPageComponent;
  canAccess?: (userProfile: UserProfile) => boolean;
};

export const APP_ROUTES: AppRoute[] = [
  {
    tab: "TỔNG QUAN",
    component: lazy(() => import("../pages/DashboardTab")),
  },
  {
    tab: "NHÂN SỰ",
    component: lazy(() => import("../pages/HRTab")),
  },
  {
    tab: "KHO & SẢN PHẨM",
    component: lazy(() => import("../pages/InventoryTab")),
  },
  {
    tab: "MARKETING",
    component: lazy(() => import("../pages/MarketingTab")),
    canAccess: () => !isTabHidden("MARKETING"),
  },
  {
    tab: "SALES CRM",
    component: lazy(() => import("../pages/CRMTab")),
    canAccess: () => !isTabHidden("SALES CRM"),
  },
  {
    tab: "QUẢN LÝ TÀI NGUYÊN",
    component: lazy(() => import("../pages/ResourceTab")),
  },
  {
    tab: "TÀI NGUYÊN",
    component: lazy(() => import("../pages/ResourceTab")),
  },
  {
    tab: "TRÒ CHUYỆN",
    component: lazy(() => import("../pages/ChatTab")),
  },
  {
    tab: "QUẢN LÝ HỌC VIÊN",
    component: lazy(() => import("../modules/student-management/StudentManagementTab")),
  },
  {
    tab: "HIỆU SUẤT AI",
    component: lazy(() => import("../pages/AIPerformanceTab")),
    canAccess: (userProfile) => userProfile.role === "superadmin",
  },
  {
    tab: "QUẢN TRỊ USER",
    component: lazy(() => import("../pages/UserAdminTab")),
    canAccess: (userProfile) => userProfile.role === "superadmin" || userProfile.role === "admin",
  },
  {
    tab: "CÀI ĐẶT",
    component: lazy(() => import("../pages/SettingsTab")),
  },
  {
    tab: "VÍ & NẠP TIỀN",
    component: lazy(() => import("../pages/WalletTab")),
  },
];

export const DEFAULT_APP_TAB: TabType = "TỔNG QUAN";

export function getRouteByTab(tab: TabType) {
  return APP_ROUTES.find((route) => route.tab === tab) || APP_ROUTES[0];
}
