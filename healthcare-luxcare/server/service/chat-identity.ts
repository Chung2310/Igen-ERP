export function getChatMemberId(userId: unknown): string {
  if (userId == null) return "";
  if (typeof userId === "object") {
    const value = userId as { _id?: unknown; uid?: unknown; toString?: () => string };
    const id = value._id ?? value.uid;
    if (id != null) return String(id);
    return typeof value.toString === "function" ? value.toString() : "";
  }
  return String(userId);
}
