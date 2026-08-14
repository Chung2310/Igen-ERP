export type RetailTabSlug = "ban-hang" | "don-hang" | "ca-ban-hang" | "hoa-don" | "bao-cao" | "khach-hang" | "cai-dat";

const OPERATIONAL_TABS: RetailTabSlug[] = ["ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "bao-cao", "khach-hang"];

export function getAllowedRetailTabSlugs(permissions: readonly string[] = []): RetailTabSlug[] {
  const granted = new Set(permissions);
  if (granted.has("*") || granted.has("retail:manage")) return [...OPERATIONAL_TABS, "cai-dat"];
  if (granted.has("retail:manage")) return OPERATIONAL_TABS;
  return [];
}
