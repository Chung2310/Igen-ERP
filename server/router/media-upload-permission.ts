export function permissionForMediaUpload(sourceType: unknown): string | null {
  const normalized = String(sourceType || "").trim().toLowerCase();
  if (normalized === "settings.profile") return null;
  return normalized === "hr.kanban"
    ? "work:manage"
    : "resource:manage";
}
