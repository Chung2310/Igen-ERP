import { MODULE_KEYS, type ModuleKey } from "../config/modules";

export type CompanyModulesUpdatedEvent = {
  companyCode: string;
  enabledModules: ModuleKey[];
};

export function normalizeCompanyModulesEvent(value: unknown): CompanyModulesUpdatedEvent | null {
  if (!value || typeof value !== "object") return null;
  const input = value as { companyCode?: unknown; enabledModules?: unknown };
  if (typeof input.companyCode !== "string" || !input.companyCode.trim() || !Array.isArray(input.enabledModules)) return null;

  const modules = input.enabledModules;
  const enabledModules = MODULE_KEYS.filter((key) => modules.includes(key));
  if (enabledModules.length === 0) return null;

  return { companyCode: input.companyCode.trim().toUpperCase(), enabledModules };
}
