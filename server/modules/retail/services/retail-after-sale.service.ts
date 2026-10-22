import mongoose, { Types } from "mongoose";
import { createHash } from "node:crypto";
import { writeStockMovement } from "../../../integrations/shared/stock-movement.service";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizeInternalBarcode } from "../../inventory/serials/unit-barcode-validation";
import type { RetailBranchScope } from "../contracts";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { reverseOrderCommission } from "./retail-commission.service";
import { RetailOrderModel } from "../models/retail-order.model";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { reverseOrderPoints } from "./retail-points.service";
import { enqueueTierRefresh, processTierRefreshBySourceKey } from "./retail-customer-tier.service";

const actorId = (a: any) => String(a.id || a.uid || ""); const actorName = (a: any) => String(a.displayName || a.email || "");
const fail = (message: string, code = "AFTER_SALE_INVALID", status = 400) => Object.assign(new Error(message), { code, status });

export function selectedItems(order: any, input: any, used: Map<number, number>) {
  if (!Array.isArray(input.items) || !input.items.length) throw fail("Vui lòng chọn ít nhất một sản phẩm.");
  return input.items.map((raw: any) => {
    const orderLineIndex = Number(raw.orderLineIndex), source = order.items?.[orderLineIndex], quantity = Number(raw.quantity);
    if (!Number.isSafeInteger(orderLineIndex) || orderLineIndex < 0 || !source) throw fail("Dòng sản phẩm không thuộc đơn bán gốc.");
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity + (used.get(orderLineIndex) || 0) > Number(source.quantity)) throw fail(`Số lượng ${source.sku} vượt quá số còn có thể xử lý.`);
    const serialNumbers = [...new Set<string>((raw.serialNumbers || []).map(String).map((v: string) => v.trim()).filter(Boolean))];
    const internalBarcodes = [...new Set<string>((raw.internalBarcodes || []).map(String).map((v: string) => v.trim()).filter(Boolean))];
    if (source.trackingMode === "serial" && serialNumbers.length !== quantity) throw fail(`Phải chọn đúng ${quantity} IMEI/serial của ${source.sku}.`);
    if (source.trackingMode === "unit_barcode" && internalBarcodes.length !== quantity) throw fail(`Phải chọn đúng ${quantity} mã nội bộ của ${source.sku}.`);
    const soldSerials = new Set((source.serialNumbers || []).map(normalizeSerialNumber)); if (serialNumbers.some((v) => !soldSerials.has(normalizeSerialNumber(v)))) throw fail(`IMEI/serial không thuộc đơn bán gốc: ${source.sku}.`);
    const soldCodes = new Set((source.internalBarcodes || []).map(normalizeInternalBarcode)); if (internalBarcodes.some((v) => !soldCodes.has(normalizeInternalBarcode(v)))) throw fail(`Mã nội bộ không thuộc đơn bán gốc: ${source.sku}.`);
    const merchandiseRefundPool = Math.min(Number(order.subtotal), Math.max(0, Number(order.grandTotal) - Number(order.shippingFee || 0)));
    const originalUnitPrice = Number(source.lineTotal) / Number(source.quantity), unitAmount = input.type === "return" ? Math.floor(originalUnitPrice * (Number(order.subtotal) > 0 ? merchandiseRefundPool / Number(order.subtotal) : 0)) : Number(raw.unitAmount);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 0) throw fail("Giá thu mua phải là số nguyên không âm.");
    used.set(orderLineIndex, (used.get(orderLineIndex) || 0) + quantity);
    return { orderLineIndex, productId: String(source.productId), ...(source.variantId ? { variantId: String(source.variantId) } : {}), sku: source.sku, productName: source.productName, trackingMode: source.trackingMode, quantity, serialNumbers, internalBarcodes, originalUnitPrice, unitAmount, unitCost: input.type === "return" ? Number(source.unitCost || 0) : unitAmount, lineAmount: unitAmount * quantity, condition: String(raw.condition || "good"), note: String(raw.note || "").trim() || undefined };
  });
}

async function restoreSerials(scope: RetailBranchScope, order: any, doc: any, actor: any, session: mongoose.ClientSession) {
  const warehouse = await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  for (const item of doc.items) {
    const ids = item.trackingMode === "serial" ? (item.serialNumbers || []).map((v: string) => ({ normalizedSerialNumber: normalizeSerialNumber(v) })) : item.trackingMode === "unit_barcode" ? (item.internalBarcodes || []).map((v: string) => ({ normalizedInternalBarcode: normalizeInternalBarcode(v) })) : [];
    for (const identifier of ids) { const serial: any = await SerialUnitModel.findOneAndUpdate({ ...scope, ...identifier, status: "sold", soldOrderId: String(order._id) }, { $set: { status: "in_stock", warehouseId: String(warehouse._id), currentDocumentType: "retail-after-sale", currentDocumentId: String(doc._id), updatedBy: actorId(actor) }, $unset: { customerId: 1, customerWarranty: 1, soldAt: 1, soldOrderId: 1, soldOrderCode: 1, soldInvoiceId: 1, soldBranchId: 1 } }, { returnDocument: "after", session }); if (!serial) throw fail("IMEI/serial đã được nhập lại hoặc không còn ở trạng thái đã bán.", "SERIAL_NOT_SOLD", 409); await SerialEventModel.create([{ ...scope, serialUnitId: String(serial._id), serialNumber: serial.serialNumber, eventType: doc.type === "return" ? "sales_return" : "customer_buyback", fromStatus: "sold", toStatus: "in_stock", documentType: "retail-after-sale", documentId: String(doc._id), reason: doc.reason, actorId: actorId(actor), actorName: actorName(actor) }], { session }); }
  }
}

export const RetailAfterSaleService = {
  async list(scope: RetailBranchScope, query: any) { const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 20)), filter: any = { ...scope, ...(query.type ? { type: String(query.type) } : {}), ...(query.orderId ? { orderId: String(query.orderId) } : {}) }; const [items, total] = await Promise.all([RetailAfterSaleModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RetailAfterSaleModel.countDocuments(filter)]); return { items, total, page, limit }; },
  async create(scope: RetailBranchScope, input: any, actor: any, shift: any) {
    if (!["return", "buyback"].includes(input.type)) throw fail("Loại chứng từ không hợp lệ."); const reason = String(input.reason || "").trim(); if (!reason) throw fail("Lý do là bắt buộc.");
    const paymentMethod = String(input.paymentMethod || "cash") as "cash" | "card" | "transfer" | "ewallet", idempotencyKey = String(input.idempotencyKey || "").trim(); if (!["cash", "card", "transfer", "ewallet"].includes(paymentMethod)) throw fail("Phương thức chi tiền không hợp lệ."); if (!idempotencyKey) throw fail("Thiếu khóa chống tạo trùng.");
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ type: input.type, orderId: input.orderId, items: input.items, paymentMethod, paymentReference: input.paymentReference || "", reason })).digest("hex");
    const replay = await RetailAfterSaleModel.findOne({ companyCode: scope.companyCode, idempotencyKey }).lean();
    if (replay) {
      if (replay.branchId !== scope.branchId || replay.orderId !== String(input.orderId) || replay.type !== input.type || (replay.requestFingerprint && replay.requestFingerprint !== requestFingerprint)) throw fail("Khóa yêu cầu đã được dùng cho giao dịch khác.", "AFTER_SALE_KEY_REUSED", 409);
      return replay;
    }
    if (!Types.ObjectId.isValid(input.orderId)) throw fail("Mã đơn bán gốc không hợp lệ.");
    const session = await mongoose.startSession(); let result: any; try { await session.withTransaction(async () => {
      const order: any = await RetailOrderModel.findOne({ _id: input.orderId, ...scope, status: "completed", paymentStatus: { $in: ["paid", "refunded"] } }).session(session); if (!order) throw fail("Chỉ xử lý được đơn đã hoàn tất và thanh toán đủ.", "ORDER_NOT_ELIGIBLE", 409);
      const prior: any[] = await RetailAfterSaleModel.find({ ...scope, orderId: String(order._id) }).session(session).lean(), used = new Map<number, number>(); for (const d of prior) for (const i of d.items || []) used.set(i.orderLineIndex, (used.get(i.orderLineIndex) || 0) + i.quantity);
      const items = selectedItems(order, input, used), totalAmount = items.reduce((s: number, i: any) => s + i.lineAmount, 0); if (totalAmount <= 0) throw fail("Tổng tiền phải lớn hơn 0.");
      const _id = new Types.ObjectId(), code = `${input.type === "return" ? "TH" : "TM"}-${shift.businessDate.replaceAll("-", "")}-${String(_id).slice(-6).toUpperCase()}`;
      const [doc] = await (RetailAfterSaleModel as any).create([{ _id, ...scope, code, type: input.type, orderId: String(order._id), orderCode: order.orderCode, customerId: order.customerId, customerName: order.customerName, customerPhone: order.customerPhone, items, totalAmount, paymentMethod, paymentReference: String(input.paymentReference || "").trim() || undefined, reason, shiftId: String(shift._id), businessDate: shift.businessDate, idempotencyKey, requestFingerprint, createdBy: actorId(actor), createdByName: actorName(actor) }], { session });
      const variants = await ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: items.map((i: any) => i.productId) } }).session(session).lean(), map = new Map(variants.map((v: any) => [String(v._id), v]));
      await writeStockMovement({ ...scope, direction: "in", purpose: input.type === "return" ? "sales-return" : "purchase", sourceType: "retail-after-sale", sourceId: String(doc._id), sourceCode: code, idempotencyKey: `after-sale:${doc._id}:in`, operatorName: actorName(actor), items: items.map((i: any) => { const v: any = map.get(i.productId); return { ...i, productId: v ? String(v.productId) : i.productId, ...(v ? { variantId: String(v._id) } : { legacyProductId: i.productId }) }; }), reason, session }); await restoreSerials(scope, order, doc, actor, session);
      if (input.type === "return") { order.refunds.push({ method: paymentMethod, amount: totalAmount, reference: doc.paymentReference, refundedAt: new Date(), refundedBy: actorId(actor), refundedByName: actorName(actor), shiftId: String(shift._id), businessDate: shift.businessDate, reason }); order.refundedAmount += totalAmount; order.paymentStatus = order.refundedAmount >= order.grandTotal ? "refunded" : "paid"; }
      if (input.type === "return") {
        await reverseOrderPoints(scope, order, `after-sale:${doc._id}`, totalAmount, actorId(actor), session);
        const ratios = new Map<number, number>();
        for (const item of items) ratios.set(item.orderLineIndex, (ratios.get(item.orderLineIndex) || 0) + item.quantity / Number(order.items[item.orderLineIndex]?.quantity || 1));
        await reverseOrderCommission(scope, order, `return:${doc._id}`, ratios, session);
        if (order.customerId) await enqueueTierRefresh(scope, String(order.customerId), `after-sale:${doc._id}:tier`, session);
      }
      order.version += 1;
      await order.save({ session });
      if (input.type === "buyback" && paymentMethod === "cash") {
        const movement = await CashierShiftModel.updateOne({ _id: shift._id, ...scope, status: "open" }, { $push: { cashMovements: { type: "out", amount: totalAmount, reason: `Thu mua ${code}: ${reason}`, at: new Date(), by: actorId(actor), byName: actorName(actor) } } }, { session });
        if (movement.matchedCount !== 1) throw fail("Ca bán đã đóng, không thể ghi chi tiền thu mua.", "SHIFT_NOT_OPEN", 409);
      }
      result = doc;
    }); } catch (error: any) { const prior = await RetailAfterSaleModel.findOne({ companyCode: scope.companyCode, idempotencyKey }).lean(); if (!prior) throw error; if (prior.branchId !== scope.branchId || prior.orderId !== String(input.orderId) || prior.type !== input.type || (prior.requestFingerprint && prior.requestFingerprint !== requestFingerprint)) throw fail("Khóa yêu cầu đã được dùng cho giao dịch khác.", "AFTER_SALE_KEY_REUSED", 409); result = prior; } finally { await session.endSession(); }
    if (input.type === "return" && result?.customerId) setImmediate(() => void processTierRefreshBySourceKey(scope.companyCode, `after-sale:${result._id}:tier`).catch((error) => console.error("[retail-tier-refresh]", error)));
    return result;
  },
};
