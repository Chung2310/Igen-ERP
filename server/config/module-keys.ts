/** Các nghiệp vụ có thể bật/tắt theo doanh nghiệp. Đồng bộ với src/config/modules.ts. */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student", "worker", "customer", "candidate", "partner", "retail", "finance"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const DEFAULT_MODULE_KEYS = MODULE_KEYS.filter((key) => key !== "retail" && key !== "finance") as Exclude<ModuleKey, "retail" | "finance">[];

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(v);
}

/**
 * Lọc input từ client thành danh sách key hợp lệ, bỏ trùng.
 * Rỗng/không hợp lệ → bật tất cả.
 */
export function sanitizeModuleKeys(input: unknown): ModuleKey[] {
  if (!Array.isArray(input)) return [...DEFAULT_MODULE_KEYS];
  const cleaned = [...new Set(input.filter((v): v is ModuleKey => isModuleKey(v)))];
  return cleaned.length === 0 ? [...DEFAULT_MODULE_KEYS] : cleaned;
}
