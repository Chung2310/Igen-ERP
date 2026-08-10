import type { RetailPaymentStatus } from "../interfaces/retail-order.interface";
import { RETAIL_PAYMENT_METHODS } from "../models/retail-order.model";
import mongoose, { Types } from "mongoose";
import { ProductModel } from "../../../model/product.model";
import { BranchModel } from "../../../model/branch.model";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailOrderCounterModel } from "../models/retail-order-counter.model";
import { RetailIdempotencyModel } from "../models/retail-idempotency.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { RetailCustomerModel } from "../models/retail-customer.model";
import { calculateOrderTotals } from "./retail-pricing.service";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { applyOrderStockOut, revertOrderStock } from "./retail-stock.service";
import { issueRetailInvoice } from "./retail-invoice.service";
import { businessDateInVietnam } from "./cashier-shift.service";
import { buildOrderListQuery } from "./retail-query.service";

type PaymentInput = { method: unknown; amount: unknown; tenderedAmount?: unknown; reference?: unknown };
export function normalizePayments(input: PaymentInput[], remaining: number) {
  if (!Array.isArray(input)) throw new Error("Danh sách thanh toán không hợp lệ.");
  let total = 0;
  const payments = input.map((item) => {
    const method = String(item.method || "");
    if (!(RETAIL_PAYMENT_METHODS as readonly string[]).includes(method)) throw new Error("Phương thức thanh toán không hợp lệ.");
    const amount = Number(item.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Số tiền thanh toán không hợp lệ.");
    total += amount;
    if (method === "cash") {
      const tenderedAmount = item.tenderedAmount === undefined ? amount : Number(item.tenderedAmount);
      if (!Number.isSafeInteger(tenderedAmount) || tenderedAmount < amount) throw new Error("Tiền khách đưa không được thấp hơn tiền áp dụng.");
      return { method, amount, tenderedAmount, changeAmount: tenderedAmount - amount, reference: undefined };
    }
    if (item.tenderedAmount !== undefined) throw new Error("Chỉ thanh toán tiền mặt mới có tiền khách đưa.");
    return { method, amount, reference: String(item.reference || "").trim() || undefined, tenderedAmount: undefined, changeAmount: undefined };
  });
  if (total > remaining) throw new Error("Tổng tiền thanh toán vượt số tiền phải thu.");
  return { payments, total };
}

export function paymentStatusFor(paidAmount: number, grandTotal: number, refundedAmount: number): RetailPaymentStatus {
  if (grandTotal > 0 && refundedAmount >= grandTotal) return "refunded";
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount < grandTotal) return "partial";
  return "paid";
}

export function serializeRetailOrder(order: any, canSeeCost: boolean) {
  const value = typeof order?.toObject === "function" ? order.toObject() : { ...order };
  if (canSeeCost) return value;
  const { totalCost: _totalCost, ...safe } = value;
  return { ...safe, items: (value.items || []).map(({ unitCost: _unitCost, ...item }: any) => item) };
}

const actorId = (actor: any) => String(actor.id || actor.uid || "");
const actorName = (actor: any) => String(actor.displayName || actor.email || "");
const monthlyScope = (businessDate: string) => businessDate.replace("-", "").slice(0, 6);
export function formatRetailDocumentCode(prefix: string, branchCode: string, scope: string, seq: number) {
  return `${prefix.trim().toUpperCase()}-${branchCode.trim().toUpperCase()}-${scope}-${String(seq).padStart(6, "0")}`;
}
const duplicate = (error: any) => error?.code === 11000;

function retailError(message: string, code: string, status = 409) {
  return Object.assign(new Error(message), { code, status });
}

export function assertHeldDraftCapacity(activeDrafts: number) {
  if (activeDrafts >= 5) throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
}

export function assertHeldDraftAccess(createdBy: string, actor: string, canManage: boolean) {
  if (createdBy !== actor && !canManage) throw retailError("Bạn không được sửa đơn treo của thu ngân khác.", "HELD_DRAFT_FORBIDDEN", 403);
}

export function isHeldDraftExpired(draftBusinessDate: string | undefined, currentBusinessDate: string) {
  return Boolean(draftBusinessDate && draftBusinessDate < currentBusinessDate);
}

async function expireHeldDrafts(scope: RetailBranchScope, currentBusinessDate: string) {
  await RetailOrderModel.updateMany(
    { ...scope, status: "draft", businessDate: { $lt: currentBusinessDate } },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Đơn treo hết hạn", expiredBySystem: true }, $inc: { version: 1 } },
  );
}

async function priceInput(scope: RetailBranchScope, input: any) {
  const settings = await getResolvedRetailSettings(scope);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const ids = rawItems.map((item: any) => String(item.productId || ""));
  if (!ids.length || ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new Error("Danh sách sản phẩm không hợp lệ.");
  const products = await ProductModel.find({ _id: { $in: ids }, ...scope, status: "Active" }).lean();
  const byId = new Map(products.map((product: any) => [String(product._id), product]));
  if (byId.size !== new Set(ids).size) throw new Error("Sản phẩm không thuộc chi nhánh đang bán.");
  const items = rawItems.map((item: any) => { const product: any = byId.get(String(item.productId)); return { productId: String(product._id), sku: product.sku, productName: product.name, unit: product.unit, category: product.category, quantity: Number(item.quantity), unitPrice: Number(product.price), unitCost: Number(product.costPrice || 0), discount: item.discount, note: String(item.note || "").trim() || undefined }; });
  return { settings, pricing: calculateOrderTotals({ items, orderDiscount: input.orderDiscount || { type: "amount", value: 0 }, taxRate: input.taxRate === undefined ? settings.defaultTaxRate : Number(input.taxRate), shippingFee: Number(input.shippingFee || 0), maxDiscountPercent: settings.maxDiscountPercent }) };
}

function snapshotPayment(item: any, shift: any, actor: any) { return { ...item, paidAt: new Date(), receivedBy: actorId(actor), receivedByName: actorName(actor), shiftId: String(shift._id), businessDate: shift.businessDate }; }

export const RetailOrderService = {
  async quote(scope: RetailBranchScope, input: any) { return (await priceInput(scope, input)).pricing; },
  async list(scope: RetailBranchScope, query: any) {
    await expireHeldDrafts(scope, businessDateInVietnam(new Date()));
    const { filter, page, limit, skip } = buildOrderListQuery(scope, query);
    const [items, total] = await Promise.all([RetailOrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), RetailOrderModel.countDocuments(filter)]); return { items, total, page, limit };
  },
  async idempotency(scope: RetailBranchScope, key: string) {
    const attempt = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key: String(key || "").trim() }).lean();
    if (!attempt) return { status: "not_found" as const };
    if (attempt.status !== "completed" || !attempt.orderId) return { status: "processing" as const };
    return { status: "completed" as const, order: await RetailOrderModel.findOne({ _id: attempt.orderId, ...scope }).lean(), invoice: attempt.invoiceId ? await RetailInvoiceModel.findOne({ _id: attempt.invoiceId, ...scope }).lean() : null };
  },
  async detail(scope: RetailBranchScope, id: string, actor?: any, canManage = false) { if (!Types.ObjectId.isValid(id)) throw new Error("Mã đơn không hợp lệ."); const order: any = await RetailOrderModel.findOne({ _id: id, ...scope }).lean(); if (!order) throw new Error("Không tìm thấy đơn hàng."); if (order.status === "draft" && actor) assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage); return order; },
  async createDraft(scope: RetailBranchScope, input: any, actor: any) {
    const currentBusinessDate = businessDateInVietnam(new Date());
    await expireHeldDrafts(scope, currentBusinessDate);
    const creator = actorId(actor);
    const used = await RetailOrderModel.find({ ...scope, status: "draft", createdBy: creator }).select("heldSlot").lean();
    assertHeldDraftCapacity(used.length);
    const occupied = new Set(used.map((item: any) => Number(item.heldSlot)));
    const { pricing } = await priceInput(scope, input);
    for (let slot = 1; slot <= 5; slot += 1) {
      if (occupied.has(slot)) continue;
      try {
        return await RetailOrderModel.create({ ...scope, items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee, grandTotal: pricing.grandTotal, totalCost: pricing.totalCost, payments: [], refunds: [], paidAmount: 0, refundedAmount: 0, dueAmount: pricing.grandTotal, paymentStatus: "unpaid", status: "draft", businessDate: currentBusinessDate, heldAt: new Date(), heldSlot: slot, salespersonId: String(input.salespersonId || creator), salespersonName: String(input.salespersonName || actorName(actor)), createdBy: creator, createdByName: actorName(actor), stockApplied: false, version: 0, customerId: input.customerId, dueDate: input.dueDate });
      } catch (error) {
        if (!duplicate(error)) throw error;
      }
    }
    throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
  },
  async updateDraft(scope: RetailBranchScope, id: string, input: any, actor: any, canManage = false) {
    const currentBusinessDate = businessDateInVietnam(new Date());
    await expireHeldDrafts(scope, currentBusinessDate);
    const existing: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft" }).lean();
    if (!existing) throw retailError("Đơn hàng không thể chỉnh sửa hoặc đã hết hạn.", "HELD_DRAFT_EXPIRED");
    assertHeldDraftAccess(String(existing.createdBy), actorId(actor), canManage);
    const expectedVersion = Number(input.version);
    if (!Number.isSafeInteger(expectedVersion)) throw retailError("Phiên bản đơn hàng là bắt buộc.", "ORDER_VERSION_CONFLICT");
    const { pricing } = await priceInput(scope, input); const order = await RetailOrderModel.findOneAndUpdate({ _id: id, ...scope, status: "draft", version: expectedVersion }, { $set: { items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee, grandTotal: pricing.grandTotal, totalCost: pricing.totalCost, dueAmount: pricing.grandTotal, customerId: input.customerId, dueDate: input.dueDate }, $inc: { version: 1 } }, { new: true }); if (!order) throw retailError("Đơn đã được thay đổi ở màn hình khác.", "ORDER_VERSION_CONFLICT"); return order;
  },
  async confirm(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any, canManage = false) {
    const key = String(input.idempotencyKey || "").trim(); if (!key) throw new Error("Idempotency key là bắt buộc.");
    const existing = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key, status: "completed" }).lean(); if (existing?.orderId) return { order: await RetailOrderModel.findById(existing.orderId).lean(), invoice: await RetailInvoiceModel.findById(existing.invoiceId).lean() };
    const session = await mongoose.startSession(); let result: any;
    try { await session.withTransaction(async () => {
      await RetailIdempotencyModel.create([{ companyCode: scope.companyCode, key, operation: "confirm-order", status: "processing" }], { session });
      const draft: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft" }).session(session); if (!draft) throw Object.assign(new Error("Đơn hàng không thể xác nhận."), { code: "ORDER_NOT_EDITABLE", status: 409 });
      assertHeldDraftAccess(String(draft.createdBy), actorId(actor), canManage);
      const { settings, pricing } = await priceInput(scope, draft.toObject()); if (Number(input.expectedGrandTotal) !== pricing.grandTotal) throw Object.assign(new Error("Tổng tiền đã thay đổi."), { code: "ORDER_TOTAL_MISMATCH", status: 409, details: { expected: Number(input.expectedGrandTotal), actual: pricing.grandTotal } });
      const normalized = normalizePayments(input.payments || [], pricing.grandTotal); const dueAmount = pricing.grandTotal - normalized.total;
      let customer: any = null; if (dueAmount > 0) { if (!draft.customerId || !draft.dueDate) throw new Error("Bán nợ cần khách hàng và hạn thanh toán."); customer = await RetailCustomerModel.findOne({ _id: draft.customerId, companyCode: scope.companyCode }).session(session); if (!customer) throw new Error("Không tìm thấy khách hàng."); }
      const branch = await BranchModel.findOne({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).session(session).lean(); if (!branch) throw new Error("Chi nhánh bán hàng không hợp lệ.");
      const scopeKey = monthlyScope(shift.businessDate); const counter = await RetailOrderCounterModel.findOneAndUpdate({ ...scope, scope: scopeKey }, { $inc: { seq: 1 } }, { new: true, upsert: true, session }); const orderCode = formatRetailDocumentCode(settings.orderPrefix, branch.code, scopeKey, counter!.seq);
      await applyOrderStockOut(scope, String(draft._id), orderCode, pricing.lines, actorName(actor), settings.allowNegativeStock, session);
      Object.assign(draft, { orderCode, shiftId: String(shift._id), businessDate: shift.businessDate, items: pricing.lines, ...pricing, customerName: customer?.name || draft.customerName, customerPhone: customer?.phone || draft.customerPhone, payments: normalized.payments.map((payment) => snapshotPayment(payment, shift, actor)), paidAmount: normalized.total, dueAmount, paymentStatus: paymentStatusFor(normalized.total, pricing.grandTotal, 0), status: dueAmount === 0 ? "completed" : "confirmed", stockApplied: true, confirmedAt: new Date(), completedAt: dueAmount === 0 ? new Date() : undefined, version: draft.version + 1 }); await draft.save({ session });
      const invoice = await issueRetailInvoice(draft, settings.invoicePrefix, branch.code, scopeKey, actor, session); await RetailIdempotencyModel.updateOne({ companyCode: scope.companyCode, key }, { $set: { status: "completed", orderId: String(draft._id), invoiceId: String(invoice._id) } }, { session }); result = { order: draft, invoice };
    }); } catch (error) { if (duplicate(error)) { const prior = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key, status: "completed" }).lean(); if (prior?.orderId) return { order: await RetailOrderModel.findById(prior.orderId).lean(), invoice: await RetailInvoiceModel.findById(prior.invoiceId).lean() }; } throw error; } finally { await session.endSession(); } return result;
  },
  async collect(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any) {
    const session = await mongoose.startSession(); let result: any; try { await session.withTransaction(async () => { const order: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "confirmed" }).session(session); if (!order) throw new Error("Đơn không thể thu thêm."); const normalized = normalizePayments(input.payments || [], order.dueAmount); order.payments.push(...normalized.payments.map((payment) => snapshotPayment(payment, shift, actor))); order.paidAmount += normalized.total; order.dueAmount = order.grandTotal - order.paidAmount; order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount); if (order.dueAmount === 0) { order.status = "completed"; order.completedAt = new Date(); } order.version += 1; await order.save({ session }); result = order; }); } finally { await session.endSession(); } return result;
  },
  async cancel(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any | undefined, canManage: boolean) {
    const reason = String(input.reason || "").trim();
    if (!reason) throw new Error("Lý do hủy là bắt buộc.");
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const order: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: { $in: ["draft", "confirmed", "completed"] } }).session(session);
        if (!order) throw new Error("Đơn không thể hủy.");
        if (order.status === "draft") assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
        if (order.status === "completed" && !canManage) throw Object.assign(new Error("Chỉ quản lý được hủy đơn hoàn tất."), { status: 403 });
        if (order.paidAmount > order.refundedAmount && !shift) throw Object.assign(new Error("Bạn chưa mở ca bán hàng."), { code: "SHIFT_NOT_OPEN", status: 409 });
        const remainingRefund = order.paidAmount - order.refundedAmount;
        const refunds = remainingRefund > 0 ? normalizePayments(input.refunds || [], remainingRefund) : { payments: [], total: 0 };
        if (refunds.total !== remainingRefund) throw new Error("Phải ghi nhận đủ số tiền hoàn khi hủy đơn.");
        if (order.stockApplied && !order.stockRevertedAt) { await revertOrderStock(scope, String(order._id), order.orderCode, order.items, actorName(actor), session); order.stockRevertedAt = new Date(); }
        order.refunds.push(...refunds.payments.map((item: any) => ({ method: item.method, amount: item.amount, reference: item.reference, refundedAt: new Date(), refundedBy: actorId(actor), refundedByName: actorName(actor), shiftId: String(shift?._id || ""), businessDate: shift?.businessDate || order.businessDate, reason })));
        order.refundedAmount += refunds.total; order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount); order.status = "cancelled"; order.cancelReason = reason; order.cancelledAt = new Date(); order.version += 1;
        await order.save({ session });
        await RetailInvoiceModel.updateOne({ orderId: String(order._id), ...scope, status: "issued" }, { $set: { status: "void", voidedAt: new Date(), voidReason: reason } }, { session });
        result = order;
      });
    } finally { await session.endSession(); }
    return result;
  },
};
