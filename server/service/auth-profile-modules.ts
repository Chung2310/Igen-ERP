import { sanitizeModuleKeys, type ModuleKey } from "../config/module-keys";

/** Normalize tenant module data before exposing it in an authenticated profile. */
export function resolveProfileEnabledModules(input: unknown): ModuleKey[] {
  return sanitizeModuleKeys(input);
}
