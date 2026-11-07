import type { AcceptanceRecord, Contract, Quote, QuoteLine, QuoteStatus } from "./types";

export type QuotationOverview = {
  from: string;
  to: string;
  quotes: {
    total: number;
    byStatus: Record<QuoteStatus, number>;
    byKind: { customer: number; estimate: number };
    values: Array<{ currency: string; customer: number; estimate: number; approvedCustomer: number; approvedEstimate: number }>;
    trend: Array<{ date: string; count: number; approved: number }>;
    customers: Array<{ name: string; count: number }>;
    products: Array<{ name: string; quantity: number }>;
  };
  contracts: { total: number; draft: number; signed: number } | null;
  acceptances: { total: number; draft: number; completed: number } | null;
};

type QuoteOverviewRow = Pick<Quote, "kind" | "status" | "total" | "totalUnknown" | "currency" | "customerName" | "createdAt"> & { lines?: Array<Pick<QuoteLine, "name" | "quantity" | "unit">> };
type ContractOverviewRow = Pick<Contract, "status">;
type AcceptanceOverviewRow = Pick<AcceptanceRecord, "status">;

const dateKey = (value: Date | string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

export function summarizeQuotationOverview(
  from: string,
  to: string,
  quotes: QuoteOverviewRow[],
  contracts: ContractOverviewRow[] | null,
  acceptances: AcceptanceOverviewRow[] | null,
): QuotationOverview {
  const byStatus: Record<QuoteStatus, number> = { draft: 0, needs_info: 0, pending_review: 0, approved: 0, rejected: 0 };
  const byKind = { customer: 0, estimate: 0 };
  const valueMap = new Map<string, { customer: number; estimate: number; approvedCustomer: number; approvedEstimate: number }>();
  const trendMap = new Map<string, { count: number; approved: number }>();
  const customerMap = new Map<string, number>();
  const productMap = new Map<string, number>();
  for (const quote of quotes) {
    if (!(quote.status in byStatus)) continue;
    byStatus[quote.status] += 1;
    byKind[quote.kind === "customer" ? "customer" : "estimate"] += 1;
    const day = dateKey(quote.createdAt);
    const trend = trendMap.get(day) ?? { count: 0, approved: 0 };
    trend.count += 1;
    if (quote.status === "approved") trend.approved += 1;
    trendMap.set(day, trend);
    const customer = quote.customerName?.trim() || "Chưa có tên khách";
    customerMap.set(customer, (customerMap.get(customer) ?? 0) + 1);
    for (const line of quote.lines ?? []) {
      const name = line.name?.trim() ? `${line.name.trim()} · ${line.unit?.trim() || "đơn vị"}` : "";
      const quantity = Number(line.quantity);
      if (name && Number.isFinite(quantity) && quantity > 0) productMap.set(name, (productMap.get(name) ?? 0) + quantity);
    }
    const amount = Number(quote.total);
    if (!quote.totalUnknown && Number.isFinite(amount) && amount >= 0) {
      const currency = quote.currency?.trim().toUpperCase() || "VND";
      const values = valueMap.get(currency) ?? { customer: 0, estimate: 0, approvedCustomer: 0, approvedEstimate: 0 };
      const kind = quote.kind === "customer" ? "customer" : "estimate";
      values[kind] += amount;
      if (quote.status === "approved") values[kind === "customer" ? "approvedCustomer" : "approvedEstimate"] += amount;
      valueMap.set(currency, values);
    }
  }
  return {
    from, to,
    quotes: {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), byStatus, byKind,
      values: [...valueMap].map(([currency, value]) => ({ currency, ...value })).sort((a, b) => a.currency.localeCompare(b.currency)),
      trend: [...trendMap].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })),
      customers: [...customerMap].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi")).slice(0, 8).map(([name, count]) => ({ name, count })),
      products: [...productMap].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi")).slice(0, 8).map(([name, quantity]) => ({ name, quantity })),
    },
    contracts: contracts && { total: contracts.length, draft: contracts.filter(row => row.status === "draft").length, signed: contracts.filter(row => row.status === "signed").length },
    acceptances: acceptances && { total: acceptances.length, draft: acceptances.filter(row => row.status === "draft").length, completed: acceptances.filter(row => row.status === "completed").length },
  };
}
