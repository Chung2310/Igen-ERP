import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { RetailCashVoucherModel } from "../models/retail-cash-voucher.model";
import { RetailCommissionLedgerModel } from "../models/retail-commission.model";
import { assertCashRange } from "./retail-cashbook.service";

type ProfitLine = { sourceKey: string; businessDate: string; branchId: string; orderCode: string; productId: string; sku: string; productName: string; quantity: number; revenue: number; cost: number | null; grossProfit: number | null; warning?: string };
const round = (value: number) => Math.round(value);
const vietnamDate = (value: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export function buildProfitLines(orders: any[], returns: any[], from = "0000-01-01", to = "9999-12-31"): ProfitLine[] {
  const lines: ProfitLine[] = [];
  const orderById = new Map(orders.map((order) => [String(order._id), order]));
  for (const order of orders) {
    if (order.status === "draft" || order.businessDate < from || order.businessDate > to) continue;
    const subtotal = Number(order.subtotal || 0), discount = Number(order.orderDiscount || 0);
    for (const [index, item] of (order.items || []).entries()) {
      const quantity = Number(item.quantity || 0), allocatedDiscount = subtotal > 0 ? round(discount * Number(item.lineTotal || 0) / subtotal) : 0;
      const revenue = Number(item.lineTotal || 0) - allocatedDiscount;
      const rawCost = Number(item.unitCost);
      const missingCost = !Number.isFinite(rawCost) || rawCost <= 0;
      const cost = missingCost ? null : round(quantity * rawCost);
      const warning = missingCost ? "Thiếu giá vốn" : revenue < cost! ? "Bán dưới giá vốn" : undefined;
      lines.push({ sourceKey: `order:${order._id}:line:${index}`, businessDate: order.businessDate, branchId: order.branchId, orderCode: order.orderCode, productId: item.productId, sku: item.sku, productName: item.productName, quantity, revenue, cost, grossProfit: cost === null ? null : revenue - cost, warning });
    }
  }
  for (const doc of returns.filter((item) => item.type === "return" && item.businessDate >= from && item.businessDate <= to)) {
    const order = orderById.get(String(doc.orderId));
    if (!order) continue;
    for (const item of doc.items || []) {
      const original = order.items[item.orderLineIndex];
      const rawCost = Number(item.unitCost), cost = Number.isFinite(rawCost) && rawCost > 0 ? -round(Number(item.quantity) * rawCost) : null;
      const revenue = -Number(item.lineAmount || 0);
      lines.push({ sourceKey: `return:${doc._id}:line:${item.orderLineIndex}`, businessDate: doc.businessDate, branchId: doc.branchId, orderCode: doc.code, productId: original?.productId || item.productId, sku: item.sku, productName: item.productName, quantity: -Number(item.quantity), revenue, cost, grossProfit: cost === null ? null : revenue - cost, warning: cost === null ? "Thiếu giá vốn" : undefined });
    }
  }
  for (const order of orders.filter((item) => item.status === "cancelled" && item.cancelledAt && vietnamDate(item.cancelledAt) >= from && vietnamDate(item.cancelledAt) <= to)) {
    const subtotal = Number(order.subtotal || 0), businessDate = vietnamDate(order.cancelledAt);
    for (const [index, item] of (order.items || []).entries()) {
      const returned = returns.filter((doc) => doc.type === "return" && String(doc.orderId) === String(order._id)).flatMap((doc) => doc.items || []).filter((returnedItem) => returnedItem.orderLineIndex === index);
      const remainingQuantity = Math.max(0, Number(item.quantity || 0) - returned.reduce((sum, part) => sum + Number(part.quantity || 0), 0));
      const originalRevenue = Number(item.lineTotal || 0) - (subtotal ? round(Number(order.orderDiscount || 0) * Number(item.lineTotal || 0) / subtotal) : 0);
      const remainingRevenue = Math.max(0, originalRevenue - returned.reduce((sum, part) => sum + Number(part.lineAmount || 0), 0));
      if (!remainingQuantity && !remainingRevenue) continue;
      const unitCost = Number(item.unitCost), cost = unitCost > 0 ? -round(remainingQuantity * unitCost) : null, revenue = -remainingRevenue;
      lines.push({ sourceKey: `cancel:${order._id}:line:${index}`, businessDate, branchId: order.branchId, orderCode: order.orderCode, productId: item.productId, sku: item.sku, productName: item.productName, quantity: -remainingQuantity, revenue, cost, grossProfit: cost === null ? null : revenue - cost, warning: cost === null ? "Thiếu giá vốn" : undefined });
    }
  }
  return lines;
}
export async function retailProfitReport(scope: RetailBranchScope, from: string, to: string, query: any = {}) {
  assertCashRange(from, to);
  const periodReturns = await RetailAfterSaleModel.find({ ...scope, businessDate: { $gte: from, $lte: to }, type: "return" }).lean();
  const cancelledFrom = new Date(Date.parse(`${from}T00:00:00Z`) - 86400000), cancelledTo = new Date(Date.parse(`${to}T23:59:59Z`) + 86400000);
  const orders = await RetailOrderModel.find({ ...scope, $or: [{ businessDate: { $gte: from, $lte: to }, status: { $in: ["confirmed", "completed", "cancelled"] } }, { _id: { $in: periodReturns.map((doc) => doc.orderId) } }, { status: "cancelled", cancelledAt: { $gte: cancelledFrom, $lte: cancelledTo } }] }).lean();
  const returns = await RetailAfterSaleModel.find({ ...scope, type: "return", orderId: { $in: orders.map((order) => String(order._id)) } }).lean();
  const filter = String(query.sku || "").trim();
  const lines = buildProfitLines(orders, returns, from, to).filter((line) => !filter || line.sku === filter);
  const revenue = lines.reduce((sum, line) => sum + line.revenue, 0);
  const knownCost = lines.reduce((sum, line) => sum + (line.cost || 0), 0);
  const missingCostCount = lines.filter((line) => line.cost === null).length;
  const grossProfit = missingCostCount ? null : revenue - knownCost;
  const expenses = await RetailCashVoucherModel.find({ ...scope, businessDate: { $gte: from, $lte: to }, direction: "out", profitCategory: "expense" }).lean();
  const operatingExpense = expenses.reduce((sum, voucher) => sum + Number(voucher.amount || 0), 0);
  const commission = await RetailCommissionLedgerModel.find({ ...scope, businessDate: { $gte: from, $lte: to } }).lean();
  const commissionExpense = commission.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const groups = new Map<string, { productId: string; sku: string; productName: string; quantity: number; revenue: number; cost: number; missingCostCount: number }>();
  for (const line of lines) { const key = `${line.productId}:${line.sku}`, group = groups.get(key) || { productId: line.productId, sku: line.sku, productName: line.productName, quantity: 0, revenue: 0, cost: 0, missingCostCount: 0 }; group.quantity += line.quantity; group.revenue += line.revenue; group.cost += line.cost || 0; group.missingCostCount += line.cost === null ? 1 : 0; groups.set(key, group); }
  return { from, to, summary: { revenue, knownCost, grossProfit, operatingExpense, commissionExpense, netProfit: grossProfit === null ? null : grossProfit - operatingExpense - commissionExpense, missingCostCount, belowCostCount: lines.filter((line) => line.warning === "Bán dưới giá vốn").length }, bySku: [...groups.values()].map((group) => ({ ...group, grossProfit: group.missingCostCount ? null : group.revenue - group.cost })), lines };
}
