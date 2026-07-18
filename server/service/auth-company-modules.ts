import { sanitizeModuleKeys, type ModuleKey } from "../config/module-keys";

export function resolveCompanyModuleUpdate(updateData: { enabledModules?: unknown; [key: string]: unknown }): ModuleKey[] | undefined {
  if (updateData.enabledModules === undefined) return undefined;
  return sanitizeModuleKeys(updateData.enabledModules);
}
