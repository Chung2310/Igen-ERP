export function normalizePhone(rawPhone: string): string {
  let cleaned = String(rawPhone || "").trim().replace(/[\s.-]/g, "");
  if (cleaned.startsWith("+84")) {
    cleaned = "0" + cleaned.slice(3);
  }
  return cleaned;
}
