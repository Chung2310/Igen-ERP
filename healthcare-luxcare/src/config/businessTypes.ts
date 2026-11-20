import type { ModuleKey } from "./modules";
export const BUSINESS_TYPES = ["service", "recruitment", "general"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const DEFAULT_BUSINESS_TYPE: BusinessType = "general";
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  service: "Dịch vụ",
  recruitment: "Tuyển dụng",
  general: "Tổng quát",
};
const BUSINESS_MODULES = new Set<ModuleKey>([]);
export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}
export function resolveBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : DEFAULT_BUSINESS_TYPE;
}
export function getRequiredBusinessModule(_type: BusinessType): ModuleKey | null {
  return null;
}
export function isModuleAllowedForBusinessType(key: ModuleKey, _type: BusinessType): boolean {
  return true;
}
