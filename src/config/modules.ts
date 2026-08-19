import type { TabType } from "../types";
import { isModuleAllowedForBusinessType, resolveBusinessType } from "./businessTypes";

/** Đồng bộ với server/config/module-keys.ts */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student", "worker", "customer", "partner", "retail", "repair", "finance", "marketing"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const DEFAULT_MODULE_KEYS = MODULE_KEYS.filter((key) => key !== "retail" && key !== "finance" && key !== "marketing") as Exclude<ModuleKey, "retail" | "finance" | "marketing">[];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Nhân sự",
  inventory: "Kho & Sản phẩm",
  resource: "Quản lý tài nguyên",
  chat: "Trò chuyện",
  student: "Quản lý học viên",
  worker: "Quản lý lao động",
  customer: "Khách hàng",
  partner: "Quản lý đối tác",
  retail: "Bán lẻ & POS",
  repair: "Sửa chữa & bảo hành",
  finance: "Tài chính",
  marketing: "Marketing tự động",
};

export const MODULE_TAB_MAP: Record<ModuleKey, TabType> = {
  hr: "NHÂN SỰ",
  inventory: "KHO & SẢN PHẨM",
  resource: "QUẢN LÝ TÀI NGUYÊN",
  chat: "TRÒ CHUYỆN",
  student: "QUẢN LÝ HỌC VIÊN",
  worker: "QUẢN LÝ LAO ĐỘNG",
  customer: "QUẢN LÝ KHÁCH HÀNG",
  partner: "ĐỐI TÁC",
  retail: "BÁN LẺ",
  repair: "SỬA CHỮA & BẢO HÀNH",
  finance: "TÀI CHÍNH",
  marketing: "MARKETING",
};

export const TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>> = {
  "NHÂN SỰ": "hr",
  "KHO & SẢN PHẨM": "inventory",
  "SỬA CHỮA & BẢO HÀNH": "repair",
  "QUẢN LÝ TÀI NGUYÊN": "resource",
  "TRÒ CHUYỆN": "chat",
  "QUẢN LÝ HỌC VIÊN": "student",
  "QUẢN LÝ LAO ĐỘNG": "worker",
  "QUẢN LÝ KHÁCH HÀNG": "customer",
  "ĐỐI TÁC": "partner",
  "BÁN LẺ": "retail",
  "TÀI CHÍNH": "finance",
  "MARKETING": "marketing",
};

export const MODULE_OPTIONS = [
  { key: "hr", label: MODULE_LABELS.hr, moduleKeys: ["hr"] },
  { key: "inventory", label: MODULE_LABELS.inventory, moduleKeys: ["inventory"] },
  { key: "resource", label: MODULE_LABELS.resource, moduleKeys: ["resource"] },
  { key: "chat", label: MODULE_LABELS.chat, moduleKeys: ["chat"] },
  { key: "student-worker", label: "Quản lý học viên / lao động", moduleKeys: ["student", "worker"] },
  { key: "customer", label: MODULE_LABELS.customer, moduleKeys: ["customer"] },
  { key: "partner", label: MODULE_LABELS.partner, moduleKeys: ["partner"] },
  { key: "retail", label: MODULE_LABELS.retail, moduleKeys: ["retail"] },
  { key: "repair", label: MODULE_LABELS.repair, moduleKeys: ["repair"] },
  { key: "finance", label: MODULE_LABELS.finance, moduleKeys: ["finance"] },
  { key: "marketing", label: MODULE_LABELS.marketing, moduleKeys: ["marketing"] },
] as const satisfies ReadonlyArray<{ key: string; label: string; moduleKeys: readonly ModuleKey[] }>;

/**
 * Mã quyền tối thiểu (OR — có 1 trong danh sách là đủ) để user được coi là có quyền
 * truy cập tab, dùng để hiển thị khóa (Lock icon) trên sidebar khi module đã bật cho
 * công ty nhưng user cá nhân không được cấp quyền nào liên quan.
 */
export const MODULE_READ_PERMISSIONS: Partial<Record<TabType, string[]>> = {
  "TỔNG QUAN": ["dashboard:read"],
  "NHÂN SỰ": ["hr:read", "access:read", "work:read", "timekeeping:read"],
  "ĐỐI TÁC": ["relationship:read", "labor-partner:read"],
  "KHO & SẢN PHẨM": ["inventory:read"],
  "QUẢN LÝ HỌC VIÊN": ["people:read", "people:manage"],
  "QUẢN LÝ LAO ĐỘNG": ["people:read", "people:manage"],
  "QUẢN LÝ KHÁCH HÀNG": ["customer:read", "customer:manage"],
  "QUẢN LÝ TÀI NGUYÊN": ["resource:read"],
  "BÁN LẺ": ["retail:read", "retail:manage"],
  "TÀI CHÍNH": ["finance-wallet:read", "finance-wallet:manage", "finance-receivable:read", "finance-receivable:manage"],
  "TRÒ CHUYỆN": ["chat:read"],
  "MARKETING": ["marketing:read", "marketing:manage"],
};

/**
 * Cấu hình ẩn tạm các module ở tầng UI (global — áp dụng cho mọi người dùng).
 * Đây là nguồn sự thật duy nhất: sidebar, router, cài đặt, header, dashboard đều
 * đọc từ đây. Muốn hiện lại module chỉ cần bỏ khỏi các tập hợp bên dưới.
 *
 * Các mục dưới đây chỉ còn phục vụ tương thích URL/quyền cũ; module đã được gỡ khỏi router ứng dụng.
 */
export const HIDDEN_TABS = new Set<TabType>();

export function isTabHidden(tab: TabType): boolean {
  return HIDDEN_TABS.has(tab);
}

/**
 * Các sub-tab trong trang Cài đặt bị ẩn (giá trị `value` của sub-tab).
 * personal-integrations = "MXH Cá Nhân", company-integrations = "MXH Doanh nghiệp".
 */
export const HIDDEN_SETTINGS_SUBTABS = new Set<string>([
  "personal-integrations",
  "company-integrations",
]);

export function isSettingsSubTabHidden(value: string): boolean {
  return HIDDEN_SETTINGS_SUBTABS.has(value);
}

/** Ẩn khối cấu hình AI trả lời tự động (thuộc CRM omni-inbox) trong Cấu hình ERP */
export const HIDE_AI_AUTO_REPLY = true;

/**
 * Thiếu dữ liệu (company cũ) → bật tất cả.
 */
export function isModuleEnabled(enabledModules: string[] | undefined, key: ModuleKey): boolean {
  if (key === "retail" || key === "finance") return Boolean(enabledModules?.includes(key));
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

/** Keep permanent tabs and tenant modules that are enabled. */
export function filterEnabledTabs(tabs: TabType[], enabledModules: string[] | undefined, businessTypeInput?: unknown): TabType[] {
  const businessType = resolveBusinessType(businessTypeInput);
  return tabs.filter((tab) => {
    const moduleKey = TAB_MODULE_MAP[tab];
    return !moduleKey || (isModuleEnabled(enabledModules, moduleKey) && isModuleAllowedForBusinessType(moduleKey, businessType));
  });
}

/** Resolve direct navigation to a disabled module without rendering restricted content. */
export function resolveEnabledTab(tab: TabType, enabledModules: string[] | undefined, businessTypeInput?: unknown): TabType {
  const moduleKey = TAB_MODULE_MAP[tab];
  const businessType = resolveBusinessType(businessTypeInput);
  return moduleKey && (!isModuleEnabled(enabledModules, moduleKey) || !isModuleAllowedForBusinessType(moduleKey, businessType)) ? "TỔNG QUAN" : tab;
}
