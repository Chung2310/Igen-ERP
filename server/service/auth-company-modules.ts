import { type ModuleKey } from "../config/module-keys";
import { filterModulesForBusinessType, resolveBusinessType } from "../config/business-types";

export function resolveCompanyModuleUpdate(updateData: { enabledModules?: unknown; businessType?: unknown; legacyEntityPreset?: unknown; [key: string]: unknown }): ModuleKey[] | undefined {
  if (updateData.enabledModules === undefined) return undefined;
  return filterModulesForBusinessType(updateData.enabledModules, resolveBusinessType(updateData.businessType, updateData.legacyEntityPreset));
}
