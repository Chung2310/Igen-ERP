import type { ClientSession } from "mongoose";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizeInternalBarcode } from "../../inventory/serials/unit-barcode-validation";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { computeWarrantyEnd, resolveCustomerWarrantyMonths } from "../../inventory/serials/warranty-clock";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";
import { loadRetailStockSource } from "./retail-stock-source";
import { GoodsReceiptModel } from "../../../model/goods-receipt.model";

export function applyClaimedSerialToOrderItem(item: { internalBarcodes?: string[]; soldAt?: Date; customerWarrantyStartAt?: Date; customerWarrantyEndAt?: Date }, claimed: { internalBarcode?: string }, soldAt: Date, customerMonths: number) {
  const internalBarcodes = claimed.internalBarcode ? [...new Set([...(item.internalBarcodes || []), claimed.internalBarcode])] : item.internalBarcodes;
  Object.assign(item, {
    soldAt,
    ...(internalBarcodes ? { internalBarcodes } : {}),
    ...(customerMonths > 0 ? { customerWarrantyStartAt: soldAt, customerWarrantyEndAt: computeWarrantyEnd(soldAt, customerMonths) } : {}),
  });
}

export async function claimSerialsForOrder(scope: RetailBranchScope, items: Array<{ productId: string; variantId?: string; trackingMode?: string; serialNumbers?: string[]; internalBarcodes?: string[] }>, orderId: string, customerId: string, actorId: string, session: ClientSession, actorName = actorId, orderContext?: { businessDate?: string; orderCode?: string }) {
  const defaultWarehouse = await ensureDefaultWarehouse(scope.companyCode, scope.branchId, session);
  const order: any = await RetailOrderModel.findOne({ _id: orderId, companyCode: scope.companyCode, branchId: scope.branchId }).session(session).lean();
  // Lúc xác nhận đơn, phiếu chưa save nên bản trong DB chưa có businessDate/orderCode — ưu tiên giá trị caller truyền vào.
  const businessDate = orderContext?.businessDate || order?.businessDate;
  const orderCode = orderContext?.orderCode || order?.orderCode;
  const soldAt = businessDate ? new Date(`${businessDate}T00:00:00.000Z`) : new Date();
  for (const item of items) {
    if (!["serial", "unit_barcode"].includes(item.trackingMode || "")) continue;
    const serialNumbers = item.serialNumbers || [];
    const internalBarcodes = item.internalBarcodes || [];
    if (item.trackingMode === "serial" && !serialNumbers.length) throw Object.assign(new Error("Sản phẩm quản lý IMEI/serial phải chọn mã trước khi bán."), { statusCode: 400, code: "SERIAL_REQUIRED" });
    if (item.trackingMode === "unit_barcode" && !internalBarcodes.length) throw Object.assign(new Error("Sản phẩm quản lý mã vạch phải chọn mã trước khi bán."), { statusCode: 400, code: "BARCODE_REQUIRED" });
    if (new Set(serialNumbers.map((value) => normalizeSerialNumber(value))).size !== serialNumbers.length) throw Object.assign(new Error("IMEI/serial trong đơn không được trùng."), { statusCode: 400, code: "SERIAL_DUPLICATE" });
    const variant: any = item.variantId ? await ProductVariantModel.findOne({ _id: item.variantId, companyCode: scope.companyCode }).session(session).lean() : null;
    const product: any = variant?.productId ? await ProductCatalogModel.findOne({ _id: variant.productId, companyCode: scope.companyCode }).select("warrantyMonths").session(session).lean() : null;
    const customerMonths = resolveCustomerWarrantyMonths(product?.warrantyMonths, variant?.warrantyMonths);
    const identifiers = item.trackingMode === "serial"
      ? serialNumbers.map((value) => ({ value, normalized: normalizeSerialNumber(value), filter: { normalizedSerialNumber: normalizeSerialNumber(value) } }))
      : internalBarcodes.map((value) => ({ value, normalized: normalizeInternalBarcode(value), filter: { $or: [{ normalizedInternalBarcode: normalizeInternalBarcode(value) }, { normalizedBarcodeAliases: normalizeInternalBarcode(value) }] } }));
    for (const identifier of identifiers) {
      const serialProductId = variant ? String(variant.productId) : item.productId;
      const claimed = await SerialUnitModel.findOneAndUpdate(
        { companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(defaultWarehouse._id), productId: serialProductId, ...(item.variantId ? { variantId: item.variantId } : {}), ...identifier.filter, status: "in_stock" },
        { $set: { status: "sold", currentDocumentType: "retail-order", currentDocumentId: orderId, customerId, updatedBy: actorId, soldAt, soldOrderId: orderId, soldOrderCode: orderCode, soldBranchId: scope.branchId, ...(customerMonths > 0 ? { customerWarranty: { months: customerMonths, startAt: soldAt, endAt: computeWarrantyEnd(soldAt, customerMonths), source: "variant" } } : {}) } },
        { returnDocument: 'after', session },
      );
      if (!claimed) throw Object.assign(new Error(`Mã định danh ${identifier.normalized} không còn khả dụng.`), { statusCode: 409, code: "UNIT_NOT_AVAILABLE" });
      applyClaimedSerialToOrderItem(item, claimed, soldAt, customerMonths);
      await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(claimed._id), serialNumber: claimed.serialNumber, eventType: "sold", fromStatus: "in_stock", toStatus: "sold", documentType: "retail-order", documentId: orderId, actorId, actorName }], { session });
    }
  }
}

export async function releaseSerialsForOrder(scope: RetailBranchScope, orderId: string, actorId: string, actorName: string, session: ClientSession, receipt: { id: string; warehouseId: string }) {
  const conflict = (): never => { throw Object.assign(new Error("Danh sách máy không còn khớp lần bán gốc. Cần đối soát trước khi hủy đơn."), { code: "SALE_CANCEL_SERIAL_CONFLICT", status: 409, statusCode: 409 }); };
  if (!session.inTransaction()) throw Object.assign(new Error("Hoàn máy yêu cầu transaction đang hoạt động."), { statusCode: 503 });
  const order = await RetailOrderModel.findOne({ _id: orderId, ...scope, stockApplied: true, status: { $in: ["confirmed", "completed"] } }).session(session).lean();
  if (!order) conflict();
  const source = await loadRetailStockSource(scope, orderId, order.items, session);
  const sourceReceipt = receipt && await GoodsReceiptModel.findOne({ _id: receipt.id, ...scope, orderId, sourceId: orderId, receiptKind: "sales_cancel", status: "confirmed", warehouseId: source.warehouseId }).session(session).lean();
  if (!sourceReceipt || receipt.warehouseId !== source.warehouseId) conflict();
  // Include every linked unit, even moved or no longer sold, to detect missing/extra machines.
  const serials = await SerialUnitModel.find({ companyCode: scope.companyCode, $or: [{ soldOrderId: orderId }, { currentDocumentType: "retail-order", currentDocumentId: orderId }] }).session(session).lean();
  const selected = new Map<string, typeof serials[number]>();
  for (const [index, item] of order.items.entries()) {
    const tracked = item.trackingMode === "serial" || item.trackingMode === "unit_barcode";
    if (!tracked) { if (item.serialNumbers?.length || item.internalBarcodes?.length) conflict(); continue; }
    const identifiers = item.trackingMode === "serial" ? (item.serialNumbers || []).map(normalizeSerialNumber) : (item.internalBarcodes || []).map(normalizeInternalBarcode);
    if (!Number.isSafeInteger(item.quantity) || identifiers.length !== item.quantity || new Set(identifiers).size !== identifiers.length) conflict();
    const entry = source.entries[index];
    const lineCodes = new Set<string>();
    for (const identifier of identifiers) {
      const matches = serials.filter((unit) => item.trackingMode === "serial"
        ? unit.normalizedSerialNumber === identifier
        : unit.normalizedInternalBarcode === identifier || unit.normalizedBarcodeAliases?.includes(identifier));
      if (matches.length !== 1) conflict();
      const unit = matches[0], unitId = String(unit._id);
      if (selected.has(unitId) || unit.branchId !== scope.branchId || unit.warehouseId !== source.warehouseId
        || unit.productId !== entry.productId || String(unit.variantId || "") !== String(entry.variantId || "") || unit.sku !== entry.sku
        || unit.status !== "sold" || unit.soldOrderId !== orderId || unit.soldBranchId !== scope.branchId
        || unit.currentDocumentType !== "retail-order" || unit.currentDocumentId !== orderId) conflict();
      const lastEvent = await SerialEventModel.findOne({ companyCode: scope.companyCode, serialUnitId: unitId }).sort({ occurredAt: -1, _id: -1 }).session(session).lean();
      if (!lastEvent || lastEvent.branchId !== scope.branchId || lastEvent.eventType !== "sold" || lastEvent.fromStatus !== "in_stock" || lastEvent.toStatus !== "sold" || lastEvent.documentType !== "retail-order" || lastEvent.documentId !== orderId) conflict();
      lineCodes.add(unit.normalizedInternalBarcode);
      for (const alias of unit.normalizedBarcodeAliases || []) lineCodes.add(alias);
      selected.set(unitId, unit);
    }
    if (item.trackingMode === "serial" && item.internalBarcodes?.length) {
      const codes = item.internalBarcodes.map(normalizeInternalBarcode);
      if (codes.length !== item.quantity || new Set(codes).size !== codes.length || codes.some((code) => !lineCodes.has(code))) conflict();
    }
  }
  if (selected.size !== serials.length) conflict();
  for (const unit of selected.values()) {
    const released = await SerialUnitModel.findOneAndUpdate({ _id: unit._id, ...scope, warehouseId: source.warehouseId, productId: unit.productId,
      variantId: unit.variantId || { $exists: false }, sku: unit.sku, normalizedSerialNumber: unit.normalizedSerialNumber, normalizedInternalBarcode: unit.normalizedInternalBarcode,
      status: "sold", soldOrderId: orderId, soldBranchId: scope.branchId, currentDocumentType: "retail-order", currentDocumentId: orderId },
      { $set: { status: "in_stock", updatedBy: actorId, warehouseId: receipt.warehouseId, currentDocumentType: "goods-receipt", currentDocumentId: receipt.id },
        $unset: { customerId: 1, customerWarranty: 1, soldAt: 1, soldOrderId: 1, soldOrderCode: 1, soldBranchId: 1, soldInvoiceId: 1 } }, { returnDocument: "after", session });
    if (!released) conflict();
    await SerialEventModel.create([{ ...scope, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "sale_cancelled", fromStatus: "sold", toStatus: "in_stock", documentType: "goods-receipt", documentId: receipt.id, reason: sourceReceipt.notes, actorId, actorName }], { session });
  }
  return selected.size;
}
