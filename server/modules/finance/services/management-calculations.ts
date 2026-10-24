import { resolveSaleCost } from "./cost-resolution";
import { DEFAULT_FINANCE_REMINDER_SETTINGS } from "../config/finance-settings";
export const businessDay = (value: Date | string = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_FINANCE_REMINDER_SETTINGS.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86400000);
export function agingBand(due: string, today = businessDay()) {
    const days = daysBetween(due, today);
    return days <= 0 ? "not_due" : days <= 7 ? "1-7" : days <= 15 ? "8-15" : days <= 30 ? "16-30" : days <= 60 ? "31-60" : "over60";
}
export function breakEven(revenue: number, grossProfit: number | null, fixedCosts: number, variableCosts: number, elapsedDays: number, remainingDays: number) {
    const contribution = revenue > 0 && grossProfit !== null ? (grossProfit - variableCosts) / revenue : null;
    const requiredRevenue = contribution !== null && contribution > 0 ? Math.ceil(fixedCosts / contribution) : null;
    const remaining = requiredRevenue === null ? null : Math.max(0, requiredRevenue - revenue);
    return { contribution, requiredRevenue, remaining, progress: requiredRevenue === null ? null : requiredRevenue === 0 ? 100 : Math.min(100, revenue / requiredRevenue * 100), dailyNeeded: remaining === null ? null : remainingDays > 0 ? Math.ceil(remaining / remainingDays) : remaining === 0 ? 0 : null, projectedDays: remaining === null || revenue <= 0 ? null : Math.ceil(remaining / (revenue / Math.max(1, elapsedDays))) };
}
/** Allocate the order discount proportionally; preserve its exact integer total. */
export function saleLines(order: any, ledger: any[] = [], receipts: any[] = [], otherSales: any[] = [], acquisitions: any[] = []) {
    const items: any[] = order.items || [];
    const total = items.reduce((s, i) => s + i.lineTotal, 0);
    let allocated = 0;
    return items.map((item, index) => {
        const discount = index === items.length - 1 ? order.orderDiscount - allocated : total > 0 ? Math.round(order.orderDiscount * item.lineTotal / total) : 0;
        allocated += discount;
        const revenue = item.lineTotal - discount;
        const resolved = resolveSaleCost(order, item, index, ledger, receipts, otherSales, acquisitions);
        const cost = resolved.cost;
        return { ...item, orderId: String(order._id), orderCode: order.orderCode, branchId: order.branchId, salespersonName: order.salespersonName, salespersonId: order.salespersonId, date: order.businessDate, revenue, cost, grossProfit: cost === null ? null : revenue - cost, ...resolved };
    });
}
