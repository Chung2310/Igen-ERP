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
  | "google-drive"
  | "face-recognition"
  | "branches";

// Nguồn slug ?sub= duy nhất cho toàn app — các trang và điều hướng toàn cục
// (handleSearchNavigation) đều dùng chung để không bao giờ lệch nhau.
export const HR_SUB_TAB_ROUTES: SubTabRouteMap<HRSubTabType> = [
  { slug: "tuyen-dung", value: "TUYỂN DỤNG" },
  { slug: "email-chuc-mung", value: "EMAIL CHÚC MỪNG" as HRSubTabType },
  { slug: "so-do", value: "SƠ ĐỒ TỔ CHỨC" },
  { slug: "kanban", value: "Giao Việc" },
  { slug: "dao-tao", value: "ĐÀO TẠO" },
  { slug: "quy-trinh", value: "QUY TRÌNH" },
  { slug: "lich", value: "LỊCH" },
  { slug: "don-tu", value: "ĐƠN TỪ" },
  { slug: "payroll", value: "PAYROLL" },
  { slug: "hop-dong", value: "HỢP ĐỒNG" },
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
  { slug: "nhan-dien-khuon-mat", value: "face-recognition" },
  { slug: "chi-nhanh", value: "branches" },
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
