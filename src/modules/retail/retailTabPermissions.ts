export type RetailTabSlug = "bao-hanh" | "ban-hang" | "don-hang" | "doi-tra" | "hoa-don" | "bao-cao" | "ca-pos" | "cai-dat" | "ma-uu-dai" | "tai-chinh" | "uu-dai";

const OPERATIONAL_TABS: RetailTabSlug[] = ["ban-hang", "don-hang", "doi-tra", "hoa-don", "bao-cao", "ca-pos"];
// These tabs have no data-changing workflow; the other retail tabs require retail:manage.
const READ_SAFE_TABS: RetailTabSlug[] = ["bao-hanh", "doi-tra", "hoa-don", "bao-cao"];

export function getAllowedRetailTabSlugs(permissions: readonly string[] = []): RetailTabSlug[] {
  const granted = new Set(permissions);
  if (granted.has("*")) return [...OPERATIONAL_TABS, "bao-hanh", "ma-uu-dai", "tai-chinh", "uu-dai", "cai-dat"];
  if (granted.has("retail:manage")) return [...OPERATIONAL_TABS, "bao-hanh", "ma-uu-dai", "tai-chinh", ...(granted.has("retail-coupon:manage") && granted.has("retail-points:manage") ? ["uu-dai" as const] : []), "cai-dat"];
  if (granted.has("retail:read")) return READ_SAFE_TABS;
  return [];
}
