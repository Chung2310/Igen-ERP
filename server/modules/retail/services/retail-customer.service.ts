import { Types } from "mongoose";
import type { RetailScope, RetailBranchScope } from "../contracts";
import { RetailCustomerCounterModel } from "../models/retail-customer-counter.model";
import { RetailCustomerModel } from "../models/retail-customer.model";
import { RetailOrderModel } from "../models/retail-order.model";

type CustomerInput = { name?: unknown; phone?: unknown; email?: unknown; address?: unknown; notes?: unknown; [key: string]: unknown };
type CustomerActor = { id?: unknown; uid?: unknown; displayName?: unknown; email?: unknown };

const optional = (value: unknown) => {
  const parsed = String(value || "").trim();
  return parsed || undefined;
};

export function normalizeCustomerInput(input: CustomerInput) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Tên khách hàng là bắt buộc.");
  const phone = optional(input.phone);
  const normalizedPhone = phone?.replace(/\D/g, "") || undefined;
  return {
    name,
    phone,
    normalizedPhone,
    email: optional(input.email)?.toLowerCase(),
    address: optional(input.address),
    notes: optional(input.notes),
  };
}

export function formatRetailCustomerCode(companyCode: string, seq: number): string {
  return `KH-${companyCode.trim().toUpperCase()}-${String(seq).padStart(6, "0")}`;
}

export function customerCompanyFilter(scope: RetailScope): { companyCode: string } {
  return { companyCode: scope.companyCode };
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const RetailCustomerService = {
  async list(scope: RetailScope, query: { q?: unknown; page?: unknown; limit?: unknown }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const q = String(query.q || "").trim();
    const filter: Record<string, unknown> = customerCompanyFilter(scope);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ customerCode: pattern }, { name: pattern }, { phone: pattern }, { normalizedPhone: pattern }];
    }
    const [items, total] = await Promise.all([
      RetailCustomerModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      RetailCustomerModel.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async create(scope: RetailBranchScope, input: CustomerInput, actor: CustomerActor) {
    const values = normalizeCustomerInput(input);
    const counter = await RetailCustomerCounterModel.findOneAndUpdate(
      { companyCode: scope.companyCode }, { $inc: { seq: 1 } }, { new: true, upsert: true },
    ).lean();
    return RetailCustomerModel.create({
      ...values,
      customerCode: formatRetailCustomerCode(scope.companyCode, counter!.seq),
      companyCode: scope.companyCode,
      originBranchId: scope.branchId,
      createdBy: String(actor.id || actor.uid || ""),
      createdByName: String(actor.displayName || actor.email || ""),
    });
  },

  async update(scope: RetailScope, id: string, input: CustomerInput) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã khách hàng không hợp lệ.");
    const customer = await RetailCustomerModel.findOneAndUpdate(
      { _id: id, ...customerCompanyFilter(scope) }, { $set: normalizeCustomerInput(input) }, { new: true, runValidators: true },
    ).lean();
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    return customer;
  },

  async detail(scope: RetailScope, id: string, transactionBranchId?: string) {
    if (!Types.ObjectId.isValid(id)) throw new Error("Mã khách hàng không hợp lệ.");
    const customer = await RetailCustomerModel.findOne({ _id: id, ...customerCompanyFilter(scope) }).lean();
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    const orderFilter: Record<string, unknown> = { companyCode: scope.companyCode, customerId: id, status: { $ne: "draft" } };
    if (transactionBranchId) orderFilter.branchId = transactionBranchId;
    const orders = await RetailOrderModel.find(orderFilter).sort({ createdAt: -1 }).lean();
    const valid = orders.filter((order) => order.status !== "cancelled");
    const summary = valid.reduce((acc, order) => ({ totalSales: acc.totalSales + order.grandTotal, totalCollected: acc.totalCollected + order.paidAmount - order.refundedAmount, currentDebt: acc.currentDebt + order.dueAmount }), { totalSales: 0, totalCollected: 0, currentDebt: 0 });
    const payments = orders.flatMap((order: any) => [
      ...(order.payments || []).map((payment: any) => ({ ...payment, orderId: String(order._id), orderCode: order.orderCode, direction: "collection" })),
      ...(order.refunds || []).map((refund: any) => ({ ...refund, orderId: String(order._id), orderCode: order.orderCode, direction: "refund" })),
    ]).sort((a: any, b: any) => new Date(b.paidAt || b.refundedAt).getTime() - new Date(a.paidAt || a.refundedAt).getTime());
    return { customer, summary, orders, payments };
  },
};
