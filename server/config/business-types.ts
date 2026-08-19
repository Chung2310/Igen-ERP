import { sanitizeModuleKeys, type ModuleKey } from "./module-keys";

export const BUSINESS_TYPES = ["education", "labor"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const DEFAULT_BUSINESS_TYPE: BusinessType = "education";

const LEGACY_PRESET_BUSINESS_TYPE: Record<string, BusinessType> = {
  student: "education",
  worker: "labor",
  customer: "education",
  candidate: "education",
};

const REQUIRED_BUSINESS_MODULE: Record<BusinessType, ModuleKey | null> = {
  education: "student",
  labor: "worker",
};

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

export function resolveBusinessType(input: unknown, legacyPreset?: unknown): BusinessType {
  if (isBusinessType(input)) return input;
  if (typeof legacyPreset === "string" && LEGACY_PRESET_BUSINESS_TYPE[legacyPreset]) {
    return LEGACY_PRESET_BUSINESS_TYPE[legacyPreset];
  }
  return DEFAULT_BUSINESS_TYPE;
}

export function getRequiredBusinessModule(businessType: BusinessType): ModuleKey | null {
  return REQUIRED_BUSINESS_MODULE[businessType];
}

export function filterModulesForBusinessType(input: unknown, _businessType: BusinessType): ModuleKey[] {
  return sanitizeModuleKeys(input);
}
