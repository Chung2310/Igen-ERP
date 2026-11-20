import { AI_CREDITS_ENABLED } from "../../shared/features";
import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { TabType, UserProfile } from "../types";

export type LazyPageComponent = LazyExoticComponent<ComponentType<any>>;

export type AppRoute = {
  tab: TabType;
  component: LazyPageComponent;
  canAccess?: (userProfile: UserProfile) => boolean;
};

const ALL_ROUTES: AppRoute[] = [
  {
    tab: "TỔNG QUAN",
    component: lazy(() => import("../pages/DashboardTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.includes("dashboard:read")),
  },
  {
    tab: "NHÂN SỰ",
    component: lazy(() => import("../pages/HRTab")),
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
  {
    tab: "QUẢN LÝ KHÁCH HÀNG",
    component: lazy(() => import("../modules/customer-management/CustomerManagementTab")),
  },
  {
    tab: "QUẢN LÝ THIẾT BỊ",
    component: lazy(() => import("../pages/EquipmentTab")),
  },
  {
    tab: "QUẢN LÝ VẬT TƯ",
    component: lazy(() => import("../pages/SupplyTab")),
  },
  {
    tab: "QUẢN LÝ TÀI NGUYÊN",
    component: lazy(() => import("../pages/ResourceTab")),
  },
  {
    tab: "TRÒ CHUYỆN",
    component: lazy(() => import("../pages/ChatTab")),
  },
  {
    tab: "BẢNG TIN",
    component: lazy(() => import("../pages/BlogChannelTab")),
  },
  {
    tab: "KHO TRI THỨC",
    component: lazy(() => import("../pages/KnowledgeTab")),
    canAccess: (user) =>
      Boolean(user.permissions?.some((permission) => ["*", "knowledge:read", "knowledge:manage"].includes(permission))),
  },
];

export const APP_ROUTES = ALL_ROUTES.filter(route => AI_CREDITS_ENABLED || route.tab !== "VÍ & NẠP TIỀN");

export const DEFAULT_APP_TAB: TabType = "TỔNG QUAN";

export function getRouteByTab(tab: TabType) {
  return APP_ROUTES.find((route) => route.tab === tab) || APP_ROUTES[0];
}
