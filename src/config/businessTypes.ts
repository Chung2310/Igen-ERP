import type { ModuleKey } from "./modules";

export const BUSINESS_TYPES = ["education", "labor"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const DEFAULT_BUSINESS_TYPE: BusinessType = "education";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  education: "Giáo dục",
  labor: "Lao động",
};

const REQUIRED_BUSINESS_MODULE: Record<BusinessType, ModuleKey | null> = {
  education: "student",
  labor: "worker",
};

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

export function resolveBusinessType(value: unknown): BusinessType {
  return isBusinessType(value) ? value : DEFAULT_BUSINESS_TYPE;
}

export function getRequiredBusinessModule(type: BusinessType): ModuleKey | null {
  return REQUIRED_BUSINESS_MODULE[type];
}

export function isModuleAllowedForBusinessType(_key: ModuleKey, _type: BusinessType): boolean {
  const required = getRequiredBusinessModule(_type);
  return _key !== "student" && _key !== "worker" || _key === required;
}
