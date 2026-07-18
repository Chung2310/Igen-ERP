import { TabType } from "../types/common";
import { MODULE_KEYS, ModuleKey } from "../../server/config/module-keys";

export { MODULE_KEYS, type ModuleKey };

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "NHÂN SỰ",
  inventory: "KHO & SẢN PHẨM",
  resource: "QUẢN LÝ TÀI NGUYÊN",
  chat: "TRÒ CHUYỆN",
  student: "QUẢN LÝ HỌC VIÊN",
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
 * Thiếu dữ liệu (company cũ) → bật tất cả.
 */
export function isModuleEnabled(enabledModules: string[] | undefined, key: ModuleKey): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

/**
 * Kiểm tra xem tab có bị ẩn (module chưa bật) không.
 * TODO: Kết nối với context công ty để lấy enabledModules.
 */
export function isTabHidden(tab: TabType): boolean {
  // For now, no tabs are hidden. This will be implemented in a future task
  // when we have access to the company's enabledModules.
  return false;
}
