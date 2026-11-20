import type { SubTabRouteMap } from "../hooks/useSubTabRouter";
import type { TabType, HRSubTabType, ResourceSubTabType } from "../types";

export type SettingsSubTabType =
  | "profile"
  | "security"
  | "company-drive"
  | "smtp"
  | "face-recognition"
  | "branches";

// Nguồn slug ?sub= duy nhất cho toàn app — các trang và điều hướng toàn cục
// (handleSearchNavigation) đều dùng chung để không bao giờ lệch nhau.
export const HR_SUB_TAB_ROUTES: SubTabRouteMap<HRSubTabType> = [
  { slug: "tuyen-dung", value: "TUYỂN DỤNG" },
  { slug: "email-chuc-mung", value: "EMAIL CHÚC MỪNG" as HRSubTabType },
  { slug: "so-do", value: "SƠ ĐỒ TỔ CHỨC" },
  { slug: "phong-ban", value: "PHÒNG BAN" },
  { slug: "kanban", value: "Giao Việc" },
  { slug: "dao-tao", value: "ĐÀO TẠO" },
  { slug: "quy-trinh", value: "QUY TRÌNH" },
  { slug: "lich", value: "LỊCH" },
  { slug: "payroll", value: "PAYROLL" },
  { slug: "hop-dong", value: "HỢP ĐỒNG" },
  { slug: "van-bang-chung-chi", value: "VĂN BẰNG & CHỨNG CHỈ" },
  { slug: "ca-gio-lam", value: "CA & GIỜ LÀM VIỆC" },
  { slug: "ca-lam-viec", value: "CA & GIỜ LÀM VIỆC" },
  { slug: "lich-nghi-le", value: "CA & GIỜ LÀM VIỆC" },
  { slug: "gio-lam-viec", value: "CA & GIỜ LÀM VIỆC" },
];

export const RESOURCE_SUB_TAB_ROUTES: SubTabRouteMap<ResourceSubTabType> = [
  { slug: "tai-lieu", value: "TÀI LIỆU KHÁC" },
  { slug: "google-drive", value: "GOOGLE DRIVE" },
];

export const SETTINGS_SUB_TAB_ROUTES: SubTabRouteMap<SettingsSubTabType> = [
  { slug: "ho-so", value: "profile" },
  { slug: "bao-mat", value: "security" },
  { slug: "google-drive", value: "company-drive" },
  { slug: "cau-hinh-email", value: "smtp" },
  { slug: "email", value: "smtp" },
  { slug: "smtp", value: "smtp" },
  { slug: "cau-hinh", value: "smtp" },
  { slug: "nhan-dien-khuon-mat", value: "face-recognition" },
  { slug: "chi-nhanh", value: "branches" },
];

const SUB_TAB_ROUTES_BY_TAB: Partial<Record<TabType, SubTabRouteMap<string>>> = {
  "NHÂN SỰ": HR_SUB_TAB_ROUTES,
  "QUẢN LÝ TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "CÀI ĐẶT": SETTINGS_SUB_TAB_ROUTES,
};

/** Tra slug ?sub= cho một sub-tab; trả "" nếu tab/sub-tab không có slug. */
export function subTabToSlug(tab: TabType, subTab: string): string {
  const routes = SUB_TAB_ROUTES_BY_TAB[tab];
  return routes?.find((entry) => entry.value === subTab)?.slug || "";
}
