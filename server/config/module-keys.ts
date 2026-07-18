/** Các nghiệp vụ có thể bật/tắt theo doanh nghiệp. Đồng bộ với src/config/modules.ts. */
export const MODULE_KEYS = ["hr", "inventory", "resource", "chat", "student"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export function isModuleKey(v: string): v is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(v);
}

/**
 * Lọc input từ client thành danh sách key hợp lệ, bỏ trùng.
 * Rỗng/không hợp lệ → bật tất cả.
 */
export function sanitizeModuleKeys(input: unknown): ModuleKey[] {
  if (!Array.isArray(input)) return [...MODULE_KEYS];
  const cleaned = [...new Set(input.filter((v): v is ModuleKey => isModuleKey(v)))];
  return cleaned.length === 0 ? [...MODULE_KEYS] : cleaned;
}
