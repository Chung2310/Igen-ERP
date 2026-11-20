import type { TabType } from "../types";
import { isModuleAllowedForBusinessType, resolveBusinessType } from "./businessTypes";

/** Đồng bộ với server/config/module-keys.ts */
export const MODULE_KEYS = ["hr", "resource", "chat", "equipment", "supply"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hr: "Nhân sự",
  resource: "Quản lý tài nguyên",
  chat: "Trò chuyện",
  equipment: "Quản lý thiết bị",
  supply: "Quản lý vật tư",
};

export const MODULE_TAB_MAP: Record<ModuleKey, TabType> = {
  hr: "NHÂN SỰ",
  resource: "QUẢN LÝ TÀI NGUYÊN",
  chat: "TRÒ CHUYỆN",
  equipment: "QUẢN LÝ THIẾT BỊ",
  supply: "QUẢN LÝ VẬT TƯ",
};

export const TAB_MODULE_MAP: Partial<Record<TabType, ModuleKey>> = {
  "NHÂN SỰ": "hr",
  "QUẢN LÝ TÀI NGUYÊN": "resource",
  "TRÒ CHUYỆN": "chat",
  "QUẢN LÝ THIẾT BỊ": "equipment",
  "QUẢN LÝ VẬT TƯ": "supply",
};

export const MODULE_READ_PERMISSIONS: Partial<Record<TabType, string[]>> = {
  "TỔNG QUAN": ["dashboard:read"],
  "NHÂN SỰ": ["hr:read", "user:read", "kanban:read", "project:read", "timekeeping:read"],
  "QUẢN LÝ TÀI NGUYÊN": ["resource:read"],
  "TRÒ CHUYỆN": ["chat:read"],
  "QUẢN LÝ THIẾT BỊ": ["equipment:read"],
  "QUẢN LÝ VẬT TƯ": ["supply:read"],
};

export const HIDDEN_TABS = new Set<TabType>();

export function isTabHidden(tab: TabType): boolean {
  return HIDDEN_TABS.has(tab);
}

export const HIDDEN_SETTINGS_SUBTABS = new Set<string>(["personal-integrations", "company-integrations"]);

export function isSettingsSubTabHidden(value: string): boolean {
  return HIDDEN_SETTINGS_SUBTABS.has(value);
}

export const HIDE_AI_AUTO_REPLY = true;

export function isModuleEnabled(enabledModules: string[] | undefined, key: ModuleKey): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(key);
}

export function filterEnabledTabs(
  tabs: TabType[],
  enabledModules: string[] | undefined,
  businessTypeInput?: unknown,
): TabType[] {
  const businessType = resolveBusinessType(businessTypeInput);
  return tabs.filter((tab) => {
    const moduleKey = TAB_MODULE_MAP[tab];
    return (
      !moduleKey ||
      (isModuleEnabled(enabledModules, moduleKey) && isModuleAllowedForBusinessType(moduleKey, businessType))
    );
  });
}

export function resolveEnabledTab(
  tab: TabType,
  enabledModules: string[] | undefined,
  businessTypeInput?: unknown,
): TabType {
  const moduleKey = TAB_MODULE_MAP[tab];
  const businessType = resolveBusinessType(businessTypeInput);
  return moduleKey &&
    (!isModuleEnabled(enabledModules, moduleKey) || !isModuleAllowedForBusinessType(moduleKey, businessType))
    ? "TỔNG QUAN"
    : tab;
}
