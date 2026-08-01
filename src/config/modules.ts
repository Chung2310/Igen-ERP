import type { TabType } from "../types";

/** Đồng bộ với server/config/module-keys.ts */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Nhân sự",
  inventory: "Kho & Sản phẩm",
  resource: "Quản lý tài nguyên",
  chat: "Trò chuyện",
  student: "Quản lý học viên",
};

export const MODULE_TAB_MAP: Record<ModuleKey, TabType> = {
  hr: "NHÂN SỰ",
  inventory: "KHO & SẢN PHẨM",
  resource: "QUẢN LÝ TÀI NGUYÊN",
  chat: "TRÒ CHUYỆN",
  student: "QUẢN LÝ HỌC VIÊN",
};

export const TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>> = {
  "NHÂN SỰ": "hr",
  "KHO & SẢN PHẨM": "inventory",
  "QUẢN LÝ TÀI NGUYÊN": "resource",
  "TRÒ CHUYỆN": "chat",
  "QUẢN LÝ HỌC VIÊN": "student",
};

/**
 * Mã quyền tối thiểu (OR — có 1 trong danh sách là đủ) để user được coi là có quyền
 * truy cập tab, dùng để hiển thị khóa (Lock icon) trên sidebar khi module đã bật cho
 * công ty nhưng user cá nhân không được cấp quyền nào liên quan.
 */
export const MODULE_READ_PERMISSIONS: Partial<Record<TabType, string[]>> = {
  "NHÂN SỰ": ["hr:read", "user:read", "kanban:read", "project:read", "timekeeping:read"],
  "ĐỐI TÁC": ["partner:read"],
  "KHO & SẢN PHẨM": ["stock:read"],
  "QUẢN LÝ HỌC VIÊN": ["student:read", "student:manage"],
  "QUẢN LÝ TÀI NGUYÊN": ["resource:read"],
  "TRÒ CHUYỆN": ["chat:read"],
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
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

/** Keep permanent tabs and tenant modules that are enabled. */
export function filterEnabledTabs(tabs: TabType[], enabledModules: string[] | undefined): TabType[] {
  return tabs.filter((tab) => {
    const moduleKey = TAB_MODULE_MAP[tab];
    return !moduleKey || isModuleEnabled(enabledModules, moduleKey);
  });
}

/** Resolve direct navigation to a disabled module without rendering restricted content. */
export function resolveEnabledTab(tab: TabType, enabledModules: string[] | undefined): TabType {
  const moduleKey = TAB_MODULE_MAP[tab];
  return moduleKey && !isModuleEnabled(enabledModules, moduleKey) ? "TỔNG QUAN" : tab;
}
