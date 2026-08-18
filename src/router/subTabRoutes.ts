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
  { slug: "payroll", value: "PAYROLL" },
  { slug: "hop-dong", value: "HỢP ĐỒNG" },
];

export const INVENTORY_SUB_TAB_ROUTES: SubTabRouteMap<InventorySubTabType> = [
  { slug: "bao-hanh", value: "BẢO HÀNH" as InventorySubTabType },
  { slug: "sua-chua", value: "SỬA CHỮA" as InventorySubTabType },
  { slug: "san-pham", value: "SẢN PHẨM" },
  { slug: "kho-hang", value: "KHO HÀNG" },
  { slug: "nhap-hang", value: "NHẬP HÀNG" },
  { slug: "xuat-hang", value: "XUẤT HÀNG" },
  { slug: "giao-dich-kho", value: "GIAO DỊCH KHO" },
  { slug: "du-bao", value: "DỰ BÁO" },
  { slug: "imei-serial", value: "IMEI / SERIAL" },
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

export const STUDENT_SUB_TAB_ROUTES: SubTabRouteMap<string> = [
  { slug: "tong-quan", value: "TỔNG QUAN" },
  { slug: "khoa-hoc", value: "KHÓA HỌC" },
  { slug: "lop-hoc", value: "LỚP HỌC" },
  { slug: "chat-luong-hoc-vien", value: "CHẤT LƯỢNG HỌC VIÊN" },
  { slug: "hoc-vien", value: "HỌC VIÊN" },
  { slug: "hoc-phi", value: "HỌC PHÍ" },
  { slug: "lich-thi", value: "LỊCH THI" },
  { slug: "phong-hoc", value: "PHÒNG HỌC" },
  { slug: "tai-nguyen", value: "TÀI NGUYÊN" },
  { slug: "thong-bao", value: "THÔNG BÁO" },
  { slug: "bao-luu-hoc-lai", value: "BAO_LUU_HOC_LAI" },
  { slug: "lo-trinh-va-cho-lop", value: "LO_TRINH_CHO_LOP" },
];

const SUB_TAB_ROUTES_BY_TAB: Partial<Record<TabType, SubTabRouteMap<string>>> = {
  "NHÂN SỰ": HR_SUB_TAB_ROUTES,
  "KHO & SẢN PHẨM": INVENTORY_SUB_TAB_ROUTES,
  "QUẢN LÝ TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "TÀI NGUYÊN": RESOURCE_SUB_TAB_ROUTES,
  "QUẢN LÝ HỌC VIÊN": STUDENT_SUB_TAB_ROUTES,
  "CÀI ĐẶT": SETTINGS_SUB_TAB_ROUTES,
};

/** Tra slug ?sub= cho một sub-tab; trả "" nếu tab/sub-tab không có slug. */
export function subTabToSlug(tab: TabType, subTab: string): string {
  const routes = SUB_TAB_ROUTES_BY_TAB[tab];
  return routes?.find((entry) => entry.value === subTab)?.slug || "";
}
