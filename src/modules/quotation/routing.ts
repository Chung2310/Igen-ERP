export type QuotationSection = "quotes" | "documents" | "budgetPlanner" | "customerQuotes" | "catalog" | "templates" | "profile";
const slugs: Record<QuotationSection, string> = { quotes: "du-toan", documents: "chung-tu", budgetPlanner: "ngan-sach", customerQuotes: "bao-gia-khach", catalog: "bang-gia", templates: "mau-tai-lieu", profile: "cai-dat" };
export function quotationUrl(section: QuotationSection, id?: string | null, view?: "contracts" | "acceptances") {
  const params = new URLSearchParams({ sub: slugs[section] });
  if (id) params.set("id", id);
  if (section === "documents") params.set("view", view === "acceptances" ? "nghiem-thu" : "hop-dong");
  return `/bao-gia?${params}`;
}
export function quotationRoute(_pathname = window.location.pathname, search = window.location.search) {
  const params = new URLSearchParams(search);
  const section = (Object.entries(slugs).find(([, slug]) => slug === params.get("sub"))?.[0] || "quotes") as QuotationSection;
  return { section, quoteId: /^[a-f\d]{24}$/i.test(params.get("id") || "") ? params.get("id") : null, documentView: params.get("view") === "nghiem-thu" ? "acceptances" as const : "contracts" as const };
}
export const quotationSectionPaths = Object.fromEntries(Object.keys(slugs).map(section => [section, quotationUrl(section as QuotationSection)])) as Record<QuotationSection, string>;
