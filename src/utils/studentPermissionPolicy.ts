export type StudentPermissionArea =
  | "student-profile"
  | "course"
  | "batch"
  | "exam"
  | "payment"
  | "student-notification"
  | "student-resource"
  | "classroom"
  | "assignment"
  | "student-quality"
  | "learning-roadmap"
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
  if (CONFIGURATION_AREAS.has(area)) return hasPermission(permissions, "settings:manage");
  // The student module has two umbrella permissions rather than area-specific permissions.
  return ["people:read", "people:manage", "people:manage"].some((code) => hasPermission(permissions, code));
}

export function canManageStudentArea(permissions: readonly string[], area: StudentPermissionArea) {
  if (CONFIGURATION_AREAS.has(area)) return hasPermission(permissions, "settings:manage");
  if (hasPermission(permissions, "people:manage")) return true;
  return ["assignment", "student-quality"].includes(area) && hasPermission(permissions, "people:manage");
}
