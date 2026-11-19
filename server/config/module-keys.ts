/** Các nghiệp vụ có thể bật/tắt theo doanh nghiệp. Đồng bộ với src/config/modules.ts. */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student", "worker", "student-partner", "labor-partner", "customer", "partner", "retail", "retail-partner", "repair", "finance", "marketing", "social-marketing", "omni-inbox", "company-knowledge", "legal-reference", "quotation", "healthcare", "architect-assistant"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const DEFAULT_MODULE_KEYS = MODULE_KEYS.filter((key) => key !== "partner" && key !== "retail" && key !== "retail-partner" && key !== "finance" && key !== "marketing" && key !== "social-marketing" && key !== "omni-inbox" && key !== "company-knowledge" && key !== "legal-reference" && key !== "quotation" && key !== "healthcare" && key !== "architect-assistant");

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(v);
}

/**
 * Lọc input từ client thành danh sách key hợp lệ, bỏ trùng.
 * Rỗng/không hợp lệ → bật tất cả.
 */
export function sanitizeModuleKeys(input: unknown): ModuleKey[] {
  if (!Array.isArray(input)) return [...DEFAULT_MODULE_KEYS];
  const selected = new Set(input.filter((v): v is ModuleKey => isModuleKey(v)));
  if (selected.delete("partner")) {
    selected.add("student-partner");
    selected.add("labor-partner");
  }
  const cleaned = MODULE_KEYS.filter((key) => key !== "partner" && selected.has(key));
  return cleaned.length === 0 ? [...DEFAULT_MODULE_KEYS] : cleaned;
}
