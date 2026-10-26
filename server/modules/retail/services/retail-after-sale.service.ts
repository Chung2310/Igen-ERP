import { CashierShiftModel } from "../models/cashier-shift.model";
import { assertPaymentSessionDeadline, lockRetailPaymentSession } from "./retail-payment-session.service";
import { RetailAfterSaleRequestModel } from "../models/retail-after-sale-request.model";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { createHash } from "node:crypto";
import { reconcileCommission } from "./retail-collaborator-adapter";
import mongoose, { Types } from "mongoose";
import { createRetailRestockReceipt } from "./retail-restock-receipt.service";
import { summarizeAfterSales } from "./retail-after-sale-history";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizeInternalBarcode } from "../../inventory/serials/unit-barcode-validation";
import type { RetailBranchScope } from "../contracts";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { businessDateInVietnam, emitSessionChange } from "./cashier-shift.service";
import { enqueueTierRefresh, processTierRefreshBySourceKey } from "./retail-customer-tier.service";
import { reverseOrderPoints } from "./retail-points.service";
import { CustomerPointService } from "../../customer-management/services/customer-point.service";
import { CustomerPointLedgerModel } from "../../customer-management/models/customer-point-ledger.model";
import { loadRetailStockSource, remainingRetailCost, restockItemFromSource, retailStockSourceError } from "./retail-stock-source";


const actorId = (a: any) => String(a.id || a.uid || ""); const actorName = (a: any) => String(a.displayName || a.email || "");
const fail = (message: string, code = "AFTER_SALE_INVALID", status = 400) => Object.assign(new Error(message), { code, status });

export function selectedItems(order: any, input: any, used: Map<number, number>) {
  if (!Array.isArray(input.items) || !input.items.length) throw fail("Vui lòng chọn ít nhất một sản phẩm.");
  const seen = new Set<number>();
  return input.items.map((raw: any) => {
    const orderLineIndex = Number(raw.orderLineIndex), source = order.items?.[orderLineIndex], quantity = Number(raw.quantity);
    if (!Number.isSafeInteger(orderLineIndex) || seen.has(orderLineIndex)) throw fail("Dòng sản phẩm bị trùng hoặc không hợp lệ.");
    seen.add(orderLineIndex);
    if (!source) throw fail("Dòng sản phẩm không thuộc đơn bán gốc.");
    const alreadyProcessed = used.get(orderLineIndex) || 0;
    const remaining = Math.max(0, Number(source.quantity) - alreadyProcessed);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw fail(`Số lượng của ${source.sku} không hợp lệ.`);
    const actionLabel = input.type === "buyback" ? "thu mua" : "hoàn/trả";
    if (quantity > remaining) {
      throw fail(
        remaining === 0
          ? `Sản phẩm ${source.sku} đã được ${actionLabel} hết số lượng của đơn hàng này (đã xử lý ${alreadyProcessed}/${source.quantity}).`
          : `Số lượng yêu cầu ${actionLabel} (${quantity}) của ${source.sku} vượt quá số lượng còn lại có thể xử lý (còn lại: ${remaining}/${source.quantity}).`
      );
    }
    const serialNumbers = [...new Set<string>((raw.serialNumbers || []).map(String).map(normalizeSerialNumber).filter(Boolean))];
    const internalBarcodes = [...new Set<string>((raw.internalBarcodes || []).map(String).map(normalizeInternalBarcode).filter(Boolean))];
    if (source.trackingMode === "serial" && serialNumbers.length !== quantity) throw fail(`Phải chọn đúng ${quantity} IMEI/serial của ${source.sku}.`);
    if (source.trackingMode === "unit_barcode" && internalBarcodes.length !== quantity) throw fail(`Phải chọn đúng ${quantity} mã nội bộ của ${source.sku}.`);
    const soldSerials = new Set((source.serialNumbers || []).map(normalizeSerialNumber)); if (serialNumbers.some((v) => !soldSerials.has(normalizeSerialNumber(v)))) throw fail(`IMEI/serial không thuộc đơn bán gốc: ${source.sku}.`);
    const soldCodes = new Set((source.internalBarcodes || []).map(normalizeInternalBarcode)); if (internalBarcodes.some((v) => !soldCodes.has(normalizeInternalBarcode(v)))) throw fail(`Mã nội bộ không thuộc đơn bán gốc: ${source.sku}.`);
    const merchandiseRefundPool = Math.min(Number(order.subtotal), Math.max(0, Number(order.grandTotal) - Number(order.shippingFee || 0)));
    const originalUnitPrice = Number(source.lineTotal) / Number(source.quantity), unitAmount = input.type === "return" ? Math.floor(originalUnitPrice * (Number(order.subtotal) > 0 ? merchandiseRefundPool / Number(order.subtotal) : 0)) : Number(raw.unitAmount);
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 0) throw fail("Giá thu mua phải là số nguyên không âm.");
    return { orderLineIndex, productId: String(source.productId), ...(source.variantId ? { variantId: String(source.variantId) } : {}), sku: source.sku, productName: source.productName, trackingMode: source.trackingMode, quantity, serialNumbers, internalBarcodes, originalUnitPrice, unitAmount, unitCost: input.type === "return" ? Number(source.unitCost || 0) : unitAmount, lineAmount: unitAmount * quantity, condition: String(raw.condition || "good"), note: String(raw.note || "").trim() || undefined };
  });
}

async function restoreSerials(scope: RetailBranchScope, order: any, doc: any, actor: any, warehouseId: string, session: mongoose.ClientSession) {
  const conflict = (): never => { throw fail("Máy không còn khớp lần bán gốc. Cần đối soát trước khi trả/thu mua.", "AFTER_SALE_SERIAL_CONFLICT", 409); };
  if (!session.inTransaction()) throw fail("Hoàn máy yêu cầu transaction đang hoạt động.", "TRANSACTION_REQUIRED", 503);
  const tracked = doc.items.some((item: any) => ["serial", "unit_barcode"].includes(item.trackingMode));
  if (!tracked) return;
  const source = await loadRetailStockSource(scope, String(order._id), order.items, session);
  for (const item of doc.items) {
    const ids = item.trackingMode === "serial"
      ? (item.serialNumbers || []).map((v: string) => ({ normalizedSerialNumber: normalizeSerialNumber(v) }))
      : item.trackingMode === "unit_barcode"
        ? (item.internalBarcodes || []).map((v: string) => ({ $or: [{ normalizedInternalBarcode: normalizeInternalBarcode(v) }, { normalizedBarcodeAliases: normalizeInternalBarcode(v) }] }))
        : [];
    for (const identifier of ids) {
      const entry = source.entries[item.orderLineIndex];
      const filter = { ...scope, ...identifier, warehouseId: source.warehouseId, productId: entry.productId,
        variantId: entry.variantId || { $exists: false }, sku: entry.sku, status: "sold", soldOrderId: String(order._id),
        soldBranchId: scope.branchId, currentDocumentType: "retail-order", currentDocumentId: String(order._id) };
      const unit = await SerialUnitModel.findOne(filter).session(session).lean();
      if (!unit) conflict();
      const event = await SerialEventModel.findOne({ companyCode: scope.companyCode, serialUnitId: String(unit._id) }).sort({ occurredAt: -1, _id: -1 }).session(session).lean();
      if (!event || event.branchId !== scope.branchId || event.eventType !== "sold" || event.fromStatus !== "in_stock"
        || event.toStatus !== "sold" || event.documentType !== "retail-order" || event.documentId !== String(order._id)) conflict();
      // Optional barcode selection must describe these same serial units, not other units on the line.
      if (item.trackingMode === "serial" && item.internalBarcodes?.length
        && (item.internalBarcodes.length !== item.quantity || !item.internalBarcodes.some((code: string) => [unit.normalizedInternalBarcode, ...(unit.normalizedBarcodeAliases || [])].includes(normalizeInternalBarcode(code))))) conflict();
      const serial: any = await SerialUnitModel.findOneAndUpdate(
        { ...filter, _id: unit._id },
        { $set: { status: "in_stock", warehouseId, currentDocumentType: "goods-receipt", currentDocumentId: String(doc.receiptId), updatedBy: actorId(actor) }, $unset: { customerId: 1, customerWarranty: 1, soldAt: 1, soldOrderId: 1, soldOrderCode: 1, soldInvoiceId: 1, soldBranchId: 1 } },
        { returnDocument: "after", ...(session ? { session } : {}) }
      );
      if (!serial) conflict();
      await SerialEventModel.create([
        { ...scope, serialUnitId: String(serial._id), serialNumber: serial.serialNumber, eventType: doc.type === "return" ? "sales_return" : "customer_buyback", fromStatus: "sold", toStatus: "in_stock", documentType: "goods-receipt", documentId: String(doc.receiptId), reason: doc.reason, actorId: actorId(actor), actorName: actorName(actor) }
      ], session ? { session } : {});
    }
  }
}

async function revertPointsOnReturn(scope: RetailBranchScope, order: any, doc: any, totalAmount: number, actor: any, session?: mongoose.ClientSession) {
  if (!order.customerId) return;
  await reverseOrderPoints(scope, order, `return:${doc._id}`, totalAmount, actorId(actor), session);
  try {
    const earnLedger = await CustomerPointLedgerModel.findOne({
      companyCode: scope.companyCode,
      sourceId: String(order._id),
      type: "EARN_ORDER",
    }).session(session || null);

    if (earnLedger && earnLedger.points > 0) {
      const priorReverts = await CustomerPointLedgerModel.find({
        companyCode: scope.companyCode,
        sourceId: String(order._id),
        type: "REFUND_REVERT",
      }).session(session || null);
      const alreadyReverted = priorReverts.reduce((sum: number, r: any) => sum + Math.abs(r.points), 0);
      const remainingEarned = Math.max(0, earnLedger.points - alreadyReverted);

      let pointsToRevert = 0;
      if (order.refundedAmount >= order.grandTotal) {
        pointsToRevert = remainingEarned;
      } else {
        const ratio = Math.min(1, totalAmount / Math.max(1, order.grandTotal));
        pointsToRevert = Math.min(remainingEarned, Math.max(1, Math.round(earnLedger.points * ratio)));
      }

      if (pointsToRevert > 0) {
        await CustomerPointService.revertRefundPoints({
          companyCode: scope.companyCode,
          branchId: scope.branchId,
          customerId: String(order.customerId),
          points: pointsToRevert,
          sourceType: "retail_order",
          sourceId: String(order._id),
          sourceCode: doc.code,
          reason: `Thu hồi điểm do trả hàng phiếu ${doc.code} (đơn ${order.orderCode})`,
          actor: { id: actorId(actor), name: actorName(actor) },
          session,
        });
      }
    }
  } catch (err) {
    console.error("[revertPointsOnReturn] error:", err);
  }
}

function afterSaleIdentity(scope: RetailBranchScope, input: any, actor: any, shift?: any) {
    if (!["return", "buyback"].includes(input.type)) throw fail("Loại chứng từ không hợp lệ."); const reason = String(input.reason || "").trim(); if (!reason) throw fail("Lý do là bắt buộc.");
    const paymentMethod = String(input.paymentMethod || "cash") as "cash" | "card" | "transfer" | "ewallet", idempotencyKey = String(input.idempotencyKey || "").trim(); if (!["cash", "card", "transfer", "ewallet"].includes(paymentMethod)) throw fail("Phương thức chi tiền không hợp lệ."); if (!idempotencyKey) throw fail("Thiếu khóa chống tạo trùng.");
    if (!Types.ObjectId.isValid(input.orderId)) throw fail("Mã đơn bán gốc không hợp lệ.");
    if (!Array.isArray(input.items) || !input.items.length) throw fail("Vui lòng chọn ít nhất một sản phẩm.");
    if (input.items.some((item: any) => !item ||
        (item.serialNumbers != null && !Array.isArray(item.serialNumbers)) ||
        (item.internalBarcodes != null && !Array.isArray(item.internalBarcodes)))) {
      throw fail("Dòng sản phẩm hoặc danh sách mã máy không hợp lệ.");
    }
    if (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)) throw fail("Phiên bản đơn không hợp lệ.");
    // Hash only accepted request fields, with the same defaults as posting. Do not
    // include today's date: retrying a lost response tomorrow is still a replay.
    const requestFingerprint = createHash("sha256").update(JSON.stringify({
      version: input.expectedVersion === undefined ? 1 : 2, ...(input.expectedVersion === undefined ? {} : { expectedVersion: input.expectedVersion }), companyCode: scope.companyCode, branchId: scope.branchId,
      actorId: actorId(actor), shiftId: String(shift?._id || ""),
      type: input.type, orderId: String(input.orderId), reason, paymentMethod,
      paymentReference: String(input.paymentReference || "").trim(),
      items: input.items.map((item: any) => ({
        orderLineIndex: Number(item.orderLineIndex), quantity: Number(item.quantity),
        unitAmount: input.type === "buyback" ? Number(item.unitAmount) : undefined,
        serialNumbers: (item.serialNumbers || []).map(String).map(normalizeSerialNumber).filter(Boolean),
        internalBarcodes: (item.internalBarcodes || []).map(String).map(normalizeInternalBarcode).filter(Boolean),
        condition: String(item.condition || "good"), note: String(item.note || "").trim(),
      })),
    })).digest("hex");
    return { reason, paymentMethod, idempotencyKey, requestFingerprint };
}
function afterSaleDigest(doc: any) {
  const fields = ["orderLineIndex", "productId", "variantId", "sku", "trackingMode", "quantity", "serialNumbers", "internalBarcodes", "unitAmount", "unitCost", "lineAmount", "condition", "note", "stockLedgerId", "stockWarehouseId"];
  return createHash("sha256").update(JSON.stringify({ id: String(doc._id), companyCode: doc.companyCode, branchId: doc.branchId, orderId: doc.orderId, type: doc.type, status: doc.status, totalAmount: doc.totalAmount, paymentMethod: doc.paymentMethod, paymentReference: doc.paymentReference, reason: doc.reason, createdBy: doc.createdBy, shiftId: doc.shiftId, receiptId: doc.receiptId, items: doc.items.map((item: any) => Object.fromEntries(fields.map(key => [key, item[key]]))) })).digest("hex");
}
function checkAfterSaleGate(gate: any, scope: RetailBranchScope, input: any, fingerprint: string) {
  if (gate.branchId !== scope.branchId || gate.orderId !== String(input.orderId) || gate.requestFingerprint !== fingerprint) throw fail("Khóa hậu mãi thuộc yêu cầu khác.", "AFTER_SALE_IDEMPOTENCY_CONFLICT", 409);
}
async function revocationBaseline(scope: RetailBranchScope, order: any, session: mongoose.ClientSession) {
  const conflict = () => fail("Lịch sử hậu mãi chưa đủ bằng chứng. Giữ yêu cầu để đối chiếu.", "AFTER_SALE_REVOKE_CONFLICT", 409);
  const history = await RetailAfterSaleModel.find({ ...scope, orderId: String(order._id) }).sort({ _id: 1 }).session(session).lean();
  const receipts = await GoodsReceiptModel.find({ ...scope, orderId: String(order._id), receiptKind: { $in: ["sales_return", "buyback"] } }).session(session).lean();
  const gates = await RetailAfterSaleRequestModel.find({ ...scope, orderId: String(order._id), status: { $ne: "revoked" } }).session(session).lean();
  if (receipts.length !== history.length || gates.length !== history.length || (order.afterSaleStatus || "none") !== summarizeAfterSales(order, history).status) throw conflict();
  const refundIndices = new Set<number>();
  for (const doc of history) {
    const evidence = doc.reconciliationEvidence;
    const gate = gates.find(row => row.documentId === String(doc._id));
    const receipt = receipts.find(row => String(row._id) === doc.receiptId);
    if (!evidence || evidence.digest !== afterSaleDigest(doc) || !Number.isSafeInteger(evidence.orderVersion) || evidence.orderVersion > order.version || !gate || gate.status !== "completed" || gate.idempotencyKey !== doc.idempotencyKey || gate.requestFingerprint !== doc.requestFingerprint || !receipt || receipt.status !== "confirmed" || receipt.sourceId !== String(doc._id) || receipt.receiptKind !== (doc.type === "return" ? "sales_return" : "buyback") || doc.status !== "completed" || doc.items.reduce((sum, item) => sum + item.lineAmount, 0) !== doc.totalAmount) throw conflict();
    if (receipt.items.length !== doc.items.length || !receipt.items.every((item, index) => item.sku === doc.items[index].sku && item.quantity === doc.items[index].quantity && item.unitCost === doc.items[index].unitCost)) throw conflict();
    if (doc.type === "return") {
      const index = evidence.refundIndex;
      const refund = order.refunds[index];
      if (!Number.isSafeInteger(index) || index < 0 || refundIndices.has(index) || !refund || refund.amount !== doc.totalAmount || refund.method !== doc.paymentMethod || refund.reference !== doc.paymentReference || refund.reason !== doc.reason || refund.refundedBy !== doc.createdBy || String(refund.shiftId || "") !== String(doc.shiftId || "")) throw conflict();
      refundIndices.add(index);
    }
  }
  if (order.refunds.length !== refundIndices.size || order.refunds.reduce((sum: number, refund: any) => sum + refund.amount, 0) !== order.refundedAmount) throw conflict();
  return createHash("sha256").update(JSON.stringify({ version: order.version, orderId: String(order._id), history: history.map(doc => [String(doc._id), doc.reconciliationEvidence.digest]) })).digest("hex");
}
export const RetailAfterSaleService = {
  async revoke(scope: RetailBranchScope, input: any, actor: any, shift?: any) {
    const { idempotencyKey, requestFingerprint } = afterSaleIdentity(scope, input, actor, shift);
    const filter = { companyCode: scope.companyCode, idempotencyKey };
    const replay = (gate: any) => {
      checkAfterSaleGate(gate, scope, input, requestFingerprint);
      if (gate.status !== "revoked") throw fail("Yêu cầu đã ghi nhận hoặc đang xử lý. Không thể thu hồi.", "AFTER_SALE_REVOKE_CONFLICT", 409);
      return { status: "revoked" as const, message: "Đã thu hồi yêu cầu chưa ghi nhận. Khóa cũ không thể tạo phiếu." };
    };
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        if (await RetailAfterSaleModel.exists(filter).session(session)) throw fail("Đã có phiếu hậu mãi. Cần đối chiếu.", "AFTER_SALE_REVOKE_CONFLICT", 409);
        const gate = await RetailAfterSaleRequestModel.findOne(filter).session(session).lean();
        if (gate) return replay(gate);
        const order = await RetailOrderModel.findOne({ _id: input.orderId, ...scope, status: "completed" }).session(session).lean();
        let baselineDigest: string | undefined;
        if (input.expectedVersion !== undefined) {
          if (!order || order.version !== input.expectedVersion) throw fail("Đơn đã thay đổi. Giữ phiên bản cũ để đối chiếu.", "AFTER_SALE_REVOKE_CONFLICT", 409);
          baselineDigest = await revocationBaseline(scope, order, session);
        } else {
        if (!order || order.refundedAmount || order.afterSaleStatus || await RetailAfterSaleModel.exists({ ...scope, orderId: String(input.orderId) }).session(session) || await GoodsReceiptModel.exists({ ...scope, orderId: String(input.orderId), receiptKind: { $in: ["sales_return", "buyback"] } }).session(session)) throw fail("Đơn có dấu vết hậu mãi hoặc thiếu bằng chứng. Giữ yêu cầu để đối chiếu.", "AFTER_SALE_REVOKE_CONFLICT", 409);
        }
        await RetailAfterSaleRequestModel.create([{ ...scope, idempotencyKey, orderId: String(input.orderId), requestFingerprint, expectedVersion: input.expectedVersion, baselineDigest, status: "revoked" }], { session });
        return { status: "revoked" as const, message: "Đã thu hồi yêu cầu chưa ghi nhận. Khóa cũ không thể tạo phiếu." };
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.idempotencyKey) {
        const gate = await RetailAfterSaleRequestModel.findOne(filter).lean();
        if (gate) return replay(gate);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async reconcile(scope: RetailBranchScope, input: any, actor: any, shift?: any) {
    const { idempotencyKey, requestFingerprint } = afterSaleIdentity(scope, input, actor, shift);
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const conflict = { status: "conflict" as const, message: "Chưa đủ bằng chứng khớp phiếu hậu mãi. Giữ yêu cầu để đối chiếu." };
        const order = await RetailOrderModel.findOne({ _id: input.orderId, ...scope }).session(session).lean();
        if (!order) return conflict;
        const doc = await RetailAfterSaleModel.findOne({ companyCode: scope.companyCode, idempotencyKey }).session(session).lean();
        const gate = await RetailAfterSaleRequestModel.findOne({ companyCode: scope.companyCode, idempotencyKey }).session(session).lean();
        if (gate) {
          if (gate.branchId !== scope.branchId || gate.orderId !== String(input.orderId) || gate.requestFingerprint !== requestFingerprint) return conflict;
          if (gate.status === "revoked") return doc ? conflict : { status: "revoked" as const, message: "Yêu cầu đã thu hồi; khóa cũ không thể tạo phiếu." };
          if (!doc || gate.status !== "completed" || gate.documentId !== String(doc._id)) return conflict;
        }
        if (!doc) return { status: "not_found" as const, message: "Chưa tìm thấy phiếu. Giữ khóa cũ; kết quả này không hủy yêu cầu đang gửi." };
        if (doc.branchId !== scope.branchId || doc.orderId !== String(input.orderId) || doc.requestFingerprint !== requestFingerprint || doc.status !== "completed") return conflict;
        const evidence = doc.reconciliationEvidence;
        if (!evidence || evidence.digest !== afterSaleDigest(doc) || !Number.isSafeInteger(evidence.orderVersion) || order.version < evidence.orderVersion || doc.items.reduce((sum, item) => sum + item.lineAmount, 0) !== doc.totalAmount) return conflict;
        if (!doc.receiptId || !await GoodsReceiptModel.exists({ _id: doc.receiptId, ...scope, status: "confirmed", sourceId: String(doc._id) }).session(session)) return conflict;
        if (doc.type === "return") {
          if (!Number.isSafeInteger(evidence.refundIndex) || evidence.refundIndex < 0) return conflict;
          const refund = order.refunds[evidence.refundIndex];
          if (!refund || refund.amount !== doc.totalAmount || refund.method !== doc.paymentMethod || refund.reference !== doc.paymentReference || refund.reason !== doc.reason || refund.refundedBy !== doc.createdBy || String(refund.shiftId || "") !== String(doc.shiftId || "") || order.refunds.reduce((sum, row) => sum + row.amount, 0) !== order.refundedAmount) return conflict;
        }
        return { status: "completed" as const, message: doc.type === "buyback" ? "Đã xác minh phiếu thu mua và nhập hàng; chưa xác minh chi tiền thực/quỹ Finance." : "Đã xác minh phiếu trả hàng, dòng hoàn tiền và nhập hàng; chưa đối soát tiền thực/quỹ Finance.", document: { _id: String(doc._id), code: doc.code, orderId: doc.orderId, type: doc.type, receiptId: doc.receiptId, receiptCode: doc.receiptCode } };
      }, { readConcern: { level: "snapshot" } });
    } finally { await session.endSession(); }
  },
  async get(scope: RetailBranchScope, id: string) {
    const doc = await RetailAfterSaleModel.findOne({ _id: id, ...scope }).lean();
    if (!doc) throw fail("Không tìm thấy chứng từ đổi trả / thu mua.", "AFTER_SALE_NOT_FOUND", 404);
    return doc;
  },
  async list(scope: RetailBranchScope, query: any) { const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 20)), filter: any = { ...scope, ...(query.type ? { type: String(query.type) } : {}), ...(query.orderId ? { orderId: String(query.orderId) } : {}) }; const [items, total] = await Promise.all([RetailAfterSaleModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), RetailAfterSaleModel.countDocuments(filter)]); return { items, total, page, limit }; },
  async create(scope: RetailBranchScope, input: any, actor: any, shift?: any) {
    let businessDate = shift?.businessDate || businessDateInVietnam(new Date());
    const { reason, paymentMethod, idempotencyKey, requestFingerprint } = afterSaleIdentity(scope, input, actor, shift);
    const checkedReplay = (doc: any) => {
      if (doc.branchId !== scope.branchId || doc.orderId !== String(input.orderId) ||
          doc.requestFingerprint !== requestFingerprint) {
        throw fail("Khóa chống tạo trùng đã dùng cho yêu cầu khác hoặc chứng từ cũ chưa có dấu kiểm tra. Vui lòng đối chiếu chứng từ gốc.", "AFTER_SALE_IDEMPOTENCY_CONFLICT", 409);
      }
      return doc;
    };
    const replayFilter = { companyCode: scope.companyCode, idempotencyKey };
    const existingGate = await RetailAfterSaleRequestModel.findOne(replayFilter).lean();
    if (existingGate) {
      checkAfterSaleGate(existingGate, scope, input, requestFingerprint);
      if (existingGate.status === "revoked") throw fail("Yêu cầu đã thu hồi.", "AFTER_SALE_REVOKED", 409);
    }
    const replay = await RetailAfterSaleModel.findOne(replayFilter).lean();
    if (replay) {
      if (existingGate && (existingGate.status !== "completed" || existingGate.documentId !== String(replay._id))) throw fail("Hồ sơ khóa không khớp phiếu.", "AFTER_SALE_IDEMPOTENCY_CONFLICT", 409);
      return checkedReplay(replay);
    }
    const session = await mongoose.startSession();
    let result: any;
    try { result = await session.withTransaction(async () => {
      const committed = await RetailAfterSaleModel.findOne(replayFilter).session(session).lean();
      const gate = await RetailAfterSaleRequestModel.findOne(replayFilter).session(session).lean();
      if (gate) {
        checkAfterSaleGate(gate, scope, input, requestFingerprint);
        if (gate.status === "revoked") throw fail("Yêu cầu đã thu hồi.", "AFTER_SALE_REVOKED", 409);
        if (!committed || gate.status !== "completed" || gate.documentId !== String(committed._id)) throw fail("Thiếu phiếu của yêu cầu đã ghi nhận.", "AFTER_SALE_IDEMPOTENCY_CONFLICT", 409);
      }
      if (committed) return checkedReplay(committed);
      await RetailAfterSaleRequestModel.create([{ ...scope, idempotencyKey, orderId: String(input.orderId), requestFingerprint, expectedVersion: input.expectedVersion, status: "processing" }], { session });
      const orderQuery = RetailOrderModel.findOne({ _id: input.orderId, ...scope, status: "completed", paymentStatus: { $in: ["paid", "refunded"] } });
      const order: any = await (session ? orderQuery.session(session) : orderQuery);
      if (!order) throw fail("Chỉ xử lý được đơn đã hoàn tất và thanh toán đủ.", "ORDER_NOT_ELIGIBLE", 409);
      if (input.expectedVersion !== undefined && order.version !== input.expectedVersion) throw fail("Đơn đã thay đổi. Giữ nguyên yêu cầu để đối chiếu.", "AFTER_SALE_VERSION_CONFLICT", 409);
      const priorQuery = RetailAfterSaleModel.find({ ...scope, orderId: String(order._id) }).lean();
      const prior: any[] = await (session ? priorQuery.session(session) : priorQuery);
      const used = new Map<number, number>(); for (const d of prior) for (const i of d.items || []) used.set(i.orderLineIndex, (used.get(i.orderLineIndex) || 0) + i.quantity);
      const items = selectedItems(order, input, used), totalAmount = items.reduce((s: number, i: any) => s + i.lineAmount, 0); if (totalAmount <= 0) throw fail("Tổng tiền phải lớn hơn 0.");
      shift = await lockRetailPaymentSession(scope, { ...input, cashSessionId: input.cashSessionId || shift?._id }, actor, session, paymentMethod === "cash", paymentMethod === "cash" ? totalAmount : 0);
      businessDate = shift?.businessDate || businessDateInVietnam(new Date());
      const stockSource = input.type === "return" ? await loadRetailStockSource(scope, String(order._id), order.items, session) : null;
      if (stockSource) {
        const expectedCost = remainingRetailCost(order.items, prior);
        if (!Number.isFinite(order.totalCost) || Math.abs(order.totalCost - expectedCost) > 0.000001) retailStockSourceError();
        for (const item of items) {
          const entry = stockSource.entries[item.orderLineIndex];
          Object.assign(item, { unitCost: entry.unitCost, stockLedgerId: String(entry._id), stockWarehouseId: entry.warehouseId });
        }
      }
      const _id = new Types.ObjectId(), code = `${input.type === "return" ? "TH" : "TM"}-${businessDate.replaceAll("-", "")}-${String(_id).slice(-6).toUpperCase()}`;
      const [doc] = await (RetailAfterSaleModel as any).create(
        [{ _id, ...scope, code, type: input.type, orderId: String(order._id), orderCode: order.orderCode, customerId: order.customerId, customerName: order.customerName, customerPhone: order.customerPhone, items, totalAmount, paymentMethod, paymentReference: String(input.paymentReference || "").trim() || undefined, reason, shiftId: shift?._id ? String(shift._id) : undefined, businessDate: businessDate, idempotencyKey, requestFingerprint, createdBy: actorId(actor), createdByName: actorName(actor) }],
        session ? { session } : {}
      );
      const variantsQuery = ProductVariantModel.find({ companyCode: scope.companyCode, _id: { $in: items.map((i: any) => i.productId) } }).lean();
      const variants = stockSource ? [] : await (session ? variantsQuery.session(session) : variantsQuery);
      const map = new Map(variants.map((v: any) => [String(v._id), v]));
      const receipt = await createRetailRestockReceipt(scope, {
        kind: input.type === "return" ? "sales_return" : "buyback", sourceId: String(doc._id), sourceCode: code,
        order, warehouseId: stockSource?.warehouseId,
        items: items.map((i: any) => { if (stockSource) return restockItemFromSource(i, stockSource.entries[i.orderLineIndex]); const v: any = map.get(i.productId); return { ...i, productId: v ? String(v.productId) : i.productId, ...(v ? { variantId: String(v._id) } : { legacyProductId: i.productId }) }; }),
        reason, actorId: actorId(actor), actorName: actorName(actor), idempotencyKey: `after-sale:${doc._id}:in`,
      }, session);
      doc.receiptId = String(receipt._id);
      doc.receiptCode = receipt.receiptCode;
      await doc.save({ session });
      await restoreSerials(scope, order, doc, actor, receipt.warehouseId, session);
      if (input.type === "buyback" && paymentMethod === "cash" && shift) {
        await CashierShiftModel.updateOne({ _id: shift._id, ...scope, status: "open" }, { $push: { cashMovements: { key: `buyback:${doc._id}`, type: "out", amount: totalAmount, reason: `Thu mua ${code}`, at: new Date(), by: actorId(actor), byName: actorName(actor) } } }, { session });
      }
      const refundIndex = order.refunds.length;
      if (input.type === "return") {
        order.refunds.push({ method: paymentMethod, amount: totalAmount, reference: doc.paymentReference, refundedAt: new Date(), refundedBy: actorId(actor), refundedByName: actorName(actor), shiftId: shift?._id ? String(shift._id) : undefined, businessDate: businessDate, reason });
        order.refundedAmount += totalAmount;
        order.paymentStatus = order.refundedAmount >= order.grandTotal ? "refunded" : "paid";
        order.totalCost = remainingRetailCost(order.items, [...prior, doc]);
        if (order.customerId) {
          await revertPointsOnReturn(scope, order, doc, totalAmount, actor, session);
          await enqueueTierRefresh(scope, String(order.customerId), `retail-after-sale:${doc._id}:tier-return`, session);
        }
      }
      order.afterSaleStatus = summarizeAfterSales(order, [...prior, doc]).status;
      order.version += 1;
      await order.save({ session });
      doc.reconciliationEvidence = { digest: afterSaleDigest(doc), orderVersion: order.version, refundIndex: input.type === "return" ? refundIndex : undefined };
      await doc.save({ session });
      if (input.type === "return" && (order.commissionSnapshot || order.retailPartnerId)) await reconcileCommission("retail", String(order._id), scope.companyCode, session);
      await RetailAfterSaleRequestModel.updateOne(replayFilter, { $set: { status: "completed", documentId: String(doc._id) } }, { session });
      assertPaymentSessionDeadline(shift);
      return doc;
    }); } catch (error: any) {
      // Only the request-key unique index establishes a concurrent replay.
      if (error?.code !== 11000 || !error?.keyPattern?.companyCode || !error?.keyPattern?.idempotencyKey) throw error;
      const gate = await RetailAfterSaleRequestModel.findOne(replayFilter).lean();
      if (gate) { checkAfterSaleGate(gate, scope, input, requestFingerprint); if (gate.status === "revoked") throw fail("Yêu cầu đã thu hồi.", "AFTER_SALE_REVOKED", 409); }
      const committed = await RetailAfterSaleModel.findOne(replayFilter).lean();
      if (!committed) throw error;
      result = checkedReplay(committed);
    } finally { await session.endSession(); }
    if (input.type === "return" && result?.customerId) {
      const sourceKey = `retail-after-sale:${result._id}:tier-return`;
      setImmediate(() => void processTierRefreshBySourceKey(scope.companyCode, sourceKey).catch((error) => console.error("[retail-tier-refresh]", error)));
    }
    if (shift) emitSessionChange("pos:session:updated", shift);
    if (result?.orderId) {
      const source = await RetailOrderModel.findOne({ _id: result.orderId, ...scope }).select("shiftId salespersonId").lean();
      if (source?.shiftId && source.shiftId !== String(shift?._id || "")) emitSessionChange("pos:session:updated", { ...scope, _id: source.shiftId, cashierId: source.salespersonId });
    }
    return result;
  },
};
