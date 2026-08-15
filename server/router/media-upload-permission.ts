export function permissionForMediaUpload(sourceType: unknown): string {
  return String(sourceType || "").trim().toLowerCase() === "hr.kanban"
    ? "work:manage"
    : "resource:manage";
}
