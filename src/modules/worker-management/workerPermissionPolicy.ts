export type WorkerPermissionArea =
  | "worker-profile"
  | "project"
  | "group"
  | "notification"
  | "custom-field"
  | "student-profile"
  | "course"
  | "batch"
  | "exam"
  | "payment"
  | "student-notification"
  | "student-resource"
  | "assignment"
  | "student-settings"
  | "company-smtp";

const has = (permissions: readonly string[], code: string) =>
  permissions.includes("*") || permissions.includes(code);

export function canReadWorkerArea(permissions: readonly string[], _area: WorkerPermissionArea) {
  return has(permissions, "people:read") || has(permissions, "people:manage");
}

export function canManageWorkerArea(permissions: readonly string[], _area: WorkerPermissionArea) {
  return has(permissions, "people:manage");
}
