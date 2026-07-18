export function requiresSuperAdminChallenge(role: string | undefined): boolean {
  return role === "superadmin";
}
