import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { RetailAfterSaleModel } from "../../retail/models/retail-after-sale.model";
import { ReceivableEntryModel } from "../models/receivable-entry.model";
import { FinanceDebtModel } from "../models/financial-reporting.model";
import { FinanceCashVoucherModel } from "../models/finance-treasury.model";
import { RetailCommissionPayoutModel } from "../../retail/models/retail-commission.model";
import { PayrollPaymentModel } from "../../../model/payroll-payment.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import type { FinanceBranchScope } from "../contracts";
import { financeToday } from "./financial-calculations";
import { verifiedRepairRefunds } from "../../repair/services/repair-refunds";
export type CashSource = { key: string; sourceType: string; sourceId: string; description: string; occurredOn: string; amount: number; method: string };
export async function financeCashSources(scope: FinanceBranchScope): Promise<CashSource[]> {
  const [orders, buybacks, debts, receivablePayments, payroll, commissions, receipts] = await Promise.all([
    RetailOrderModel.find({ ...scope, confirmedAt: { $exists: true } }).select("orderCode payments refunds").lean(),
    RetailAfterSaleModel.find({ ...scope, type: "buyback" }).select("code totalAmount paymentMethod createdAt").lean(),
    FinanceDebtModel.find({ ...scope, "payments.0": { $exists: true } }).select("reference direction payments").lean(),
    ReceivableEntryModel.find({ ...scope, type: { $in: ["payment", "refund", "reversal"] }, paymentMethod: { $ne: "retail" } }).lean(),
    PayrollPaymentModel.find({ ...scope, status: "confirmed", paymentDate: { $exists: true } }).lean(),
    RetailCommissionPayoutModel.find(scope).lean(),
    GoodsReceiptModel.find({ ...scope, status: "confirmed", "financeTerms.paidAmount": { $gt: 0 } }).lean(),
  ]);
  const result: CashSource[] = [];
  const push = (key: string, sourceType: string, sourceId: unknown, description: string, at: unknown, amount: number, method = "") => { if (at && Number.isSafeInteger(amount) && amount !== 0) result.push({ key, sourceType, sourceId: String(sourceId), description: description || `Giao dịch ${sourceType}`, occurredOn: financeToday(new Date(String(at))), amount, method }); };
  for (const order of orders) {
    (order.payments || []).forEach((p, i) => push(`retail:${order._id}:payment:${i}`, "retail", order._id, `Thu đơn ${order.orderCode}`, p.paidAt, p.amount, p.method));
    (order.refunds || []).forEach((p, i) => push(`retail:${order._id}:refund:${i}`, "retail", order._id, `Hoàn đơn ${order.orderCode}`, p.refundedAt, -p.amount, p.method));
  }
  for (const row of buybacks) push(`buyback:${row._id}`, "buyback", row._id, row.code, row.createdAt, -row.totalAmount, row.paymentMethod);
  for (const row of debts) for (const p of row.payments) push(`debt:${row._id}:${p.key}`, "debt", row._id, row.reference, p.at, row.direction === "receivable" ? p.amount : -p.amount);
  // A reversal of a charge/adjustment is not a cash flow; only cash-entry reversals qualify.
  const originalEntries = await ReceivableEntryModel.find({ ...scope, _id: { $in: receivablePayments.filter(p => p.type === "reversal" && p.reversalOfEntryId).map(p => p.reversalOfEntryId) } }).select("type paymentMethod").lean();
  for (const p of receivablePayments) {
    if (p.type === "reversal") { const original = originalEntries.find(e => String(e._id) === p.reversalOfEntryId); if (!original || !["payment", "refund"].includes(original.type) || original.paymentMethod === "retail") continue; }
    push(`receivable:${p._id}`, "receivable", p.receivableId, p.reference || "Thu/hoàn công nợ", p.createdAt, -p.amount, p.paymentMethod);
  }
  for (const p of payroll) push(`payroll:${p._id}`, "payroll", p._id, p.note || "Thanh toán lương", p.paymentDate, -p.amount);
  for (const p of commissions) push(`commission:${p._id}`, "commission", p._id, `Chi hoa hồng ${p.reference}`, `${p.businessDate}T12:00:00+07:00`, -p.amount, p.account);
  for (const receipt of receipts as any[]) push(`receipt-paid:${receipt._id}`, "goods-receipt", receipt._id, `Đã trả khi nhập ${receipt.receiptCode}`, receipt.confirmedAt, -receipt.financeTerms.paidAmount, receipt.financeTerms.paymentMethod);
  for (const row of await verifiedRepairRefunds(scope)) push(`repair-refund:${row._id}:${row.refund.key}`, "repair-refund", row._id, `Hoàn sửa chữa ${row.ticketCode}`, row.refund.at, -row.refund.amount);
  return result;
}
export async function unassignedCashSources(scope: FinanceBranchScope) {
  const [sources, vouchers] = await Promise.all([financeCashSources(scope), FinanceCashVoucherModel.find({ ...scope, sourceKey: { $exists: true } }).select("sourceKey").lean()]);
  const recorded = new Set(vouchers.map(v => v.sourceKey));
  return sources.filter(s => !recorded.has(s.key));
}
