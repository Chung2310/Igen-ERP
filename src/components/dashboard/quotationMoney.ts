import type { QuotationMoneyRow } from "./quotationOverviewService";

export type MoneyKind = "customer" | "estimate";

export function summarizeQuotationMoney(rows: QuotationMoneyRow[], currency: string) {
  const selectedCurrency = rows.filter(row => (row.currency?.trim().toUpperCase() || "VND") === currency);
  const known = selectedCurrency.filter(row => !row.totalUnknown && Number.isFinite(Number(row.total)) && Number(row.total) >= 0);
  const byKind = (kind: MoneyKind) => {
    const values = known.filter(row => (row.kind === "customer" ? "customer" : "estimate") === kind);
    const total = values.reduce((sum, row) => sum + Number(row.total), 0);
    const largest = [...values].sort((a, b) => Number(b.total) - Number(a.total))[0] ?? null;
    return { count: values.length, total, average: values.length ? total / values.length : null, largest };
  };
  const dayMap = new Map<string, { date: string; customer: number; estimate: number }>();
  for (const row of known) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.createdAt));
    const entry = dayMap.get(date) ?? { date, customer: 0, estimate: 0 };
    entry[row.kind === "customer" ? "customer" : "estimate"] += Number(row.total);
    dayMap.set(date, entry);
  }
  const top = [...known].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 5);
  return { customer: byKind("customer"), estimate: byKind("estimate"), top, trend: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)), unknownCount: selectedCurrency.filter(row => row.totalUnknown || !Number.isFinite(Number(row.total)) || Number(row.total) < 0).length };
}
