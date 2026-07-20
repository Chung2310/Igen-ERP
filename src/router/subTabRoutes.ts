import type { SubTabRouteMap } from "../hooks/useSubTabRouter";
import type {
  TabType,
  HRSubTabType,
  InventorySubTabType,
  ResourceSubTabType,
} from "../types";

export type SettingsSubTabType =
  | "profile"
  | "security"
  | "erp"
  | "google-drive";

// Nguồn slug ?sub= duy nhất cho toàn app — các trang và điều hướng toàn cục
// (handleSearchNavigation) đều dùng chung để không bao giờ lệch nhau.
export const HR_SUB_TAB_ROUTES: SubTabRouteMap<HRSubTabType> = [
  { slug: "so-do", value: "SƠ ĐỒ TỔ CHỨC" },
  { slug: "kanban", value: "Giao Việc" },
  { slug: "dao-tao", value: "ĐÀO TẠO" },
  { slug: "quy-trinh", value: "QUY TRÌNH" },
  { slug: "lich", value: "LỊCH" },
];

export const INVENTORY_SUB_TAB_ROUTES: SubTabRouteMap<InventorySubTabType> = [
  { slug: "danh-muc", value: "DANH MỤC" },
  { slug: "phan-loai", value: "PHÂN LOẠI SẢN PHẨM" },
  { slug: "nhap-xuat", value: "NHẬP / XUẤT KHO" },
  { slug: "du-bao-ai", value: "DỰ BÁO AI" },
];

export const RESOURCE_SUB_TAB_ROUTES: SubTabRouteMap<ResourceSubTabType> = [
  { slug: "tai-lieu", value: "TÀI LIỆU KHÁC" },
  { slug: "google-drive", value: "GOOGLE DRIVE" },
];

export const SETTINGS_SUB_TAB_ROUTES: SubTabRouteMap<SettingsSubTabType> = [
  { slug: "ho-so", value: "profile" },
  { slug: "bao-mat", value: "security" },
  { slug: "cau-hinh", value: "erp" },
  { slug: "google-drive", value: "google-drive" },
];

const SUB_TAB_ROUTES_BY_TAB: Partial<Record<TabType, SubTabRouteMap<string>>> = {
  "NHÂN SỰ": HR_SUB_TAB_ROUTES,
  "KHO & SẢN PHẨM": INVENTORY_SUB_TAB_ROUTES,
  "QUẢN LÝ TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "CÀI ĐẶT": SETTINGS_SUB_TAB_ROUTES,
};

/** Tra slug ?sub= cho một sub-tab; trả "" nếu tab/sub-tab không có slug. */
export function subTabToSlug(tab: TabType, subTab: string): string {
  const routes = SUB_TAB_ROUTES_BY_TAB[tab];
  return routes?.find((entry) => entry.value === subTab)?.slug || "";
}
