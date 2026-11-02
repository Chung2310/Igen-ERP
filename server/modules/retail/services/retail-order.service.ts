import { GoodsReceiptModel } from "../../../model/goods-receipt.model";
import { attachAfterSaleHistory } from "./retail-after-sale-history";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { resolveCollaborator, snapshotRetail, reconcileCommission } from "./retail-collaborator-adapter";
import type { RetailPaymentStatus } from "../interfaces/retail-order.interface";
import { RETAIL_PAYMENT_METHODS } from "../models/retail-order.model";
import { createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { ProductModel } from "../../../model/product.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { BranchModel } from "../../../model/branch.model";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailOrderCounterModel } from "../models/retail-order-counter.model";
import { RetailIdempotencyModel } from "../models/retail-idempotency.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { getBillingProfile, getCustomerBrief } from "../../customer-management/contracts";
import { calculateOrderTotals, toDiscountInput } from "./retail-pricing.service";
import { consumeCoupon, releaseCoupon, resolveCoupon } from "./retail-coupon.service";
import { getResolvedRetailSettings } from "./retail-settings.service";
import { applyOrderStockOut, revertOrderStock } from "./retail-stock.service";
import { issueRetailInvoice } from "./retail-invoice.service";
import { businessDateInVietnam, emitSessionChange } from "./cashier-shift.service";
import { assertPaymentSessionDeadline, lockRetailPaymentSession } from "./retail-payment-session.service";
import { buildOrderListQuery } from "./retail-query.service";
import type { PostReceivableEntryInput } from "../interfaces/retail-receivable.interface";
import { enqueueTierRefresh, processTierRefreshBySourceKey } from "./retail-customer-tier.service";
import { publishRetailOrderEvent } from "./retail-order-events";
import { claimSerialsForOrder, releaseSerialsForOrder } from "./retail-serial-order.service";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { CustomerPointLedgerModel } from "../../customer-management/models/customer-point-ledger.model";
import { CustomerPointService } from "../../customer-management/services/customer-point.service";
import { earnOrderPoints, getPointPolicy, postPoints, quotePointRedemption, reverseOrderPoints } from "./retail-points.service";
import { CustomerSettingsService } from "../../customer-management/services/customer-settings.service";

export function receivableEntriesForOrderChange(action: "confirm" | "collect" | "cancel", order: any, collectedAmount: number): PostReceivableEntryInput[] {
  const orderId = String(order._id);
  const customerId = String(order.customerId || "");
  if (!customerId) return [];
  if (action === "confirm" && order.dueAmount - Number(order.pendingTransferAmount || 0) > 0) return [{ type: "charge", customerId, orderId, amount: order.dueAmount - Number(order.pendingTransferAmount || 0), idempotencyKey: `retail-order:${orderId}:debt-charge` }];
  if (action === "collect" && collectedAmount > 0) return [{ type: "payment", customerId, orderId, amount: collectedAmount, idempotencyKey: `retail-order:${orderId}:debt-payment:${collectedAmount}:${order.dueAmount}` }];
  if (action === "cancel" && order.dueAmount - Number(order.pendingTransferAmount || 0) > 0) return [{ type: "reversal", customerId, orderId, amount: order.dueAmount - Number(order.pendingTransferAmount || 0), reason: "Hủy số dư công nợ của đơn", idempotencyKey: `retail-order:${orderId}:debt-cancel` }];
  return [];
}

export function tierRefreshForOrderChange(action: "confirm" | "cancel", order: any) {
  const customerId = String(order.customerId || "");
  if (!customerId) return null;
  return { customerId, sourceKey: `retail-order:${order._id}:tier-${action}` };
}

export function validateRetailSerialItems(items: Array<{ quantity: number; trackingMode?: string; serialNumbers?: string[]; internalBarcodes?: string[] }>) {
  for (const item of items) {
    const serials = item.serialNumbers || [];
    const barcodes = item.internalBarcodes || [];
    if (item.trackingMode === "serial" && serials.length !== Number(item.quantity)) throw new Error("Sản phẩm quản lý IMEI/serial phải chọn đủ mã theo số lượng.");
    if (item.trackingMode === "unit_barcode" && barcodes.length !== Number(item.quantity)) throw new Error("Sản phẩm quản lý mã vạch phải chọn đủ mã theo số lượng.");
    if (item.trackingMode !== "serial" && serials.length) throw new Error("Sản phẩm này không hỗ trợ IMEI/serial.");
    if (item.trackingMode !== "unit_barcode" && barcodes.length) throw new Error("Sản phẩm này không hỗ trợ mã vạch từng đơn vị.");
    if (new Set(serials.map((serial) => String(serial).trim().toUpperCase())).size !== serials.length) throw new Error("IMEI/serial trong đơn không được trùng.");
    if (new Set(barcodes.map((barcode) => String(barcode).trim().toUpperCase())).size !== barcodes.length) throw new Error("Mã vạch trong đơn không được trùng.");
  }
}

async function enqueueOrderTierRefresh(scope: RetailBranchScope, action: "confirm" | "cancel", order: any, session: mongoose.ClientSession) {
  const refresh = tierRefreshForOrderChange(action, order);
  if (refresh) await enqueueTierRefresh(scope, refresh.customerId, refresh.sourceKey, session);
}
export function scheduleOrderTierRefreshAfterCommit(
  scope: RetailBranchScope,
  action: "confirm" | "cancel",
  order: any,
  processor = processTierRefreshBySourceKey,
) {
  const refresh = tierRefreshForOrderChange(action, order);
  if (!refresh) return false;
  setImmediate(() => void processor(scope.companyCode, refresh.sourceKey).catch((error) => console.error("[retail-tier-refresh]", error)));
  return true;
}

export async function awardOrderPoints(scope: RetailBranchScope, order: any, session: mongoose.ClientSession) {
  if (!order.customerId) return;
  if ((await getPointPolicy(scope.companyCode)).enabled) return earnOrderPoints(scope, order, session);
  try {
    const settings = await CustomerSettingsService.getSettings(scope.companyCode).catch(() => null);
    if (settings?.pointsPolicy && !settings.pointsPolicy.enabled) return;

    const grossProfitPerPoint = settings?.pointsPolicy?.grossProfitPerPoint || 10000;
    const grossProfit = Math.max(0, Number(order.grandTotal || 0) - Number(order.totalCost || 0));
    if (grossProfit <= 0) return;

    const customer = await CustomerModel.findOne({ _id: order.customerId, companyCode: scope.companyCode }).session(session).lean();
    const multiplier = Number(customer?.tier?.pointMultiplier || 1);
    const basePoints = Math.floor(grossProfit / grossProfitPerPoint);
    const points = Math.floor(basePoints * (multiplier > 0 ? multiplier : 1));

    if (points > 0) {
      await CustomerPointService.earnPoints({
        companyCode: scope.companyCode,
        branchId: scope.branchId,
        customerId: String(order.customerId),
        points,
        sourceType: "retail_order",
        sourceId: String(order._id),
        sourceCode: order.orderCode,
        reason: `Tích điểm đơn hàng ${order.orderCode}`,
        session,
      });
    }
  } catch (err) {
    console.error("[awardOrderPoints] error:", err);
  }
}


export async function redeemRetailOrderPoints(scope: RetailBranchScope, order: any, actor: any, session: mongoose.ClientSession) {
  const points = Number(order.pointsRedeemed || 0);
  if (!points) return;
  if (!order.customerId) throw new Error("Vui lòng chọn khách hàng để sử dụng điểm.");
  await postPoints({ ...scope, customerId: String(order.customerId), sourceKey: `order:${order._id}:redeem`, sourceId: String(order._id), type: "redeem", points: -points, reason: "Sử dụng điểm thanh toán tại POS", actorId: actorId(actor) }, session);
}

async function revertOrderPointsOnCancel(scope: RetailBranchScope, order: any, actor: any, session: mongoose.ClientSession) {
  if (!order.customerId) return;
  await reverseOrderPoints(scope, order, `order:${order._id}:cancel`, Number(order.grandTotal), actorId(actor), session);
  try {
    const earnLedger = await CustomerPointLedgerModel.findOne({
      companyCode: scope.companyCode,
      sourceId: String(order._id),
      type: "EARN_ORDER",
    }).session(session);

    if (earnLedger && earnLedger.points > 0) {
      const priorReverts = await CustomerPointLedgerModel.find({
        companyCode: scope.companyCode,
        sourceId: String(order._id),
        type: "REFUND_REVERT",
      }).session(session);
      const alreadyReverted = priorReverts.reduce((sum: number, r: any) => sum + Math.abs(r.points), 0);
      const toRevert = Math.max(0, earnLedger.points - alreadyReverted);
      if (toRevert > 0) {
        await CustomerPointService.revertRefundPoints({
          companyCode: scope.companyCode,
          branchId: scope.branchId,
          customerId: String(order.customerId),
          points: toRevert,
          sourceType: "retail_order",
          sourceId: String(order._id),
          sourceCode: order.orderCode,
          reason: `Thu hồi điểm do hủy đơn hàng ${order.orderCode}`,
          actor: { id: actorId(actor), name: actorName(actor) },
          session,
        });
      }
    }
  } catch (err) {
    console.error("[revertOrderPointsOnCancel] error:", err);
  }
}

type PaymentInput = { method: unknown; amount: unknown; tenderedAmount?: unknown; reference?: unknown };

export function requireRetailPaymentCustomer(customerId: unknown) {
  if (!String(customerId || "").trim()) {
    throw new Error("Bán nợ cần chọn khách hàng.");
  }
}
export function buildRetailCustomerSnapshots(customer: any, billing: any | null = null) {
  return { customerId: customer.customerId, customerName: customer.name, customerPhone: customer.phone, customerSnapshot: { customerId: customer.customerId, customerCode: customer.customerCode, name: customer.name, phone: customer.phone }, ...(billing ? { billingProfileId: billing.profileId, billingSnapshot: { legalName: billing.legalName, taxId: billing.taxId, address: billing.address, invoiceEmail: billing.invoiceEmail, contactName: billing.contactName } } : {}) };
}
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
async function touchPosSession(shift: any, scope: RetailBranchScope, actor: any, session: mongoose.ClientSession) {
  if (!shift?._id) return;
  const now = new Date();
  const open = await CashierShiftModel.updateOne({
    _id: String(shift._id), ...scope, cashierId: actorId(actor), terminalId: shift.terminalId, status: "open",
    $or: [
      { operationalEndsAt: { $gte: now } },
      { operationalEndsAt: { $exists: false }, businessDate: businessDateInVietnam(now) },
    ],
  }, { $inc: { activityVersion: 1 }, $set: { lastActivityAt: now } }, { session });
  if (open.modifiedCount !== 1) throw retailError("Phiên POS đã đóng hoặc hết hạn. Hãy kiểm tra trạng thái phiên trước khi bán tiếp.", "POS_SESSION_CLOSED");
}
const canonicalRetailRequest = (value: any): any => Array.isArray(value) ? value.map(canonicalRetailRequest) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalRetailRequest(value[key])])) : value;
export function retailDraftRequestFingerprint(input: any) {
  const { idempotencyKey: _idempotencyKey, ...payload } = input || {};
  return JSON.stringify(canonicalRetailRequest(payload));
}
export { orderExtras as retailOrderExtras };
export function retailInstallmentAmounts(total: number, installment: { prepayPercent: number } | null | undefined, collected: number, pendingTransferAmount = 0) {
  if (!installment) return null;
  const upfrontAmount = Math.round(total * installment.prepayPercent / 100);
  if (!Number.isSafeInteger(pendingTransferAmount) || pendingTransferAmount < 0 || collected + pendingTransferAmount !== upfrontAmount) throw retailError("Số tiền thu phải khớp khoản trả trước đã chọn.", "INSTALLMENT_UPFRONT_MISMATCH", 400);
  return { upfrontAmount, financedAmount: total - upfrontAmount };
}

export function assertRetailPosSession(input: { posSessionId?: string; terminalId?: string }, shift: { _id?: unknown; terminalId?: string } | null) {
  if (input.posSessionId && String(input.posSessionId) !== String(shift?._id || "")) throw retailError("Phiên POS đã thay đổi. Hãy tải lại quầy bán hàng.", "POS_SESSION_INVALID", 409);
  if (input.terminalId && shift?.terminalId && String(input.terminalId) !== String(shift.terminalId)) throw retailError("Phiên POS đang mở trên máy khác. Hãy tiếp tục phiên trên máy này trước khi bán.", "POS_TERMINAL_CHANGED", 409);
}


function orderExtras(input: any) {
  const note = String(input.note || "").trim();
  if (note.length > 2000) throw retailError("Ghi chú tối đa 2000 ký tự.", "ORDER_NOTE_INVALID", 400);
  if (!input.installment) return { note, installment: null };
  const partner = String(input.installment.partner || "").trim();
  const months = Number(input.installment.months), prepayPercent = Number(input.installment.prepayPercent);
  if (!partner || partner.length > 100 || !Number.isSafeInteger(months) || months < 1 || months > 60 || !Number.isFinite(prepayPercent) || prepayPercent < 0 || prepayPercent > 100) throw retailError("Thông tin trả góp không hợp lệ.", "INSTALLMENT_INVALID", 400);
  return { note, installment: { partner, months, prepayPercent } };
}
function draftRequestFingerprint(operation: string, scope: RetailBranchScope, actor: any, input: any, orderId?: string) {
  const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const fields = ["items", "customerId", "billingProfileId", "orderDiscount", "taxRate", "shippingFee", "dueDate", "couponCode", "pointsToRedeem", "manualOrderDiscount", "collaboratorId", "retailPartnerId", "salespersonId", "salespersonName", "note", "installment", ...(orderId ? ["version"] : [])];
  return createHash("sha256").update(JSON.stringify(canonical({ operation, ...scope, actorId: actorId(actor), ...(orderId ? { orderId } : {}), input: Object.fromEntries(fields.map((field) => [field, input[field]])) }))).digest("hex");
}
const replayConflict = () => retailError("Khóa xác nhận không khớp yêu cầu hoặc thiếu chứng từ gốc. Vui lòng đối chiếu đơn hàng.", "ORDER_IDEMPOTENCY_CONFLICT");
async function confirmedResult(scope: RetailBranchScope, attempt: any, session?: mongoose.ClientSession) {
  if (!attempt.orderId || !attempt.invoiceId || !Types.ObjectId.isValid(attempt.orderId) || !Types.ObjectId.isValid(attempt.invoiceId)) throw replayConflict();
  const order = await RetailOrderModel.findOne({ _id: attempt.orderId, ...scope }).session(session || null).lean();
  const invoice = await RetailInvoiceModel.findOne({ _id: attempt.invoiceId, orderId: attempt.orderId, ...scope }).session(session || null).lean();
  if (!order || !invoice) throw replayConflict();
  return { order, invoice };
}
const monthlyScope = (businessDate: string) => businessDate.replace("-", "").slice(0, 6);
export function formatRetailDocumentCode(prefix: string, branchCode: string, scope: string, seq: number) {
  return `${prefix.trim().toUpperCase()}-${branchCode.trim().toUpperCase()}-${scope}-${String(seq).padStart(6, "0")}`;
}
export function legacyRetailPaymentCode(orderCode: string) {
  return orderCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function retailPaymentCode(orderCode: string) {
  const normalized = legacyRetailPaymentCode(orderCode);
  return normalized.startsWith("AKM") ? normalized : `AKM${normalized}`;
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

export function snapshotRetailProductForPricing(product: any, item: any) {
  const text = (value: unknown) => String(value || "").trim();
  return {
    productId: String(product._id), sku: text(product.sku), productName: text(product.name), unit: text(product.unit),
    ...(text(product.category) ? { category: text(product.category) } : {}), ...(text(product.brand) ? { brand: text(product.brand) } : {}),
    quantity: Number(item.quantity), unitPrice: Number(product.price || 0), unitCost: Number(product.costPrice || 0),
    ...(product.trackingMode ? { trackingMode: product.trackingMode } : item.trackingMode ? { trackingMode: item.trackingMode } : {}),
    ...(product.variantId || item.variantId ? { variantId: String(product.variantId || item.variantId) } : {}),
    ...(Array.isArray(item.serialNumbers) ? { serialNumbers: item.serialNumbers } : {}), discount: toDiscountInput(item.discount ?? item.discountAmount),
    ...(Array.isArray(item.internalBarcodes) ? { internalBarcodes: item.internalBarcodes } : {}),
    note: text(item.note) || undefined,
  };
}

async function priceInput(scope: RetailBranchScope, input: any, session?: mongoose.ClientSession, persistedDraft = false) {
  const settings = await getResolvedRetailSettings(scope);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const ids = rawItems.map((item: any) => String(item.productId || ""));
  if (!ids.length || ids.some((id: string) => !Types.ObjectId.isValid(id))) throw new Error("Danh sách sản phẩm không hợp lệ.");
  const variants = await ProductVariantModel.find({ _id: { $in: ids }, companyCode: scope.companyCode, status: "active" }).session(session || null).lean();
  const byId = new Map(variants.map((variant: any) => [String(variant._id), variant]));
  const productIds = [...new Set(variants.map((variant: any) => String(variant.productId)))];
  const products = await ProductCatalogModel.find({ _id: { $in: productIds }, companyCode: scope.companyCode, status: "active" }).session(session || null).lean();
  const productById = new Map(products.map((product: any) => [String(product._id), product]));
  const prices = await ProductPriceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, variantId: { $in: ids }, status: "active" }).session(session || null).lean();
  const priceById = new Map(prices.map((price: any) => [String(price.variantId), price]));
  const defaultWarehouse = await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  const balances = await InventoryBalanceModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(defaultWarehouse._id), variantId: { $in: ids } }).session(session || null).lean();
  const balanceById = new Map<string, any>();
  for (const balance of balances as any[]) {
    const key = String(balance.variantId); const current = balanceById.get(key) || { quantity: 0, reservedQuantity: 0 };
    current.quantity += Number(balance.quantity || 0); current.reservedQuantity += Number(balance.reservedQuantity || 0); balanceById.set(key, current);
  }
  if (byId.size !== new Set(ids).size) throw new Error("SKU không thuộc danh mục đang bán.");
  const items = rawItems.map((item: any) => { const variant: any = byId.get(String(item.productId)); const product: any = productById.get(String(variant.productId)); const price: any = priceById.get(String(variant._id)); const balance: any = balanceById.get(String(variant._id)); if (!product || !price) throw new Error("Sản phẩm chưa được khai báo giá bán."); const available = Number(balance?.quantity || 0) - Number(balance?.reservedQuantity || 0); if (available < Number(item.quantity)) throw new Error(`Tồn kho của ${product.name} không đủ.`); return { product: { _id: variant._id, sku: variant.sku, name: product.name, unit: variant.unitCode, category: product.categoryCode, brand: product.brandCode, price: price.sellingPrice, costPrice: price.costPrice, trackingMode: variant.trackingMode, variantId: variant._id }, item }; }).map(({ product, item }: any) => snapshotRetailProductForPricing(product, item));
  validateRetailSerialItems(items);
  const couponCode = typeof input.couponCode === "string" ? input.couponCode.trim() : "";
  let orderDiscount = toDiscountInput(input.manualOrderDiscount ?? (persistedDraft && couponCode ? 0 : input.orderDiscount)) || { type: "amount" as const, value: 0 };
  const manualOrderDiscount = orderDiscount;
  let couponSnapshot: Awaited<ReturnType<typeof resolveCoupon>> | null = null;
  if (couponCode) {
    // Persisted drafts store the calculated coupon amount in orderDiscount.
    if ((!persistedDraft && orderDiscount.value !== 0) || items.some((item) => Number(item.discount?.value || 0) !== 0)) throw new Error("Mã ưu đãi không cộng dồn với giảm giá thủ công.");
    const base = calculateOrderTotals({ items, orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0, maxDiscountPercent: settings.maxDiscountPercent });
    couponSnapshot = await resolveCoupon(scope, couponCode, base.subtotal, session, input.customerId);
    orderDiscount = { type: "amount", value: couponSnapshot.amount };
  }
  const options = { items, taxRate: input.taxRate === undefined ? settings.defaultTaxRate : Number(input.taxRate), shippingFee: Number(input.shippingFee || 0), maxDiscountPercent: settings.maxDiscountPercent };
  const beforePoints = calculateOrderTotals({ ...options, orderDiscount });
  const redemption = await quotePointRedemption(scope.companyCode, input.customerId, input.pointsToRedeem, beforePoints.subtotal - beforePoints.orderDiscount, session);
  const pricing = redemption.amount ? calculateOrderTotals({ ...options, orderDiscount: { type: "amount", value: beforePoints.orderDiscount + redemption.amount } }) : beforePoints;
  const manualAmount = calculateOrderTotals({ ...options, orderDiscount: manualOrderDiscount }).orderDiscount;
  return { settings, pricing: { ...pricing, manualOrderDiscount: manualAmount, pointsToRedeem: redemption.points, pointsDiscount: redemption.amount, couponCode: couponSnapshot?.code || "", couponSnapshot } };
}

function snapshotPayment(item: any, shift: any, actor: any) { return { ...item, recordedAt: new Date(), settlementStatus: shift?._id ? "assigned" : "unassigned", paidAt: new Date(), receivedBy: actorId(actor), receivedByName: actorName(actor), shiftId: shift?._id ? String(shift._id) : undefined, businessDate: shift?.businessDate || businessDateInVietnam(new Date()) }; }

export function customerLookupFilter(scope: RetailBranchScope, customerId: string) {
  return { _id: customerId, companyCode: scope.companyCode };
}

async function resolveOrderCustomer(scope: RetailBranchScope, customerId: unknown, session?: any) {
  const id = String(customerId || "").trim();
  if (!id) return null;
  const customer = await getCustomerBrief({ companyCode: scope.companyCode }, id);
  if (!customer) throw new Error("Không tìm thấy khách hàng.");
  return { ...customer, _id: customer.customerId };
}

async function resolveOrderCustomerSnapshots(scope: RetailBranchScope, customerId: unknown, billingProfileId?: unknown) {
  const customer = await resolveOrderCustomer(scope, customerId);
  if (!customer) return null;
  const profileId = String(billingProfileId || "").trim();
  const billing = profileId ? await getBillingProfile({ companyCode: scope.companyCode }, customer.customerId, profileId) : null;
  if (profileId && !billing) throw new Error("Không tìm thấy hồ sơ xuất VAT đang hoạt động.");
  return buildRetailCustomerSnapshots(customer, billing);
}

function confirmationIdentity(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const key = String(input.idempotencyKey || "").trim(); if (!key) throw new Error("Idempotency key là bắt buộc.");
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw retailError("Phiên bản đơn xác nhận là bắt buộc.", "ORDER_VERSION_REQUIRED", 400);
    const expectedGrandTotal = Number(input.expectedGrandTotal);
    if (!Number.isSafeInteger(expectedGrandTotal) || expectedGrandTotal < 0) throw new Error("Tổng tiền xác nhận không hợp lệ.");
    const requestPayments = normalizePayments(input.payments || [], expectedGrandTotal);
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ version: 1,
      companyCode: scope.companyCode, branchId: scope.branchId, orderId: id,
      operation: "confirm-order", actorId: actorId(actor), shiftId: String(input.posSessionId || shift?._id || ""),
      expectedVersion: input.expectedVersion, expectedGrandTotal, payments: requestPayments.payments,
    })).digest("hex");
    return { key, requestFingerprint, requestPayments, expectedGrandTotal };
}
const checkoutCanonical = (value: any): any => Array.isArray(value) ? value.map(checkoutCanonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, checkoutCanonical(value[key])])) : value;
function directCheckoutIdentity(scope: RetailBranchScope, input: any, actor: any) {
  const key = String(input?.idempotencyKey || "");
  const orderInput = input?.input;
  const posSessionId = String(input?.posSessionId || "");
  const expectedGrandTotal = Number(input?.expectedGrandTotal);
  const requestedPaymentCode = input?.paymentCode === undefined ? undefined : String(input.paymentCode).trim().toUpperCase();
  const pendingTransferAmount = Number(input?.pendingTransferAmount || 0);
  if (!key.trim() || key !== key.trim() || !actorId(actor) || !posSessionId || !orderInput || typeof orderInput !== "object" || Array.isArray(orderInput)) throw replayConflict();
  if (!Number.isSafeInteger(expectedGrandTotal) || expectedGrandTotal < 0) throw retailError("Tổng tiền xác nhận không hợp lệ.", "ORDER_TOTAL_INVALID", 400);
  if (requestedPaymentCode !== undefined && !/^AKM[A-Z0-9]{6,29}$/.test(requestedPaymentCode)) throw retailError("Mã thanh toán QR không hợp lệ.", "PAYMENT_CODE_INVALID", 400);
  const normalized = normalizePayments(input.payments || [], expectedGrandTotal);
  if (!Number.isSafeInteger(pendingTransferAmount) || pendingTransferAmount < 0 || normalized.total + pendingTransferAmount > expectedGrandTotal) throw retailError("Số tiền chuyển khoản chờ xác nhận không hợp lệ.", "PENDING_TRANSFER_INVALID", 400);
  if (pendingTransferAmount > 0 && !requestedPaymentCode) throw retailError("Thiếu mã thanh toán cho giao dịch QR.", "PAYMENT_CODE_REQUIRED", 400);
  const requestFingerprint = createHash("sha256").update(JSON.stringify(checkoutCanonical({
    version: 1, operation: "checkout-order", ...scope, actorId: actorId(actor), posSessionId,
    input: orderInput, expectedGrandTotal, payments: normalized.payments, paymentCode: requestedPaymentCode,
    ...(pendingTransferAmount > 0 ? { pendingTransferAmount } : {}),
  }))).digest("hex");
  return { key, orderInput, posSessionId, expectedGrandTotal, normalized, paymentCode: requestedPaymentCode, pendingTransferAmount, requestFingerprint };
}
function checkoutIdentity(scope: RetailBranchScope, input: any, actor: any) {
  const key = input?.idempotencyKey, payload = input?.payload;
  if (typeof key !== "string" || !key.trim() || key !== key.trim() || !payload || !actorId(actor)) throw replayConflict();
  if (payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)) {
    const direct = directCheckoutIdentity(scope, { ...payload, idempotencyKey: key }, actor);
    return { direct: true as const, ...direct };
  }
  if (payload.posSessionId !== undefined && (typeof payload.posSessionId !== "string" || !payload.posSessionId.trim())) throw replayConflict();
  if (payload.draftCreation && payload.draftUpdate) throw replayConflict();
  const request = payload.draftCreation || payload.draftUpdate;
  const operation = payload.draftCreation ? "create-draft" : "update-draft";
  let orderId = payload.draftUpdate?.orderId || payload.draftId;
  let expectedVersion = payload.draftVersion;
  if (request) {
    if (typeof request.idempotencyKey !== "string" || !request.idempotencyKey.trim() || request.idempotencyKey !== request.idempotencyKey.trim() || request.idempotencyKey === key || !request.input || typeof request.input !== "object" || Array.isArray(request.input)) throw replayConflict();
    expectedVersion = operation === "create-draft" ? 0 : request.input.version + 1;
    if (operation === "update-draft" && (!Types.ObjectId.isValid(orderId) || !Number.isSafeInteger(request.input.version) || request.input.version < 0)) throw replayConflict();
    if (payload.draftSaved === true && payload.draftVersion !== expectedVersion) throw replayConflict();
    if (payload.draftUpdate && payload.draftId !== orderId) throw replayConflict();
  } else if (payload.draftSaved !== true || !Types.ObjectId.isValid(orderId)) throw replayConflict();
  // Keep the existing confirmation normalization and v1 fingerprint unchanged.
  const confirmInput = { idempotencyKey: key, expectedVersion, expectedGrandTotal: payload.expectedGrandTotal, payments: payload.payments, posSessionId: payload.posSessionId };
  confirmationIdentity(scope, orderId || "", confirmInput, actor);
  const requestFingerprint = createHash("sha256").update(JSON.stringify(checkoutCanonical({ version: 1, ...scope, actorId: actorId(actor),
    draft: request ? { operation, request, ...(operation === "update-draft" ? { orderId } : {}) } : { orderId, expectedVersion },
    ...(payload.posSessionId ? { posSessionId: payload.posSessionId } : {}),
    expectedGrandTotal: payload.expectedGrandTotal, payments: payload.payments,
  }))).digest("hex");
  return { direct: false as const, key, payload, request, operation, orderId, expectedVersion, confirmInput, requestFingerprint };
}
async function checkoutEvidence(scope: RetailBranchScope, input: any, actor: any, session: mongoose.ClientSession, revoke: boolean, canManage: boolean) {
  const intent = checkoutIdentity(scope, input, actor);
  const filter = { companyCode: scope.companyCode, key: intent.key };
  const attempt = await RetailIdempotencyModel.findOne(filter).session(session).lean();
  if (intent.direct) {
    if (attempt) {
      if (attempt.branchId !== scope.branchId || attempt.requestFingerprint !== intent.requestFingerprint) throw replayConflict();
      if (attempt.operation === "revoke-checkout" && attempt.status === "revoked") return { status: "revoked" as const, message: "Yêu cầu thanh toán đã thu hồi." };
      if (attempt.operation !== "checkout-order") throw replayConflict();
      if (attempt.status !== "completed") {
        if (revoke) throw replayConflict();
        return { status: "processing" as const, message: "Yêu cầu đang được xử lý. Giữ nguyên để đối chiếu." };
      }
      const result = await confirmedResult(scope, attempt, session);
      if (String(result.order.createdBy) !== actorId(actor) && !canManage) throw retailError("Bạn không được xem giao dịch này.", "ORDER_FORBIDDEN", 403);
      return { status: "completed" as const, message: "Đã đối chiếu yêu cầu và hóa đơn gốc.", ...result };
    }
    if (!revoke) return { status: "not_found" as const, message: "Chưa ghi nhận thanh toán. Giữ nguyên yêu cầu để đồng bộ lại." };
    await RetailIdempotencyModel.create([{ ...scope, key: intent.key, operation: "revoke-checkout", requestFingerprint: intent.requestFingerprint, status: "revoked" }], { session });
    return { status: "revoked" as const, message: "Đã thu hồi yêu cầu thanh toán chưa ghi nhận." };
  }
  if (attempt?.operation === "revoke-checkout") {
    if (attempt.branchId !== scope.branchId || attempt.requestFingerprint !== intent.requestFingerprint || attempt.status !== "revoked") throw replayConflict();
    return { status: "revoked" as const, message: "Yêu cầu đã thu hồi. Khóa cũ không thể thanh toán." };
  }
  let orderId = intent.orderId;
  let draftGate: any;
  let draftFingerprint: string | undefined;
  if (intent.request) {
    draftFingerprint = draftRequestFingerprint(intent.operation, scope, actor, intent.request.input, intent.operation === "update-draft" ? orderId : undefined);
    draftGate = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key: intent.request.idempotencyKey }).session(session).lean();
    if (draftGate) {
      if (draftGate.branchId !== scope.branchId || draftGate.operation !== intent.operation || draftGate.requestFingerprint !== draftFingerprint) throw replayConflict();
      if (draftGate.status === "revoked" && !attempt) {
        if (!revoke) return { status: "not_found" as const, message: "Khóa nháp đã thu hồi. Cần thu hồi cả yêu cầu thanh toán trước khi bỏ." };
        await RetailIdempotencyModel.create([{ ...scope, key: intent.key, operation: "revoke-checkout", orderId, requestFingerprint: intent.requestFingerprint, status: "revoked" }], { session });
        return { status: "revoked" as const, message: "Đã thu hồi yêu cầu thanh toán có khóa nháp đã thu hồi." };
      }
      if (draftGate.status !== "completed" || !Types.ObjectId.isValid(draftGate.orderId)) throw replayConflict();
      if (orderId && orderId !== draftGate.orderId) throw replayConflict();
      orderId = draftGate.orderId;
    } else if (intent.payload.draftSaved === true || attempt) throw replayConflict();
  }
  if (attempt) {
    const identity = confirmationIdentity(scope, orderId, intent.confirmInput, actor);
    if (attempt.branchId !== scope.branchId || attempt.operation !== "confirm-order" || attempt.orderId !== orderId || attempt.requestFingerprint !== identity.requestFingerprint) throw replayConflict();
    if (attempt.status !== "completed") {
      if (revoke) throw replayConflict();
      return { status: "processing" as const, message: "Yêu cầu đang xử lý. Giữ nguyên để đối chiếu." };
    }
    const { order, invoice } = await confirmedResult(scope, attempt, session);
    assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
    const expected = identity.requestPayments;
    const snapshot: any = invoice.snapshot;
    const fields = (row: any) => ({ method: row.method, amount: row.amount, tenderedAmount: row.tenderedAmount, changeAmount: row.changeAmount, reference: row.reference });
    const same = (left: any, right: any) => JSON.stringify(checkoutCanonical(left)) === JSON.stringify(checkoutCanonical(right));
    const expectedShiftId = String(intent.payload.posSessionId || "");
    if (order.version < intent.expectedVersion + 1 || order.grandTotal !== identity.expectedGrandTotal || String(order.shiftId || "") !== expectedShiftId || !snapshot || snapshot.grandTotal !== identity.expectedGrandTotal || snapshot.paidAmount !== expected.total || snapshot.dueAmount !== identity.expectedGrandTotal - expected.total || !same(snapshot.payments?.map(fields), expected.payments) || !same(order.payments.slice(0, expected.payments.length).map(fields), expected.payments) || order.payments.slice(0, expected.payments.length).some(p => p.receivedBy !== actorId(actor) || String(p.shiftId || "") !== expectedShiftId) || order.payments.reduce((sum, p) => sum + p.amount, 0) !== order.paidAmount) throw replayConflict();
    return { status: "completed" as const, message: "Đã đối chiếu yêu cầu và hóa đơn gốc.", order, invoice };
  }
  if (!revoke) return { status: "not_found" as const, message: "Chưa ghi nhận xác nhận. Giữ nguyên yêu cầu; đây không phải quyền xóa." };
  if (orderId) {
    const order = await RetailOrderModel.findOne({ _id: orderId, ...scope }).session(session).lean();
    const version = intent.request && !draftGate && intent.operation === "update-draft" ? intent.request.input.version : intent.expectedVersion;
    if (!order || order.status !== "draft" || order.version !== version || order.stockApplied || order.paidAmount || order.refundedAmount || order.payments.length || order.refunds.length || await RetailInvoiceModel.exists({ ...scope, orderId }).session(session)) throw replayConflict();
    assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
  } else if (!intent.request || intent.operation !== "create-draft" || draftGate) throw replayConflict();
  // Reserve both identities atomically when draft saving may still be in flight.
  if (intent.request && !draftGate) await RetailIdempotencyModel.create([{ ...scope, key: intent.request.idempotencyKey, operation: intent.operation, orderId, requestFingerprint: draftFingerprint, status: "revoked" }], { session });
  await RetailIdempotencyModel.create([{ ...scope, key: intent.key, operation: "revoke-checkout", orderId, requestFingerprint: intent.requestFingerprint, status: "revoked" }], { session });
  return { status: "revoked" as const, message: "Đã thu hồi yêu cầu chưa thanh toán. Bản nháp đã lưu được giữ nguyên." };
}

function collectionIdentity(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const key = String(input.idempotencyKey || "").trim();
    if (!key || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw retailError("Khóa thao tác và phiên bản đơn là bắt buộc.", "COLLECTION_INVALID", 400);
    let normalized: ReturnType<typeof normalizePayments>;
    try {
      normalized = normalizePayments(input.payments || [], Number.MAX_SAFE_INTEGER);
      if (!normalized.total) throw new Error("Số tiền thu phải lớn hơn 0.");
    } catch (error: any) { throw retailError(error.message, "COLLECTION_INVALID", 400); }
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ version: 1, operation: "collect-order",
      companyCode: scope.companyCode, branchId: scope.branchId, orderId: id, actorId: actorId(actor),
      shiftId: String(shift?._id || ""), expectedVersion: input.expectedVersion, payments: normalized.payments,
    })).digest("hex");
    return { key, normalized, requestFingerprint };
}

function cancellationIdentity(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const reason = String(input.reason || "").trim();
    const key = String(input.idempotencyKey || "").trim();
    if (!reason || !key || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) throw retailError("Lý do, khóa thao tác và phiên bản đơn là bắt buộc.", "CANCELLATION_INVALID", 400);
    let refunds: ReturnType<typeof normalizePayments>;
    try { refunds = normalizePayments(input.refunds || [], Number.MAX_SAFE_INTEGER); }
    catch (error: any) { throw retailError(error.message, "CANCELLATION_INVALID", 400); }
    const requestFingerprint = createHash("sha256").update(JSON.stringify({ version: 1, operation: "cancel-order",
      companyCode: scope.companyCode, branchId: scope.branchId, orderId: id, actorId: actorId(actor),
      shiftId: String(shift?._id || ""), expectedVersion: input.expectedVersion, reason, refunds: refunds.payments,
    })).digest("hex");
    return { reason, key, refunds, requestFingerprint };
}
function cancellationDigest(order: any) {
  return createHash("sha256").update(JSON.stringify({
    id: String(order._id), companyCode: order.companyCode, branchId: order.branchId,
    status: order.status, version: order.version, reason: order.cancelReason, cancelledAt: order.cancelledAt,
    paidAmount: order.paidAmount, refundedAmount: order.refundedAmount, grandTotal: order.grandTotal,
    stockApplied: order.stockApplied, stockRevertedAt: order.stockRevertedAt,
    restockReceiptId: order.restockReceiptId, createdBy: order.createdBy,
    refunds: order.refunds.map((p: any) => ({ method: p.method, amount: p.amount, reference: p.reference, refundedAt: p.refundedAt, refundedBy: p.refundedBy, shiftId: p.shiftId, reason: p.reason })),
  })).digest("hex");
}
async function draftRequestEvidence(scope: RetailBranchScope, input: any, actor: any, session: mongoose.ClientSession, revoke: boolean, canManage: boolean) {
  const { request, orderId } = input || {};
  if (!request || typeof request.idempotencyKey !== "string" || !request.idempotencyKey.trim() || request.idempotencyKey !== request.idempotencyKey.trim() || !request.input || typeof request.input !== "object" || Array.isArray(request.input) || !actorId(actor)) throw replayConflict();
  const updating = orderId !== undefined;
  if (updating && (!Types.ObjectId.isValid(orderId) || !Number.isSafeInteger(request.input.version) || request.input.version < 0)) throw replayConflict();
  const operation = updating ? "update-draft" : "create-draft";
  const requestFingerprint = draftRequestFingerprint(operation, scope, actor, request.input, orderId);
  const filter = { companyCode: scope.companyCode, key: request.idempotencyKey };
  const attempt = await RetailIdempotencyModel.findOne(filter).session(session).lean();
  if (attempt) {
    if (attempt.branchId !== scope.branchId || attempt.operation !== operation || attempt.requestFingerprint !== requestFingerprint || (updating && attempt.orderId !== orderId)) throw replayConflict();
    if (attempt.status === "revoked") return { status: "revoked" as const, message: "Yêu cầu nháp đã thu hồi. Khóa cũ không thể ghi lại." };
    if (attempt.status !== "completed") {
      if (revoke) throw replayConflict();
      return { status: "processing" as const, message: "Yêu cầu đang xử lý. Giữ bản lưu để đối chiếu." };
    }
    if (!Types.ObjectId.isValid(attempt.orderId)) throw replayConflict();
    const order = await RetailOrderModel.findOne({ _id: attempt.orderId, ...scope }).session(session).lean();
    if (!order || !Number.isSafeInteger(order.version) || order.version < (updating ? request.input.version + 1 : 0) || (!updating && String(order.createdBy) !== actorId(actor))) throw replayConflict();
    assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
    // The completed gate proves the original write; never replay it over later edits.
    return { status: "completed" as const, message: "Đã xác minh lần lưu nháp gốc. Đơn hiện tại được giữ nguyên.", order: { _id: String(order._id), version: order.version, status: order.status } };
  }
  if (updating) {
    const order = await RetailOrderModel.findOne({ _id: orderId, ...scope }).session(session).lean();
    if (!order) throw replayConflict();
    assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
    if (revoke && (order.status !== "draft" || order.version !== request.input.version || order.stockApplied || order.paidAmount || order.refundedAmount || order.payments.length || order.refunds.length || await RetailInvoiceModel.exists({ ...scope, orderId }).session(session))) throw replayConflict();
  }
  if (!revoke) return { status: "not_found" as const, message: "Chưa tìm thấy lần lưu. Giữ yêu cầu; kết quả này không cho phép xóa hoặc đổi khóa." };
  await RetailIdempotencyModel.create([{ ...scope, key: request.idempotencyKey, operation, orderId, requestFingerprint, status: "revoked" }], { session });
  return { status: "revoked" as const, message: "Đã thu hồi yêu cầu nháp chưa ghi nhận. Đơn đã lưu không bị xóa." };
}

export const RetailOrderService = {
  async reconcileDraftRequest(scope: RetailBranchScope, input: any, actor: any, canManage = false) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(() => draftRequestEvidence(scope, input, actor, session, false, canManage), { readConcern: { level: "snapshot" } }); }
    finally { await session.endSession(); }
  },
  async revokeDraftRequest(scope: RetailBranchScope, input: any, actor: any, canManage = false) {
    for (let retry = 0; retry < 3; retry++) {
      const session = await mongoose.startSession();
      try { return await session.withTransaction(() => draftRequestEvidence(scope, input, actor, session, true, canManage), { readConcern: { level: "snapshot" } }); }
      catch (error: any) { if (!(retry < 2 && error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key)) throw error; }
      finally { await session.endSession(); }
    }
    throw replayConflict();
  },
  async reconcileCheckout(scope: RetailBranchScope, input: any, actor: any, canManage = false) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(() => checkoutEvidence(scope, input, actor, session, false, canManage), { readConcern: { level: "snapshot" } }); }
    finally { await session.endSession(); }
  },
  async revokeCheckout(scope: RetailBranchScope, input: any, actor: any, canManage = false) {
    for (let retry = 0; retry < 3; retry++) {
      const session = await mongoose.startSession();
      try { return await session.withTransaction(() => checkoutEvidence(scope, input, actor, session, true, canManage), { readConcern: { level: "snapshot" } }); }
      catch (error: any) { if (!(retry < 2 && error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key)) throw error; }
      finally { await session.endSession(); }
    }
    throw replayConflict();
  },
  async quote(scope: RetailBranchScope, input: any) { return (await priceInput(scope, input)).pricing; },
  async list(scope: RetailBranchScope, query: any) {
    await expireHeldDrafts(scope, businessDateInVietnam(new Date()));
    const { filter, page, limit, skip } = buildOrderListQuery(scope, query);
    const [items, total] = await Promise.all([RetailOrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), RetailOrderModel.countDocuments(filter)]); return { items: await attachAfterSaleHistory(scope, items), total, page, limit };
  },
  async idempotency(scope: RetailBranchScope, key: string) {
    const attempt = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key: String(key || "").trim() }).lean();
    if (!attempt || attempt.branchId !== scope.branchId) return { status: "not_found" as const };
    if (attempt.operation === "revoke-checkout") return { status: "not_found" as const };
    if (!(attempt.operation === "confirm-order" || attempt.operation === "checkout-order") || !attempt.requestFingerprint) throw replayConflict();
    if (attempt.status !== "completed") return { status: "processing" as const };
    return { status: "completed" as const, ...await confirmedResult(scope, attempt) };
  },
  async detail(scope: RetailBranchScope, id: string, actor?: any, canManage = false) { if (!Types.ObjectId.isValid(id)) throw new Error("Mã đơn không hợp lệ."); const order: any = await RetailOrderModel.findOne({ _id: id, ...scope }).lean(); if (!order) throw new Error("Không tìm thấy đơn hàng."); if (order.status === "draft" && actor) assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage); return (await attachAfterSaleHistory(scope, [order]))[0]; },
  async paymentStatus(scope: RetailBranchScope, id: string, actor: any, canManage = false) {
    if (!Types.ObjectId.isValid(id)) throw retailError("Mã đơn không hợp lệ.", "ORDER_ID_INVALID", 400);
    const order: any = await RetailOrderModel.findOne({ _id: id, ...scope })
      .select("_id orderCode createdBy paidAmount dueAmount pendingTransferAmount paymentStatus status version payments")
      .lean();
    if (!order) throw retailError("Không tìm thấy đơn hàng.", "ORDER_NOT_FOUND", 404);
    if (!canManage && String(order.createdBy) !== actorId(actor)) throw retailError("Bạn không được xem trạng thái thanh toán của đơn này.", "ORDER_FORBIDDEN", 403);
    return {
      _id: String(order._id), orderCode: order.orderCode, paidAmount: Number(order.paidAmount || 0),
      dueAmount: Number(order.dueAmount || 0), pendingTransferAmount: Number(order.pendingTransferAmount || 0),
      paymentStatus: order.paymentStatus, status: order.status, version: Number(order.version || 0),
      payments: (order.payments || []).map(({ method, amount, tenderedAmount, changeAmount, reference }: any) => ({ method, amount, tenderedAmount, changeAmount, reference })),
    };
  },
  async createDraft(scope: RetailBranchScope, input: any, actor: any) {
    const currentBusinessDate = businessDateInVietnam(new Date());
    await expireHeldDrafts(scope, currentBusinessDate);
    const creator = actorId(actor);
    const key = String(input.idempotencyKey || "").trim();
    if (!key) throw retailError("Khóa tạo bản nháp là bắt buộc.", "DRAFT_KEY_REQUIRED", 400);
    const requestFingerprint = draftRequestFingerprint("create-draft", scope, actor, input);
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.operation !== "create-draft" || attempt.requestFingerprint !== requestFingerprint || attempt.status !== "completed") throw replayConflict();
      const order = await RetailOrderModel.findOne({ _id: attempt.orderId, ...scope, createdBy: creator, status: "draft", version: 0 }).session(session || null).lean();
      if (!order) throw retailError("Bản nháp gốc đã thay đổi hoặc không còn tồn tại. Vui lòng đối chiếu, không tạo đơn thay thế.", "DRAFT_REPLAY_CONFLICT");
      return order;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        return await session.withTransaction(async () => {
          const existing = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
          if (existing) return replay(existing, session);
          await RetailIdempotencyModel.create([{ ...scope, key, operation: "create-draft", requestFingerprint, status: "processing" }], { session });
          const collaborator = await resolveCollaborator(scope.companyCode, input.collaboratorId ?? input.retailPartnerId, session, scope.branchId);
          const used = await RetailOrderModel.find({ ...scope, status: "draft", createdBy: creator }).select("heldSlot").session(session).lean();
          assertHeldDraftCapacity(used.length);
          const occupied = new Set(used.map((item: any) => Number(item.heldSlot)));
          const slot = [1, 2, 3, 4, 5].find((slot) => !occupied.has(slot));
          if (!slot) throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
          const { pricing } = await priceInput(scope, input, session);
          const customerSnapshot = await resolveOrderCustomerSnapshots(scope, input.customerId, input.billingProfileId);
          const [order] = await RetailOrderModel.create([{ ...scope, ...orderExtras(input), collaboratorId: collaborator ? String(collaborator._id) : undefined, couponCode: pricing.couponCode, couponSnapshot: pricing.couponSnapshot, manualOrderDiscount: pricing.manualOrderDiscount, pointsToRedeem: pricing.pointsToRedeem, pointsDiscount: pricing.pointsDiscount, items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee, grandTotal: pricing.grandTotal, totalCost: pricing.totalCost, payments: [], refunds: [], paidAmount: 0, refundedAmount: 0, dueAmount: pricing.grandTotal, paymentStatus: "unpaid", status: "draft", businessDate: currentBusinessDate, heldAt: new Date(), heldSlot: slot, salespersonId: String(input.salespersonId || creator), salespersonName: String(input.salespersonName || actorName(actor)), createdBy: creator, createdByName: actorName(actor), stockApplied: false, version: 0, ...(customerSnapshot || {}), dueDate: input.dueDate }], { session });
          await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", orderId: String(order._id) } }, { session });
          return order;
        });
      } catch (error: any) {
        if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
          const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
          if (existing) return replay(existing);
        }
        if (!(error?.code === 11000 && error?.keyPattern?.heldSlot && error?.keyPattern?.createdBy && error?.keyPattern?.branchId && error?.keyPattern?.companyCode)) throw error;
      } finally { await session.endSession(); }
    }
    throw retailError("Mỗi thu ngân chỉ được giữ tối đa 5 đơn.", "HELD_DRAFT_LIMIT");
  },
  async updateDraft(scope: RetailBranchScope, id: string, input: any, actor: any, canManage = false) {
    const currentBusinessDate = businessDateInVietnam(new Date());
    await expireHeldDrafts(scope, currentBusinessDate);
    const expectedVersion = input.version, key = String(input.idempotencyKey || "").trim();
    if (!key || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw retailError("Khóa sửa nháp và phiên bản là bắt buộc.", "DRAFT_UPDATE_INVALID", 400);
    const requestFingerprint = draftRequestFingerprint("update-draft", scope, actor, input, id);
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "update-draft" || attempt.requestFingerprint !== requestFingerprint || attempt.status !== "completed") throw replayConflict();
      const order = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft", version: expectedVersion + 1 }).session(session || null).lean();
      if (!order) throw retailError("Bản nháp đã thay đổi sau lần lưu gốc. Vui lòng đối chiếu.", "DRAFT_REPLAY_CONFLICT");
      assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
      return order;
    };
    const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (prior) return replay(prior);
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (prior) return replay(prior, session);
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, operation: "update-draft", requestFingerprint, status: "processing" }], { session });
        const existing: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft", version: expectedVersion }).session(session).lean();
        if (!existing) throw retailError("Đơn đã thay đổi hoặc không thể sửa.", "ORDER_VERSION_CONFLICT");
        assertHeldDraftAccess(String(existing.createdBy), actorId(actor), canManage);
        const collaborator = await resolveCollaborator(scope.companyCode, input.collaboratorId === undefined && input.retailPartnerId === undefined ? existing.collaboratorId || existing.retailPartnerId : input.collaboratorId ?? input.retailPartnerId, session, scope.branchId);
        const { pricing } = await priceInput(scope, input, session);
        const customerSnapshot = await resolveOrderCustomerSnapshots(scope, input.customerId, input.billingProfileId);
        const order = await RetailOrderModel.findOneAndUpdate({ _id: id, ...scope, status: "draft", version: expectedVersion }, { $set: { ...orderExtras(input), collaboratorId: collaborator ? String(collaborator._id) : null, retailPartnerId: collaborator ? String(collaborator._id) : null, retailPartnerSnapshot: collaborator ? { partnerId: String(collaborator._id), code: collaborator.code, name: collaborator.name } : null, couponCode: pricing.couponCode, couponSnapshot: pricing.couponSnapshot, manualOrderDiscount: pricing.manualOrderDiscount, pointsToRedeem: pricing.pointsToRedeem, pointsDiscount: pricing.pointsDiscount, items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount, taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee, grandTotal: pricing.grandTotal, totalCost: pricing.totalCost, dueAmount: pricing.grandTotal, ...(customerSnapshot || { customerId: undefined, customerName: undefined, customerPhone: undefined, billingProfileId: undefined, customerSnapshot: undefined, billingSnapshot: undefined }), dueDate: input.dueDate }, $inc: { version: 1 } }, { returnDocument: "after", session });
        if (!order) throw retailError("Đơn đã được thay đổi ở màn hình khác.", "ORDER_VERSION_CONFLICT");
        await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed" } }, { session });
        return order;
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (prior) return replay(prior);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async checkout(scope: RetailBranchScope, input: any, actor: any, shift: any = undefined, canManage = false) {
    const identity = directCheckoutIdentity(scope, input, actor);
    const { key, orderInput, posSessionId, expectedGrandTotal, normalized, paymentCode: requestedPaymentCode, pendingTransferAmount, requestFingerprint } = identity;
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, activeSession?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.operation !== "checkout-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status !== "completed") throw retailError("Yêu cầu thanh toán đang được xử lý. Vui lòng đối chiếu trước khi thử lại.", "ORDER_IDEMPOTENCY_PROCESSING");
      const result = await confirmedResult(scope, attempt, activeSession);
      if (String(result.order.createdBy) !== actorId(actor) && !canManage) throw retailError("Bạn không được xem giao dịch này.", "ORDER_FORBIDDEN", 403);
      return result;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const committed = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (committed) { result = await replay(committed, session); return; }
        if (String(shift?._id || "") !== posSessionId) throw retailError("Phiên POS không hợp lệ. Hãy tải lại trạng thái phiên.", "POS_SESSION_INVALID");
        const orderId = new Types.ObjectId();
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: String(orderId), requestFingerprint, operation: "checkout-order", status: "processing" }], { session });
        await touchPosSession(shift, scope, actor, session);
        const { settings, pricing } = await priceInput(scope, orderInput, session);
        if (expectedGrandTotal !== pricing.grandTotal) throw Object.assign(new Error("Tổng tiền đã thay đổi."), { code: "ORDER_TOTAL_MISMATCH", status: 409, details: { expected: expectedGrandTotal, actual: pricing.grandTotal } });
        const dueAmount = pricing.grandTotal - normalized.total;
        if (pendingTransferAmount > dueAmount) throw retailError("Số tiền QR vừa chọn vượt quá khoản còn phải thu.", "PENDING_TRANSFER_EXCEEDS_DUE", 400);
        const debtAmount = dueAmount - pendingTransferAmount;
        if (debtAmount > 0) {
          requireRetailPaymentCustomer(orderInput.customerId);
          if (!orderInput.dueDate) throw new Error("Bán nợ cần hạn thanh toán.");
        }
        const customerSnapshots = await resolveOrderCustomerSnapshots(scope, orderInput.customerId, orderInput.billingProfileId);
        if (debtAmount > 0) requireRetailPaymentCustomer(customerSnapshots?.customerId);
        const customer: any = customerSnapshots ? { name: customerSnapshots.customerName, phone: customerSnapshots.customerPhone } : null;
        const collaborator = await resolveCollaborator(scope.companyCode, orderInput.collaboratorId ?? orderInput.retailPartnerId, session, scope.branchId);
        const branch = await BranchModel.findOne({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).session(session).lean();
        if (!branch) throw new Error("Chi nhánh bán hàng không hợp lệ.");
        const businessDate = shift.businessDate || businessDateInVietnam(new Date());
        const scopeKey = monthlyScope(businessDate);
        const counter = await RetailOrderCounterModel.findOneAndUpdate({ ...scope, scope: scopeKey }, { $inc: { seq: 1 } }, { returnDocument: "after", upsert: true, session });
        const orderCode = formatRetailDocumentCode(settings.orderPrefix, branch.code, scopeKey, counter!.seq);
        const paymentCode = requestedPaymentCode || retailPaymentCode(orderCode);
        if (pricing.couponSnapshot) await consumeCoupon(scope, pricing.couponSnapshot, session, orderInput.customerId);
        const stockSnapshot = await applyOrderStockOut(scope, String(orderId), orderCode, pricing.lines, actorName(actor), settings.allowNegativeStock, session);
        pricing.lines = stockSnapshot.items;
        pricing.totalCost = stockSnapshot.totalCost;
        const now = new Date();
        const extras = orderExtras(orderInput);
        const installment: any = extras.installment;
        if (installment) {
          const upfrontAmount = Math.round(pricing.grandTotal * installment.prepayPercent / 100);
          if (normalized.total + pendingTransferAmount !== upfrontAmount) throw retailError("Số tiền thu phải khớp tiền trả trước đã chọn.", "INSTALLMENT_UPFRONT_MISMATCH", 400);
          installment.upfrontAmount = upfrontAmount;
          installment.financedAmount = debtAmount;
        }
        const order: any = new RetailOrderModel({
          _id: orderId, ...scope, ...extras, orderCode, paymentCode,
          collaboratorId: collaborator ? String(collaborator._id) : undefined,
          couponCode: pricing.couponCode, couponSnapshot: pricing.couponSnapshot,
          manualOrderDiscount: pricing.manualOrderDiscount, pointsToRedeem: pricing.pointsToRedeem, pointsDiscount: pricing.pointsDiscount, pointsRedeemed: pricing.pointsToRedeem,
          items: pricing.lines, subtotal: pricing.subtotal, orderDiscount: pricing.orderDiscount,
          taxRate: pricing.taxRate, taxAmount: pricing.taxAmount, shippingFee: pricing.shippingFee,
          grandTotal: pricing.grandTotal, totalCost: pricing.totalCost,
          shiftId: String(shift._id), businessDate,
          payments: normalized.payments.map((payment) => snapshotPayment(payment, shift, actor)),
          refunds: [], paidAmount: normalized.total, refundedAmount: 0, dueAmount, pendingTransferAmount,
          paymentStatus: paymentStatusFor(normalized.total, pricing.grandTotal, 0),
          status: dueAmount === 0 ? "completed" : "confirmed", dueDate: orderInput.dueDate,
          confirmedAt: now, completedAt: dueAmount === 0 ? now : undefined,
          salespersonId: actorId(actor), salespersonName: actorName(actor),
          createdBy: actorId(actor), createdByName: actorName(actor),
          stockApplied: true, version: 1, ...(customerSnapshots || {}),
          customerName: customer?.name, customerPhone: customer?.phone,
        });
        await claimSerialsForOrder(scope, order.items as any, String(order._id), String(order.customerId || ""), actorId(actor), session, actorName(actor), { businessDate, orderCode });
        await redeemRetailOrderPoints(scope, order, actor, session);
        await order.save({ session });
        await enqueueOrderTierRefresh(scope, "confirm", order, session);
        await awardOrderPoints(scope, order, session);
        const invoice = await issueRetailInvoice(order, settings.invoicePrefix, branch.code, scopeKey, actor, session);
        order.commissionSnapshot = await snapshotRetail(order, session);
        await order.save({ session });
        if (order.commissionSnapshot || order.retailPartnerId) await reconcileCommission("retail", String(order._id), scope.companyCode, session);
        await publishRetailOrderEvent("confirmed", scope, { ...order.toObject(), dueAmount: debtAmount }, actor, { session });
        await RetailIdempotencyModel.updateOne({ companyCode: scope.companyCode, key }, { $set: { status: "completed", orderId: String(order._id), invoiceId: String(invoice._id) } }, { session });
        await touchPosSession(shift, scope, actor, session);
        result = { order, invoice };
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (prior) return replay(prior);
      }
      throw error;
    } finally { await session.endSession(); }
    scheduleOrderTierRefreshAfterCommit(scope, "confirm", result.order);
    if (shift) emitSessionChange("pos:session:updated", shift);
    return result;
  },
  async confirm(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any = undefined, canManage = false) {
    const { key, requestFingerprint } = confirmationIdentity(scope, id, input, actor, shift);
    const replay = async (attempt: any, activeSession?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "confirm-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status !== "completed") throw retailError("Yêu cầu xác nhận đang được xử lý. Vui lòng thử lại sau.", "ORDER_IDEMPOTENCY_PROCESSING");
      const result = await confirmedResult(scope, attempt, activeSession);
      assertHeldDraftAccess(String(result.order.createdBy), actorId(actor), canManage);
      return result;
    };
    const keyFilter = { companyCode: scope.companyCode, key };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession(); let result: any;
    try { await session.withTransaction(async () => {
      const committed = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
      if (committed) { result = await replay(committed, session); return; }
      await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, requestFingerprint, operation: "confirm-order", status: "processing" }], { session });
      if (shift) await touchPosSession(shift, scope, actor, session);
      const draft: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "draft", version: input.expectedVersion }).session(session);
      if (!draft) throw retailError("Đơn đã thay đổi hoặc không thể xác nhận. Vui lòng tải lại và kiểm tra nội dung.", "ORDER_VERSION_CONFLICT");
      assertHeldDraftAccess(String(draft.createdBy), actorId(actor), canManage);
      const { settings, pricing } = await priceInput(scope, draft.toObject(), session, true); if (Number(input.expectedGrandTotal) !== pricing.grandTotal) throw Object.assign(new Error("Tổng tiền đã thay đổi."), { code: "ORDER_TOTAL_MISMATCH", status: 409, details: { expected: Number(input.expectedGrandTotal), actual: pricing.grandTotal } });
      const normalized = normalizePayments(input.payments || [], pricing.grandTotal); const dueAmount = pricing.grandTotal - normalized.total;
      if (draft.installment) {
        const upfrontAmount = Math.round(pricing.grandTotal * draft.installment.prepayPercent / 100);
        if (normalized.total !== upfrontAmount) throw retailError("Số tiền thu phải khớp tiền trả trước đã chọn.", "INSTALLMENT_UPFRONT_MISMATCH", 400);
        draft.installment.upfrontAmount = upfrontAmount;
        draft.installment.financedAmount = dueAmount;
      }
      if (dueAmount > 0) {
        requireRetailPaymentCustomer(draft.customerId);
        if (!draft.dueDate) throw new Error("Bán nợ cần khách hàng và hạn thanh toán.");
      }
      const customerSnapshots = await resolveOrderCustomerSnapshots(scope, draft.customerId, draft.billingProfileId);
      const customer: any = customerSnapshots ? { name: customerSnapshots.customerName, phone: customerSnapshots.customerPhone } : null;
      const branch = await BranchModel.findOne({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true }).session(session).lean(); if (!branch) throw new Error("Chi nhánh bán hàng không hợp lệ.");
      const scopeKey = monthlyScope(shift?.businessDate || businessDateInVietnam(new Date())); const counter = await RetailOrderCounterModel.findOneAndUpdate({ ...scope, scope: scopeKey }, { $inc: { seq: 1 } }, { returnDocument: 'after', upsert: true, session }); const orderCode = formatRetailDocumentCode(settings.orderPrefix, branch.code, scopeKey, counter!.seq);
      draft.paymentCode = retailPaymentCode(orderCode);
      if (pricing.couponSnapshot) await consumeCoupon(scope, pricing.couponSnapshot, session, draft.customerId);
      const stockSnapshot = await applyOrderStockOut(scope, String(draft._id), orderCode, pricing.lines, actorName(actor), settings.allowNegativeStock, session);
      pricing.lines = stockSnapshot.items;
      pricing.totalCost = stockSnapshot.totalCost;
      Object.assign(draft, { orderCode, shiftId: shift?._id ? String(shift._id) : undefined, businessDate: shift?.businessDate || businessDateInVietnam(new Date()), items: pricing.lines, ...pricing, ...(customerSnapshots || {}), customerName: customer?.name || draft.customerName, customerPhone: customer?.phone || draft.customerPhone, payments: normalized.payments.map((payment) => snapshotPayment(payment, shift, actor)), paidAmount: normalized.total, dueAmount, paymentStatus: paymentStatusFor(normalized.total, pricing.grandTotal, 0), status: dueAmount === 0 ? "completed" : "confirmed", stockApplied: true, confirmedAt: new Date(), completedAt: dueAmount === 0 ? new Date() : undefined, version: draft.version + 1 });
      draft.pointsRedeemed = pricing.pointsToRedeem;
      await redeemRetailOrderPoints(scope, draft, actor, session);
      await claimSerialsForOrder(scope, draft.items as any, String(draft._id), String(draft.customerId), actorId(actor), session, actorName(actor), { businessDate: draft.businessDate, orderCode }); await draft.save({ session });
      await enqueueOrderTierRefresh(scope, "confirm", draft, session);
      await awardOrderPoints(scope, draft, session);
      const invoice = await issueRetailInvoice(draft, settings.invoicePrefix, branch.code, scopeKey, actor, session);
      draft.commissionSnapshot = await snapshotRetail(draft, session);
      await draft.save({ session });
      if (draft.commissionSnapshot) await reconcileCommission("retail", String(draft._id), scope.companyCode, session);
      await publishRetailOrderEvent("confirmed", scope, draft, actor, { session });
      await RetailIdempotencyModel.updateOne({ companyCode: scope.companyCode, key }, { $set: { status: "completed", orderId: String(draft._id), invoiceId: String(invoice._id) } }, { session });
      if (shift) await touchPosSession(shift, scope, actor, session);
      result = { order: draft, invoice };
    }); } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const prior = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (prior) return replay(prior);
      }
      throw error;
    } finally { await session.endSession(); }
    scheduleOrderTierRefreshAfterCommit(scope, "confirm", result.order);
    if (shift) emitSessionChange("pos:session:updated", shift);
    return result;
  },
  async revokeCollection(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const { key, requestFingerprint } = collectionIdentity(scope, id, input, actor, shift);
    const filter = { companyCode: scope.companyCode, key };
    const replay = (attempt: any) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "collect-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status !== "revoked") throw retailError("Yêu cầu đã được ghi nhận hoặc đang xử lý. Cần đối chiếu, không thể hủy khóa.", "COLLECTION_REVOKE_CONFLICT");
      return { status: "revoked" as const, message: "Đã hủy yêu cầu chưa ghi nhận. Khóa cũ không thể thu tiền nữa." };
    };
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const order = await RetailOrderModel.findOne({ _id: id, ...scope }).session(session).lean();
        if (!order) throw replayConflict();
        const attempt = await RetailIdempotencyModel.findOne(filter).session(session).lean();
        if (attempt) return replay(attempt);
        // An advanced order without its request record is ambiguous: never fabricate revocation evidence.
        if (order.version !== input.expectedVersion || order.status !== "confirmed") throw retailError("Đơn đã thay đổi. Không đủ bằng chứng hủy yêu cầu cũ.", "COLLECTION_REVOKE_CONFLICT");
        // The existing company/key unique index arbitrates with the collection writer's insert.
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, operation: "collect-order", requestFingerprint, status: "revoked" }], { session });
        return { status: "revoked" as const, message: "Đã hủy yêu cầu chưa ghi nhận. Khóa cũ không thể thu tiền nữa." };
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const attempt = await RetailIdempotencyModel.findOne(filter).lean();
        if (attempt) return replay(attempt);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async reconcileCollection(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const { key, normalized, requestFingerprint } = collectionIdentity(scope, id, input, actor, shift);
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const order = await RetailOrderModel.findOne({ _id: id, ...scope }).session(session).lean();
        const conflict = { status: "conflict" as const, message: "Chưa đủ bằng chứng khớp khoản thu. Giữ yêu cầu để đối chiếu." };
        if (!order) return conflict;
        const attempt = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key }).session(session).lean();
        if (!attempt) return { status: "not_found" as const, message: "Chưa tìm thấy yêu cầu đã ghi nhận. Giữ khóa cũ; kết quả này không hủy yêu cầu đang gửi." };
        if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "collect-order" || attempt.requestFingerprint !== requestFingerprint) return conflict;
        if (attempt.status === "revoked") return { status: "revoked" as const, message: "Yêu cầu đã hủy; khóa này không thể thu tiền." };
        if (attempt.status !== "completed") return { status: "processing" as const, message: "Yêu cầu đang xử lý. Giữ nguyên khoản thu và kiểm tra lại." };
        const evidence = attempt.collectionEvidence;
        if (!evidence || !Number.isSafeInteger(evidence.paymentOffset) || evidence.paymentOffset < 0 || !Number.isSafeInteger(evidence.paidBefore) || evidence.paidBefore < 0 || evidence.grandTotal !== order.grandTotal || order.version < input.expectedVersion + 1) return conflict;
        const prefix = order.payments.slice(0, evidence.paymentOffset);
        const segment = order.payments.slice(evidence.paymentOffset, evidence.paymentOffset + normalized.payments.length);
        if (prefix.reduce((sum, p) => sum + p.amount, 0) !== evidence.paidBefore || segment.length !== normalized.payments.length) return conflict;
        const matches = segment.every((p, i) => {
          const expected = normalized.payments[i];
          return p.method === expected.method && p.amount === expected.amount && p.tenderedAmount === expected.tenderedAmount && p.changeAmount === expected.changeAmount && p.reference === expected.reference && p.receivedBy === actorId(actor) && String(p.shiftId || "") === String(shift?._id || "");
        });
        if (!matches || order.payments.reduce((sum, p) => sum + p.amount, 0) !== order.paidAmount) return conflict;
        return { status: "completed" as const, message: "Đã xác minh khoản thu trên đơn. Đây không phải đối soát tiền thực hoặc quỹ Finance.", order };
      }, { readConcern: { level: "snapshot" } });
    } finally { await session.endSession(); }
  },
  async collect(scope: RetailBranchScope, id: string, input: any, actor: any, shift?: any) {
    const { key, normalized, requestFingerprint } = collectionIdentity(scope, id, input, actor, shift);
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "collect-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status === "revoked") throw retailError("Yêu cầu đã hủy. Không thể dùng lại khóa này.", "COLLECTION_REVOKED");
      if (attempt.status !== "completed") throw retailError("Yêu cầu thu tiền đang được xử lý.", "ORDER_IDEMPOTENCY_PROCESSING");
      const order = await RetailOrderModel.findOne({ _id: id, ...scope }).session(session || null).lean();
      if (!order) throw replayConflict();
      return order;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (existing) return replay(existing, session);
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, operation: "collect-order", requestFingerprint, status: "processing" }], { session });
        shift = await lockRetailPaymentSession(scope, { ...input, cashSessionId: input.cashSessionId || shift?._id }, actor, session, normalized.payments.some((payment) => payment.method === "cash"));
        const order: any = await RetailOrderModel.findOne({ _id: id, ...scope, status: "confirmed", version: input.expectedVersion }).session(session);
        if (!order) throw retailError("Đơn đã thay đổi hoặc không thể thu thêm. Vui lòng đối chiếu công nợ.", "ORDER_VERSION_CONFLICT");
        if (normalized.total > Math.max(0, Number(order.dueAmount) - Number(order.pendingTransferAmount || 0))) throw retailError("Số tiền thu vượt công nợ còn lại.", "COLLECTION_INVALID", 400);
        const collectionEvidence = { paymentOffset: order.payments.length, paidBefore: order.paidAmount, grandTotal: order.grandTotal };
        order.payments.push(...normalized.payments.map((payment) => snapshotPayment(payment, shift, actor)));
        order.paidAmount += normalized.total;
        order.dueAmount = order.grandTotal - order.paidAmount;
        order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount);
        if (order.dueAmount === 0) { order.status = "completed"; order.completedAt = new Date(); }
        order.version += 1;
        await order.save({ session });
        if (order.status === "completed") await awardOrderPoints(scope, order, session);
        if (order.commissionSnapshot || order.retailPartnerId) await reconcileCommission("retail", String(order._id), scope.companyCode, session);
        await publishRetailOrderEvent("paid", scope, order, actor, { session, amount: normalized.total, transactionKey: key });
        await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", collectionEvidence } }, { session });
        assertPaymentSessionDeadline(shift);
        return order;
      });
      if (shift) emitSessionChange("pos:session:updated", shift);
      if (result?.shiftId && result.shiftId !== String(shift?._id || "")) emitSessionChange("pos:session:updated", { ...scope, _id: result.shiftId, cashierId: result.salespersonId });
      return result;
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (existing) return replay(existing);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async revokeCancellation(scope: RetailBranchScope, id: string, input: any, actor: any, canManage: boolean, shift?: any) {
    const { key, requestFingerprint } = cancellationIdentity(scope, id, input, actor, shift);
    const filter = { companyCode: scope.companyCode, key };
    const replay = (attempt: any) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "cancel-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.cancelledFromStatus === "completed" && !canManage) throw retailError("Chỉ quản lý được xử lý yêu cầu hủy đơn hoàn tất.", "CANCELLATION_FORBIDDEN", 403);
      if (attempt.status === "revoked" && attempt.cancelledFromStatus === "draft") assertHeldDraftAccess(String(attempt.cancellationOwnerId || ""), actorId(actor), canManage);
      if (attempt.status !== "revoked") throw retailError("Yêu cầu đã được ghi nhận hoặc đang xử lý. Cần đối chiếu, không thể hủy khóa.", "CANCELLATION_REVOKE_CONFLICT");
      return { status: "revoked" as const, message: "Đã hủy yêu cầu chưa ghi nhận. Khóa cũ không thể hủy đơn nữa." };
    };
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const order = await RetailOrderModel.findOne({ _id: id, ...scope }).session(session).lean();
        if (!order) throw replayConflict();
        const attempt = await RetailIdempotencyModel.findOne(filter).session(session).lean();
        if (attempt) return replay(attempt);
        // An advanced order without its request record is ambiguous: never fabricate revocation evidence.
        if (order.version !== input.expectedVersion || !["draft", "confirmed", "completed"].includes(order.status)) throw retailError("Đơn đã thay đổi. Không đủ bằng chứng hủy yêu cầu cũ.", "CANCELLATION_REVOKE_CONFLICT");
        if (order.status === "draft") assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
        if (order.status === "completed" && !canManage) throw retailError("Chỉ quản lý được xử lý yêu cầu hủy đơn hoàn tất.", "CANCELLATION_FORBIDDEN", 403);
        // The existing company/key unique index arbitrates with the cancellation writer's insert.
        await RetailIdempotencyModel.create([{ ...scope, key, orderId: id, operation: "cancel-order", requestFingerprint, cancelledFromStatus: order.status, cancellationOwnerId: String(order.createdBy), status: "revoked" }], { session });
        return { status: "revoked" as const, message: "Đã hủy yêu cầu chưa ghi nhận. Khóa cũ không thể hủy đơn nữa." };
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const attempt = await RetailIdempotencyModel.findOne(filter).lean();
        if (attempt) return replay(attempt);
      }
      throw error;
    } finally { await session.endSession(); }
  },
  async reconcileCancellation(scope: RetailBranchScope, id: string, input: any, actor: any, canManage: boolean, shift?: any) {
    const { key, requestFingerprint } = cancellationIdentity(scope, id, input, actor, shift);
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const conflict = { status: "conflict" as const, message: "Chưa đủ bằng chứng khớp yêu cầu hủy. Giữ bản lưu để đối chiếu." };
        const attempt = await RetailIdempotencyModel.findOne({ companyCode: scope.companyCode, key }).session(session).lean();
        const live = await RetailOrderModel.findOne({ _id: id, ...scope }).session(session).lean();
        if (!attempt) return live ? { status: "not_found" as const, message: "Chưa tìm thấy yêu cầu. Kết quả này không hủy thao tác đang gửi." } : conflict;
        if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "cancel-order" || attempt.requestFingerprint !== requestFingerprint) return conflict;
        if (attempt.status === "revoked") {
          if (attempt.cancelledFromStatus === "draft") assertHeldDraftAccess(String(attempt.cancellationOwnerId || ""), actorId(actor), canManage);
          if (attempt.cancelledFromStatus === "completed" && !canManage) throw retailError("Chỉ quản lý được xử lý yêu cầu hủy đơn hoàn tất.", "CANCELLATION_FORBIDDEN", 403);
          return { status: "revoked" as const, message: "Yêu cầu đã được thu hồi. Khóa cũ không thể hủy đơn." };
        }
        if (attempt.status !== "completed") return { status: "processing" as const, message: "Yêu cầu chưa hoàn tất. Giữ nguyên bản lưu." };
        if (attempt.cancelledFromStatus === "completed" && !canManage) throw retailError("Chỉ quản lý được đối chiếu hủy đơn hoàn tất.", "CANCELLATION_FORBIDDEN", 403);
        if (!["draft", "confirmed", "completed"].includes(attempt.cancelledFromStatus || "")) return conflict;
        const order = attempt.cancelledFromStatus === "draft" ? attempt.cancelledDraft : live;
        if (!order || String(order._id) !== id || order.companyCode !== scope.companyCode || order.branchId !== scope.branchId || order.status !== "cancelled" || order.version !== input.expectedVersion + 1 || !attempt.cancellationDigest || cancellationDigest(order) !== attempt.cancellationDigest) return conflict;
        if (attempt.cancelledFromStatus === "draft") {
          assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
          if (live || order.stockApplied || order.paidAmount || order.refundedAmount || order.refunds.length) return conflict;
        } else {
          if (order.refundedAmount !== order.paidAmount || order.refunds.reduce((sum: number, p: any) => sum + p.amount, 0) !== order.refundedAmount) return conflict;
          const invoice = await RetailInvoiceModel.findOne({ orderId: id, ...scope }).session(session).lean();
          if (!invoice || invoice.status !== "void") return conflict;
          if (order.stockApplied && (!order.stockRevertedAt || !order.restockReceiptId || !await GoodsReceiptModel.exists({ _id: order.restockReceiptId, ...scope, status: "confirmed", sourceId: id }).session(session))) return conflict;
        }
        return { status: "completed" as const, message: "Đã xác minh hồ sơ hủy đơn. Chưa đối soát tiền thực/quỹ Finance.", order };
      }, { readConcern: { level: "snapshot" } });
    } finally { await session.endSession(); }
  },
  async cancel(scope: RetailBranchScope, id: string, input: any, actor: any, shift: any | undefined, canManage: boolean) {
    const { reason, key, refunds, requestFingerprint } = cancellationIdentity(scope, id, input, actor, shift);
    const keyFilter = { companyCode: scope.companyCode, key };
    const replay = async (attempt: any, session?: mongoose.ClientSession) => {
      if (attempt.branchId !== scope.branchId || attempt.orderId !== id || attempt.operation !== "cancel-order" || attempt.requestFingerprint !== requestFingerprint) throw replayConflict();
      if (attempt.status === "revoked") throw retailError("Yêu cầu đã được thu hồi. Không thể dùng lại khóa này.", "CANCELLATION_REVOKED");
      if (attempt.status !== "completed") throw retailError("Yêu cầu hủy đang được xử lý.", "ORDER_IDEMPOTENCY_PROCESSING");
      if (attempt.cancelledFromStatus === "completed" && !canManage) throw retailError("Chỉ quản lý được hủy đơn hoàn tất.", "CANCELLATION_FORBIDDEN", 403);
      const order = attempt.cancelledFromStatus === "draft" ? attempt.cancelledDraft : await RetailOrderModel.findOne({ _id: id, ...scope, status: "cancelled" }).session(session || null).lean();
      if (!order || String(order._id) !== id || order.companyCode !== scope.companyCode || order.branchId !== scope.branchId || order.status !== "cancelled" || !["draft", "confirmed", "completed"].includes(attempt.cancelledFromStatus)) throw replayConflict();
      if (attempt.cancelledFromStatus === "draft") assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
      return order;
    };
    const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
    if (existing) return replay(existing);
    const session = await mongoose.startSession(); let result: any;
    try {
      await session.withTransaction(async () => {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).session(session).lean();
        if (existing) { result = await replay(existing, session); return; }
        await RetailIdempotencyModel.create([{ ...scope, key, operation: "cancel-order", orderId: id, requestFingerprint, status: "processing" }], { session });
        const order: any = await RetailOrderModel.findOne({ _id: id, ...scope, version: input.expectedVersion, status: { $in: ["draft", "confirmed", "completed"] } }).session(session);
        if (!order) throw retailError("Đơn đã thay đổi hoặc không thể hủy. Vui lòng đối chiếu đơn gốc.", "ORDER_VERSION_CONFLICT");
        const cancelledFromStatus = order.status;
        if (order.status === "draft") assertHeldDraftAccess(String(order.createdBy), actorId(actor), canManage);
        if (order.status === "completed" && !canManage) throw Object.assign(new Error("Chỉ quản lý được hủy đơn hoàn tất."), { status: 403 });
        if (await RetailAfterSaleModel.exists({ ...scope, orderId: String(order._id) }).session(session)) throw retailError("Đơn đã trả hàng hoặc thu mua lại. Vui lòng xử lý phần hàng còn lại bằng phiếu trả hàng.", "ORDER_HAS_AFTER_SALES");
        if (order.status !== "draft") shift = await lockRetailPaymentSession(scope, { ...input, cashSessionId: input.cashSessionId || shift?._id }, actor, session, refunds.payments.some((payment: any) => payment.method === "cash"), refunds.payments.filter((payment: any) => payment.method === "cash").reduce((sum: number, payment: any) => sum + payment.amount, 0));
        const remainingRefund = order.paidAmount - order.refundedAmount;
        if (refunds.total !== remainingRefund) throw retailError("Phải ghi nhận đúng số tiền hoàn còn lại khi hủy đơn.", "CANCELLATION_INVALID", 400);
        if (order.status === "draft") {
          if (order.stockApplied || order.paidAmount || order.refundedAmount) throw replayConflict();
          result = { ...order.toObject(), status: "cancelled", cancelReason: reason, cancelledAt: new Date(), version: order.version + 1 };
          await RetailOrderModel.deleteOne({ _id: id, ...scope, status: "draft", version: input.expectedVersion }, { session });
          await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", cancelledFromStatus, cancelledDraft: result, cancellationDigest: cancellationDigest(result) } }, { session });
          return;
        }
        if (order.stockApplied && !order.stockRevertedAt) { const receipt = await revertOrderStock(scope, String(order._id), order.orderCode, order.items, actorName(actor), session, { order, actorId: actorId(actor), reason }); order.restockReceiptId = String(receipt._id); order.restockReceiptCode = receipt.receiptCode; await releaseSerialsForOrder(scope, String(order._id), actorId(actor), actorName(actor), session, { id: String(receipt._id), warehouseId: receipt.warehouseId }); order.stockRevertedAt = new Date(); }
        if (order.couponSnapshot && order.status !== "draft") await releaseCoupon(scope, order.couponSnapshot.id, session);
        await enqueueOrderTierRefresh(scope, "cancel", order, session);
        await revertOrderPointsOnCancel(scope, order, actor, session);
        order.refunds.push(...refunds.payments.map((item: any) => ({ method: item.method, amount: item.amount, reference: item.reference, refundedAt: new Date(), refundedBy: actorId(actor), refundedByName: actorName(actor), shiftId: shift?._id ? String(shift._id) : undefined, businessDate: shift?.businessDate || businessDateInVietnam(new Date()), reason })));
        order.refundedAmount += refunds.total; order.paymentStatus = paymentStatusFor(order.paidAmount, order.grandTotal, order.refundedAmount); order.status = "cancelled"; order.cancelReason = reason; order.cancelledByName = actorName(actor); order.cancelledAt = new Date(); order.version += 1;
        await order.save({ session });
        if (order.commissionSnapshot || order.retailPartnerId) await reconcileCommission("retail", String(order._id), scope.companyCode, session);
        await publishRetailOrderEvent("cancelled", scope, order, actor, { session });
        await RetailInvoiceModel.updateOne({ orderId: String(order._id), ...scope, status: "issued" }, { $set: { status: "void", voidedAt: new Date(), voidReason: reason } }, { session });
        await RetailIdempotencyModel.updateOne(keyFilter, { $set: { status: "completed", cancelledFromStatus, cancellationDigest: cancellationDigest(order) } }, { session });
        assertPaymentSessionDeadline(shift);
        result = order;
      });
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.companyCode && error?.keyPattern?.key) {
        const existing = await RetailIdempotencyModel.findOne(keyFilter).lean();
        if (existing) return replay(existing);
      }
      throw error;
    } finally { await session.endSession(); }
    if (result.stockApplied) scheduleOrderTierRefreshAfterCommit(scope, "cancel", result);
    if (shift) emitSessionChange("pos:session:updated", shift);
    if (result?.shiftId && result.shiftId !== String(shift?._id || "")) emitSessionChange("pos:session:updated", { ...scope, _id: result.shiftId, cashierId: result.salespersonId });
    return result;
  },
  async deleteCancelled(scope: RetailBranchScope, id: string) {
    if (await RetailOrderModel.exists({ _id: id, ...scope, stockApplied: true })) throw retailError("Đơn đã phát sinh xuất/nhập kho phải được giữ lại để tra cứu.", "ORDER_HAS_STOCK_HISTORY");
    const result = await RetailOrderModel.deleteOne({ _id: id, ...scope, status: "cancelled" });
    if (result.deletedCount !== 1) throw new Error("Chỉ được xóa đơn đã hủy.");
    return { id };
  },
};
