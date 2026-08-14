import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { TabType, UserProfile } from "../types";

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
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(
        userProfile.permissions?.includes("*") ||
        userProfile.permissions?.includes("dashboard:read")
      ),
  },
  {
    tab: "NHÂN SỰ",
    component: lazy(() => import("../pages/HRTab")),
  },
  {
    tab: "ĐỐI TÁC",
    component: lazy(() => import("../pages/PartnersTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(
        userProfile.permissions?.includes("*") ||
        userProfile.permissions?.includes("relationship:read"),
      ),
  },
  {
    tab: "KHO & SẢN PHẨM",
    component: lazy(() => import("../pages/InventoryTab")),
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
    tab: "QUẢN LÝ LAO ĐỘNG",
    component: lazy(() => import("../modules/worker-management/WorkerWorkspace")),
  },
  {
    tab: "BÁN LẺ",
    component: lazy(() => import("../modules/retail/RetailTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.some((permission) => permission === "retail:manage" || permission === "retail:manage")),
  },
  {
    tab: "TÀI CHÍNH",
    component: lazy(() => import("../modules/finance/FinanceTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.some((permission) => ["finance:read", "finance:manage", "finance:manage"].includes(permission))),
  },
  {
    tab: "QUẢN LÝ KHÁCH HÀNG",
    component: lazy(() => import("../modules/customer-management/CustomerManagementTab")),
  },
  {
    tab: "QUẢN LÝ ỨNG VIÊN",
    component: lazy(() => import("../modules/candidate-management/CandidateManagementTab")),
  },
  {
    tab: "PHÂN TÍCH & BÁO CÁO",
    component: lazy(() => import("../pages/AnalyticsTab")),
    canAccess: (userProfile) => userProfile.role === "superadmin" || userProfile.role === "admin",
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
    tab: "HƯỚNG DẪN",
    component: lazy(() => import("../pages/GuideTab")),
  },

];

export const DEFAULT_APP_TAB: TabType = "TỔNG QUAN";

export function getRouteByTab(tab: TabType) {
  return APP_ROUTES.find((route) => route.tab === tab) || APP_ROUTES[0];
}
