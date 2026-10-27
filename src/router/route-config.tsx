import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { TabType, UserProfile } from "../types";
import { canViewAiSubscription } from "../config/modules";

export type LazyPageComponent = LazyExoticComponent<ComponentType<any>>;

export type AppRoute = {
  tab: TabType;
  component: LazyPageComponent;
  canAccess?: (userProfile: UserProfile) => boolean;
};

export const APP_ROUTES: AppRoute[] = [
  { tab: "CHIẾN DỊCH NỘI DUNG", component: lazy(() => import("../modules/marketing-suite/campaign/pages/MarketingTab")), canAccess: (user) => ["admin", "superadmin"].includes(user.role) || Boolean(user.permissions?.some((value) => ["*", "marketing:read", "marketing:manage"].includes(value))) },
  { tab: "OMNI INBOX", component: lazy(() => import("../modules/marketing-suite/message/pages/CRMTab")), canAccess: (user) => ["admin", "superadmin"].includes(user.role) || Boolean(user.permissions?.some((value) => ["*", "omni-inbox:read", "omni-inbox:manage"].includes(value))) },
  { tab: "KHO TRI THỨC", component: lazy(() => import("../modules/marketing-suite/knowledge/pages/CompanyKnowledgePage")), canAccess: (user) => ["admin", "superadmin"].includes(user.role) || Boolean(user.permissions?.some((value) => ["*", "company-knowledge:read", "company-knowledge:manage"].includes(value))) },
  { tab: "TÍCH HỢP MARKETING", component: lazy(() => import("../modules/marketing-suite/shared/pages/MarketingIntegrationsPage")), canAccess: (user) => Boolean(user.enabledModules?.some((key) => ["social-marketing", "omni-inbox"].includes(key))) && (["admin", "superadmin"].includes(user.role) || Boolean(user.permissions?.some((value) => ["*", "social-integration:read", "social-integration:manage"].includes(value)))) },
  { tab: "GÓI AI & LƯỢT SỬ DỤNG", component: lazy(() => import("../modules/marketing-suite/shared/pages/AiSubscriptionPage")), canAccess: canViewAiSubscription },
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
    tab: "ĐỐI TÁC LAO ĐỘNG",
    component: lazy(() => import("../pages/WorkerPartnersTab")),
    canAccess: (userProfile) => userProfile.role === "superadmin" || userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.some((permission) => ["*", "labor-partner:read", "labor-partner:manage"].includes(permission))),
  },
  {
    tab: "ĐỐI TÁC",
    component: lazy(() => import("../pages/PartnersTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(
        userProfile.permissions?.includes("*") ||
        userProfile.permissions?.some((permission) =>
           ["relationship:read", "relationship:manage"].includes(permission),
        ),
      ),
  },
  {
    tab: "KHO & SẢN PHẨM",
    component: lazy(() => import("../pages/InventoryTab")),
  },
  {
    tab: "SỬA CHỮA & BẢO HÀNH",
    component: lazy(() => import("../pages/RepairTab")),
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
    tab: "QUẢN LÝ KHÁCH HÀNG",
    component: lazy(() => import("../modules/customer-management/CustomerManagementTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.some((permission) => permission === "customer:read" || permission === "customer:manage")),
  },
  {
    tab: "BÁN LẺ",
    component: lazy(() => import("../modules/retail/RetailTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.some((permission) => permission === "retail:read" || permission === "retail:manage")),
  },
  {
    tab: "ĐỐI TÁC BÁN LẺ",
    component: lazy(() => import("../modules/retail/pages/RetailPartnersPage")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" || userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.some((permission) =>
        ["retail-partner:read", "retail-partner:manage", "retail-partner-policy:manage", "retail-partner-self:read"].includes(permission))),
  },
  {
    tab: "TÀI CHÍNH",
    component: lazy(() => import("../modules/finance/FinanceTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(userProfile.permissions?.includes("*") || userProfile.permissions?.some((permission) => ["finance-wallet:read", "finance-wallet:manage", "finance-receivable:read", "finance-receivable:manage", "asset:read", "asset:manage"].includes(permission))),
  },
  {
    tab: "MARKETING",
    component: lazy(() => import("../modules/marketing/MarketingTab")),
    canAccess: (userProfile) =>
      userProfile.role === "superadmin" ||
      userProfile.role === "admin" ||
      Boolean(
        userProfile.permissions?.includes("*") ||
          userProfile.permissions?.some((permission) => permission === "marketing:read" || permission === "marketing:manage"),
      ),
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
];

export const DEFAULT_APP_TAB: TabType = "TỔNG QUAN";

export function getRouteByTab(tab: TabType) {
  return APP_ROUTES.find((route) => route.tab === tab) || APP_ROUTES[0];
}
