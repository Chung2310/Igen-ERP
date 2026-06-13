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
    tab: "Tá»”NG QUAN",
    component: lazy(() => import("../pages/DashboardTab")),
  },
  {
    tab: "NHÃ‚N Sá»°",
    component: lazy(() => import("../pages/HRTab")),
  },
  {
    tab: "KHO & Sáº¢N PHáº¨M",
    component: lazy(() => import("../pages/InventoryTab")),
  },
  {
    tab: "MARKETING",
    component: lazy(() => import("../pages/MarketingTab")),
  },
  {
    tab: "SALES CRM",
    component: lazy(() => import("../pages/CRMTab")),
  },
  {
    tab: "HIá»†U SUáº¤T AI",
    component: lazy(() => import("../pages/AIPerformanceTab")),
  },
  {
    tab: "QUáº¢N TRá»Š USER",
    component: lazy(() => import("../pages/UserAdminTab")),
    canAccess: (userProfile) => userProfile.role === "superadmin" || userProfile.role === "admin",
  },
  {
    tab: "CÃ€I Äáº¶T",
    component: lazy(() => import("../pages/SettingsTab")),
  },
];

export const DEFAULT_APP_TAB: TabType = "Tá»”NG QUAN";

export function getRouteByTab(tab: TabType) {
  return APP_ROUTES.find((route) => route.tab === tab) || APP_ROUTES[0];
}
