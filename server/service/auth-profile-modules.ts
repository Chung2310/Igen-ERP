import { type ModuleKey } from "../config/module-keys";
import { filterModulesForBusinessType, resolveBusinessType, type BusinessType } from "../config/business-types";

/** Normalize tenant module data before exposing it in an authenticated profile. */
export function resolveProfileEnabledModules(input: unknown, businessTypeInput?: unknown, legacyPreset?: unknown): ModuleKey[] {
  return filterModulesForBusinessType(input, resolveBusinessType(businessTypeInput, legacyPreset));
}

export function resolveProfileBusinessType(input: unknown, legacyPreset?: unknown): BusinessType {
  return resolveBusinessType(input, legacyPreset);
}
