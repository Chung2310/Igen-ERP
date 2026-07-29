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
  return ["student:read", "student:manage", `${area}:read`, `${area}:manage`]
    .some((code) => hasPermission(permissions, code));
}

export function canManageStudentArea(permissions: readonly string[], area: StudentPermissionArea) {
  if (CONFIGURATION_AREAS.has(area)) return hasPermission(permissions, `${area}:manage`);
  return ["student:manage", `${area}:manage`].some((code) => hasPermission(permissions, code));
}
