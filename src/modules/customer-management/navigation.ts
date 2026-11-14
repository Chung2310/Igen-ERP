import { tabToPath } from "../../seo/seo-config";

export type CustomerDetailSection = "module-links" | "lead-needs" | "purchases" | "repairs";

export function customerDetailHref(customerId: string, section?: CustomerDetailSection) {
  const params = new URLSearchParams({ customerId });
  if (section) params.set("section", section);
  return `${tabToPath("QUẢN LÝ KHÁCH HÀNG")}?${params}`;
}
