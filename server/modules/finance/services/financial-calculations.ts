export const DAY = 86400000;
export const financeToday = (now = new Date()) => new Date(+now + 7 * 3600000).toISOString().slice(0, 10);
export const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function validDay(value: unknown): string {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(+new Date(text)) || new Date(text).toISOString().slice(0, 10) !== text) throw invalid("Ngày không hợp lệ.");
  return text;
}
export function moneyInput(value: unknown, signed = false) {
  const n = Number(value);
  if (value === "" || value == null || !Number.isSafeInteger(n) || (!signed && n < 0) || Math.abs(n) > 1e14) throw invalid("Số tiền phải là số nguyên VND hợp lệ.");
  return n;
}
export function financeRange(query: any = {}, now = new Date()) {
  let from: string, to: string;
  const period = String(query.period || "");
  if (period) {
    if (!/^\d{4}(-\d{2}|-Q[1-4])?$/.test(period)) throw invalid("Kỳ báo cáo không hợp lệ.");
    const year = Number(period.slice(0, 4)), month = period.includes("Q") ? (Number(period.at(-1)) - 1) * 3 + 1 : Number(period.slice(5) || 1);
    if (year < 2000 || year > 2100) throw invalid("Năm báo cáo phải từ 2000 đến 2100.");
    from = validDay(`${year}-${String(month).padStart(2, "0")}-01`);
    const endMonth = period.includes("Q") ? month + 2 : period.length === 4 ? 12 : month;
    to = new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
  } else {
    from = validDay(query.from || financeToday(now).slice(0, 7) + "-01");
    to = validDay(query.to || financeToday(now));
  }
  if (from > to || +new Date(to) - +new Date(from) > 366 * 5 * DAY) throw invalid("Khoảng báo cáo không hợp lệ hoặc vượt quá 5 năm.");
  return { from, to, start: new Date(`${from}T00:00:00+07:00`), end: new Date(`${to}T23:59:59.999+07:00`) };
}
export function debtAging(dueOn: string | undefined, asOf: string) {
  if (!dueOn) return { daysOverdue: null, daysUntilDue: null, bucket: "unscheduled" };
  const difference = Math.round((+new Date(validDay(asOf)) - +new Date(validDay(dueOn))) / DAY);
  return { daysOverdue: Math.max(0, difference), daysUntilDue: -difference, bucket: difference < 0 ? "notDue" : difference === 0 ? "dueToday" : difference <= 30 ? "1-30" : difference <= 60 ? "31-60" : difference <= 90 ? "61-90" : "over90" };
}
export function vatTotals(rows: any[], openingCredit: number) {
  let inputVat = 0, outputVat = 0, deductibleVat = 0, inputBase = 0, outputBase = 0;
  for (const row of rows) {
    if (row.direction === "input") { inputVat += row.vatAmount; deductibleVat += row.deductibleVat; inputBase += row.taxableAmount; }
    else { outputVat += row.vatAmount; outputBase += row.taxableAmount; }
  }
  const net = outputVat - deductibleVat - openingCredit;
  return { inputBase, outputBase, inputVat, outputVat, deductibleVat, nonDeductibleVat: inputVat - deductibleVat, openingCredit, payable: Math.max(0, net), closingCredit: Math.max(0, -net) };
}
export type FinanceMovement = { date: string; source: string; sourceId?: string; composition?: { segment: string; quantity: number }[]; code: string; revenue: number; cost: number; units: number; grossProfit?: number };
export function profitTotals(movements: FinanceMovement[], expenses: Array<{ category: string; amount: number }>) {
  const sum = (key: "revenue" | "cost") => movements.reduce((total, row) => total + row[key], 0);
  const byCategory: Record<string, number> = {};
  for (const expense of expenses) byCategory[expense.category] = (byCategory[expense.category] || 0) + expense.amount;
  const revenue = sum("revenue"), costOfGoods = sum("cost"), grossProfit = revenue - costOfGoods;
  const expenseTotal = expenses.reduce((sum, row) => sum + row.amount, 0);
  return { revenue, costOfGoods, grossProfit, rent: byCategory.rent || 0, payroll: byCategory.payroll || 0, commission: byCategory.commission || 0, incomeTax: byCategory.income_tax || 0, otherExpenses: expenseTotal - (byCategory.rent || 0) - (byCategory.payroll || 0) - (byCategory.commission || 0) - (byCategory.income_tax || 0), expenseTotal, profitBeforeTax: grossProfit - expenseTotal + (byCategory.income_tax || 0), netProfit: grossProfit - expenseTotal, byCategory };
}
export function breakEven(plan: any, movements: FinanceMovement[], commission = 0) {
  const fixedCosts = Number(plan.rent || 0) + Number(plan.payroll || 0) + Number(plan.otherFixed || 0);
  const mix: any[] = plan.salesMix || [];
  const averagePrice = mix.length ? mix.reduce((sum, r) => sum + r.weight * r.price / 100, 0) : Number(plan.expectedUnitPrice || 0);
  const unitContribution = mix.length ? mix.reduce((sum, r) => sum + r.weight * (r.price - r.cost - r.variable - r.commission) / 100, 0) : Number(plan.expectedUnitPrice || 0) - Number(plan.expectedUnitCost || 0) - Number(plan.variableCostPerUnit || 0) - Number(plan.expectedCommissionPerUnit || 0);
  const contributionMargin = averagePrice > 0 ? unitContribution / averagePrice : null;
  const units = unitContribution > 0 ? Math.ceil(fixedCosts / unitContribution) : fixedCosts === 0 ? 0 : null;
  const revenue = contributionMargin && contributionMargin > 0 ? Math.ceil(fixedCosts / contributionMargin) : fixedCosts === 0 ? 0 : null;
  const daily = new Map<string, number>();
  for (const item of movements) { const variable = mix.length ? (item.composition || []).reduce((sum, c) => sum + c.quantity * Number(mix.find(r => r.segment === c.segment)?.variable || 0), 0) : item.units * Number(plan.variableCostPerUnit || 0); daily.set(item.date, (daily.get(item.date) || 0) + item.revenue - item.cost - variable); }
  // Include actual commissions at their posting dates as cost-only movements; scalar retained for callers without daily detail.
  let cumulative = -commission, firstReachedOn: string | null = null;
  const series = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => {
    cumulative += amount;
    if (!firstReachedOn && cumulative >= fixedCosts) firstReachedOn = date;
    return { date, contribution: amount, cumulative, remaining: Math.max(0, fixedCosts - cumulative) };
  });
  return { mixUnits: mix.map(r => ({ segment: r.segment, units: units == null ? null : Math.ceil(units * r.weight / 100) })), fixedCosts, unitContribution, contributionMargin, revenue, units, firstReachedOn, actualContribution: cumulative, currentlyReached: cumulative >= fixedCosts, remaining: Math.max(0, fixedCosts - cumulative), series };
}

/** Accounting movements retain original cost and place reversals on their actual dates. */
export function retailFinancialMovements(orders: any[], returns: any[], range: { from: string; to: string }) {
  const movements: FinanceMovement[] = [];
  const record = (date: unknown, source: string, code: string, revenue: number, cost: number, units = 0, sourceId?: string, composition: { segment: string; quantity: number }[] = []) => {
    if (!date) return;
    const day = financeToday(new Date(String(date)));
    if (day >= range.from && day <= range.to) movements.push({ date: day, source, sourceId, composition, code, revenue, cost, units, grossProfit: revenue - cost });
  };
  const segment = (item: any) => item?.trackingMode === "serial" || /điện thoại|phone/i.test(item?.category || "") ? "phone" : "accessory";
  const returnedComposition = new Map<string, { segment: string; quantity: number }[]>();
  const returned = new Map<string, { revenue: number; cost: number; units: number }>();
  for (const row of returns) {
    const order = orders.find(order => String(order._id) === String(row.orderId));
    if (!order) continue;
    const merchandiseGross = order.grandTotal - (order.shippingFee || 0);
    const revenue = Math.round(row.totalAmount * (merchandiseGross > 0 ? 1 - order.taxAmount / merchandiseGross : 1));
    const cost = row.items.reduce((sum: number, item: any) => sum + item.unitCost * item.quantity, 0);
    const units = row.items.reduce((sum: number, item: any) => { const original = order.items[item.orderLineIndex]; return sum + (original?.trackingMode === "serial" || /điện thoại|phone/i.test(original?.category || "") ? item.quantity : 0); }, 0);
    const composition = row.items.map((item: any) => ({ segment: segment(order.items[item.orderLineIndex]), quantity: -item.quantity }));
    record(row.createdAt, "return", row.code, -revenue, -cost, -units, String(row._id), composition);
    if (!order.cancelledAt || +new Date(row.createdAt) <= +new Date(order.cancelledAt)) {
      returnedComposition.set(String(order._id), [...(returnedComposition.get(String(order._id)) || []), ...composition]);
      const previous = returned.get(String(order._id)) || { revenue: 0, cost: 0, units: 0 };
      returned.set(String(order._id), { revenue: previous.revenue + revenue, cost: previous.cost + cost, units: previous.units + units });
    }
  }
  for (const order of orders) {
    if (!order.confirmedAt) continue;
    const net = order.grandTotal - order.taxAmount, shipping = Number(order.shippingFee || 0);
    const items = order.items || [];
    let allocated = 0, units = 0;
    const base = items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
    for (const [index, item] of items.entries()) {
      const revenue = index === items.length - 1 ? net - shipping - allocated : Math.round((net - shipping) * (base ? item.lineTotal / base : 1 / items.length));
      allocated += revenue;
      const quantity = item.trackingMode === "serial" || /điện thoại|phone/i.test(item.category || "") ? item.quantity : 0;
      units += quantity;
      record(order.confirmedAt, "retail", `${order.orderCode} · ${item.sku}`, revenue, item.unitCost * item.quantity, quantity, String(order._id), [{ segment: segment(item), quantity: item.quantity }]);
    }
    if (!items.length) record(order.confirmedAt, "retail", order.orderCode, net - shipping, order.totalCost, 0, String(order._id));
    if (shipping) record(order.confirmedAt, "shipping", order.orderCode, shipping, 0, 0, String(order._id));
    if (order.cancelledAt) {
      const prior = returned.get(String(order._id)) || { revenue: 0, cost: 0, units: 0 };
      record(order.cancelledAt, "cancellation", order.orderCode, -(net - prior.revenue), -(order.totalCost - prior.cost), -(units - prior.units), String(order._id), [...items.map((item: any) => ({ segment: segment(item), quantity: -item.quantity })), ...(returnedComposition.get(String(order._id)) || []).map(c => ({ ...c, quantity: -c.quantity }))]);
    }
  }
  return movements;
}
