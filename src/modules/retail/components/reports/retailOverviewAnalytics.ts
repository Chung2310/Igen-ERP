import type { RetailReport, RetailReportFilters } from "../../types";

export type RetailPeriod = "day" | "week" | "month" | "quarter" | "year";

export function salesChartPeriod(from: string, to: string, yearSelected = false): RetailPeriod {
  if (yearSelected) return "month";
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (!Number.isFinite(days) || days <= 31) return "day";
  if (days <= 180) return "week";
  if (days <= 400) return "month";
  return "quarter";
}

const asDate = (value: string) => new Date(`${value}T12:00:00Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export function previousRangeFilters(range: RetailReport["range"], filters: RetailReportFilters): RetailReportFilters & { from: string; to: string; preset?: never } {
  const days = Math.round((asDate(range.to).getTime() - asDate(range.from).getTime()) / 86_400_000) + 1;
  const previousTo = asDate(range.from);
  previousTo.setUTCDate(previousTo.getUTCDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days + 1);
  const { salespersonId, productId, sku, category, brand } = filters;
  return {
    from: isoDate(previousFrom), to: isoDate(previousTo),
    ...(salespersonId ? { salespersonId } : {}), ...(productId ? { productId } : {}),
    ...(sku ? { sku } : {}), ...(category ? { category } : {}), ...(brand ? { brand } : {}),
  };
}

export function comparison(current: number, previous: number | undefined) {
  if (previous === undefined) return null;
  const amount = current - previous;
  return { amount, percent: previous === 0 ? null : amount / Math.abs(previous) * 100 };
}

export function aggregateSales(rows: RetailReport["timeSeries"], period: RetailPeriod) {
  const grouped = new Map<string, { label: string; netSales: number; grossSales: number; refunds: number; collectedAmount: number; orderCount: number }>();
  for (const row of rows) {
    const date = asDate(row.businessDate);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    let key = row.businessDate;
    let label = `${row.businessDate.slice(8, 10)}/${row.businessDate.slice(5, 7)}`;
    if (period === "week") {
      const first = new Date(date);
      first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
      key = isoDate(first);
      label = `Tuần ${key.slice(8, 10)}/${key.slice(5, 7)}`;
    } else if (period === "month") { key = `${year}-${String(month).padStart(2, "0")}`; label = `${String(month).padStart(2, "0")}/${year}`; }
    else if (period === "quarter") { const quarter = Math.ceil(month / 3); key = `${year}-Q${quarter}`; label = `Q${quarter}/${year}`; }
    else if (period === "year") { key = String(year); label = String(year); }
    const group = grouped.get(key) || { label, netSales: 0, grossSales: 0, refunds: 0, collectedAmount: 0, orderCount: 0 };
    group.netSales += row.netSales;
    group.grossSales += row.grossSales;
    group.refunds += row.refunds;
    group.collectedAmount += row.collectedAmount;
    group.orderCount += row.orderCount;
    grouped.set(key, group);
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => ({ ...value, averageOrderValue: value.orderCount ? value.grossSales / value.orderCount : 0 }));
}

export function groupProducts(rows: RetailReport["products"], field: "category" | "brand") {
  const groups = new Map<string, { name: string; sales: number; quantity: number }>();
  for (const row of rows) {
    const name = row[field]?.trim() || (field === "brand" ? "Chưa có thương hiệu" : "Chưa phân loại");
    const item = groups.get(name) || { name, sales: 0, quantity: 0 };
    item.sales += row.netSales;
    item.quantity += row.netQuantity;
    groups.set(name, item);
  }
  return [...groups.values()].sort((a, b) => b.sales - a.sales);
}
