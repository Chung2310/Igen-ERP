export type BusinessModuleKey = "student" | "worker" | "customer" | "candidate";

export function canReadBusinessModule(permissions: readonly string[], module: BusinessModuleKey): boolean {
  return permissions.includes("*") || permissions.includes(`${module}:read`) || permissions.includes(`${module}:manage`);
}

export function canManageBusinessModule(permissions: readonly string[], module: BusinessModuleKey): boolean {
  return permissions.includes("*") || permissions.includes(`${module}:manage`);
}
