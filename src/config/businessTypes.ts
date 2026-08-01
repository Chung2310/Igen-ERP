import type { ModuleKey } from "./modules";

export const BUSINESS_TYPES = ["education", "labor", "service", "recruitment", "general"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const DEFAULT_BUSINESS_TYPE: BusinessType = "general";

const REQUIRED_BUSINESS_MODULE: Record<BusinessType, ModuleKey | null> = {
  education: "student",
  labor: "worker",
  service: "customer",
  recruitment: "candidate",
  general: null,
};

const BUSINESS_MODULES = new Set<ModuleKey>(["student", "worker", "customer", "candidate"]);

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

export function resolveBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : DEFAULT_BUSINESS_TYPE;
}

export function getRequiredBusinessModule(type: BusinessType): ModuleKey | null {
  return REQUIRED_BUSINESS_MODULE[type];
}

export function isModuleAllowedForBusinessType(key: ModuleKey, type: BusinessType): boolean {
  const required = getRequiredBusinessModule(type);
  return !BUSINESS_MODULES.has(key) || key === required;
}
