import type { TabType } from "../types";

/**
 * Cấu hình ẩn tạm các module ở tầng UI (global — áp dụng cho mọi người dùng).
 * Đây là nguồn sự thật duy nhất: sidebar, router, cài đặt, header, dashboard đều
 * đọc từ đây. Muốn hiện lại module chỉ cần bỏ khỏi các tập hợp bên dưới.
 *
 * Lưu ý: chỉ ẩn giao diện — route BE và logic xử lý vẫn giữ nguyên.
 */
export const HIDDEN_TABS = new Set<TabType>(["MARKETING", "SALES CRM"]);

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
