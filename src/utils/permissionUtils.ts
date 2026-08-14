export interface PermissionDefinition {
  code: string;
  label: string;
  description?: string;
  group?: string;
}

/** @deprecated Permission metadata is supplied by the backend catalog. */
export const PERMISSION_TRANSLATIONS: Record<string, { label: string; group?: string; description?: string }> = {};

/** @deprecated Permission metadata is supplied by the backend catalog. */
export const DEFAULT_SYSTEM_PERMISSIONS: PermissionDefinition[] = [];

export function getPermissionLabel(code: string, fallbackName?: string): string {
  return fallbackName && fallbackName !== code ? fallbackName : code;
}

export function getPermissionDescription(_code: string, fallbackDesc?: string): string {
  return fallbackDesc || "";
}

export function getRoleDisplayName(role: string, customDisplayName?: string): string {
  if (customDisplayName && customDisplayName !== role) return customDisplayName;
  const roleMap: Record<string, string> = {
    superadmin: "Quản trị viên cấp cao",
    admin: "Quản trị viên doanh nghiệp",
    branch_owner: "Chủ chi nhánh",
    manager: "Quản lý",
    user: "Nhân viên",
    staff: "Nhân viên",
    teacher: "Giáo viên",
    accountant: "Kế toán",
  };
  return roleMap[role?.toLowerCase()] || role || "Nhân viên";
}
