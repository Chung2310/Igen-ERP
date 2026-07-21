export function canManageCustomFields(role?: string | null): boolean {
  return role === "superadmin" || role === "admin" || role === "manager";
}
