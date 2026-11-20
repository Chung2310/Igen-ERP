export function isSuperAdminPath(pathname: string): boolean {
  const normalized = pathname.trim().toLowerCase().replace(/\/+$/, "") || "/";
  return normalized === "/super-admin";
}
