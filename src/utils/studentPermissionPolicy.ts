export type StudentPermissionArea =
  | "student-profile"
  | "course"
  | "batch"
  | "exam"
  | "payment"
  | "student-notification"
  | "student-resource"
  | "assignment"
  | "custom-field"
  | "student-settings"
  | "company-smtp";

const CONFIGURATION_AREAS = new Set<StudentPermissionArea>([
  "custom-field",
  "student-settings",
  "company-smtp",
]);

const hasPermission = (permissions: readonly string[], code: string) =>
  permissions.includes("*") || permissions.includes(code);

export function canReadStudentArea(permissions: readonly string[], area: StudentPermissionArea) {
  if (CONFIGURATION_AREAS.has(area)) return hasPermission(permissions, `${area}:manage`);
  // Module học viên/lao động chỉ còn hai mã quyền tổng, không còn mã theo từng khu vực.
  return ["student:read", "student:manage"].some((code) => hasPermission(permissions, code));
}

export function canManageStudentArea(permissions: readonly string[], area: StudentPermissionArea) {
  if (CONFIGURATION_AREAS.has(area)) return hasPermission(permissions, `${area}:manage`);
  return hasPermission(permissions, "student:manage");
}
