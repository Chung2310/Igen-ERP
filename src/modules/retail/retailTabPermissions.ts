export type RetailTabSlug = "bao-hanh" | "ban-hang" | "don-hang" | "doi-tra" | "ca-ban-hang" | "hoa-don" | "bao-cao" | "tai-chinh" | "uu-dai" | "cai-dat";

const OPERATIONAL_TABS: RetailTabSlug[] = ["bao-hanh", "ban-hang", "don-hang", "doi-tra", "ca-ban-hang", "hoa-don", "bao-cao"];
// These tabs have no data-changing workflow; the other retail tabs require retail:manage.
const READ_SAFE_TABS: RetailTabSlug[] = ["bao-hanh", "hoa-don", "bao-cao"];

export function getAllowedRetailTabSlugs(permissions: readonly string[] = []): RetailTabSlug[] {
  const granted = new Set(permissions);
  if (granted.has("*")) return [...OPERATIONAL_TABS, "tai-chinh", "uu-dai", "cai-dat"];
  if (granted.has("retail:manage")) return [...OPERATIONAL_TABS, "tai-chinh", ...(granted.has("retail-coupon:manage") && granted.has("retail-points:manage") ? ["uu-dai" as const] : []), "cai-dat"];
  if (granted.has("retail:read")) return READ_SAFE_TABS;
  return [];
}
