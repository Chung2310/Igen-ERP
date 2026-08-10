export type RetailTabSlug = "khach-hang" | "cai-dat";

export function getAllowedRetailTabSlugs(permissions: readonly string[] = []): RetailTabSlug[] {
  const granted = new Set(permissions);
  if (granted.has("*") || granted.has("retail:manager")) return ["khach-hang", "cai-dat"];
  if (granted.has("retail:operate")) return ["khach-hang"];
  return [];
}
