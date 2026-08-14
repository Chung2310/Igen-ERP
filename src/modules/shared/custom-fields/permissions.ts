export function canManageCustomFields(permissions?: readonly string[] | null): boolean {
  return Boolean(permissions?.includes("*") || permissions?.includes("settings:manage"));
}
