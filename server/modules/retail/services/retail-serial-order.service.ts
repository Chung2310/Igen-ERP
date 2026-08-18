import type { ClientSession } from "mongoose";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import { normalizeInternalBarcode } from "../../inventory/serials/unit-barcode-validation";
import type { RetailBranchScope } from "../contracts";
import { RetailOrderModel } from "../models/retail-order.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { computeWarrantyEnd } from "../../inventory/serials/warranty-clock";
import { ensureDefaultWarehouse } from "../../inventory/warehouse/warehouse.service";

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
    const identifiers = item.trackingMode === "serial" ? serialNumbers.map((value) => ({ value, field: "normalizedSerialNumber" as const, normalized: normalizeSerialNumber(value) })) : internalBarcodes.map((value) => ({ value, field: "normalizedInternalBarcode" as const, normalized: normalizeInternalBarcode(value) }));
    for (const identifier of identifiers) {
      const variant: any = item.variantId ? await ProductVariantModel.findOne({ _id: item.variantId, companyCode: scope.companyCode }).session(session).lean() : null;
      const customerMonths = Number(variant?.warrantyMonths || 0);
      const serialProductId = variant ? String(variant.productId) : item.productId;
      const claimed = await SerialUnitModel.findOneAndUpdate(
        { companyCode: scope.companyCode, branchId: scope.branchId, warehouseId: String(defaultWarehouse._id), productId: serialProductId, ...(item.variantId ? { variantId: item.variantId } : {}), [identifier.field]: identifier.normalized, status: "in_stock" },
        { $set: { status: "sold", currentDocumentType: "retail-order", currentDocumentId: orderId, customerId, updatedBy: actorId, soldAt, soldOrderId: orderId, soldOrderCode: orderCode, soldBranchId: scope.branchId, ...(customerMonths > 0 ? { customerWarranty: { months: customerMonths, startAt: soldAt, endAt: computeWarrantyEnd(soldAt, customerMonths), source: "variant" } } : {}) } },
        { new: true, session },
      );
      if (!claimed) throw Object.assign(new Error(`Mã định danh ${identifier.normalized} không còn khả dụng.`), { statusCode: 409, code: "UNIT_NOT_AVAILABLE" });
      Object.assign(item, { soldAt, ...(customerMonths > 0 ? { customerWarrantyStartAt: soldAt, customerWarrantyEndAt: computeWarrantyEnd(soldAt, customerMonths) } : {}) });
      await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(claimed._id), serialNumber: claimed.serialNumber, eventType: "sold", fromStatus: "in_stock", toStatus: "sold", documentType: "retail-order", documentId: orderId, actorId, actorName }], { session });
    }
  }
}

export async function releaseSerialsForOrder(scope: RetailBranchScope, orderId: string, actorId: string, actorName: string, session: ClientSession) {
  const serials = await SerialUnitModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, currentDocumentType: "retail-order", currentDocumentId: orderId, status: "sold" }).session(session).lean();
  for (const serial of serials) {
    const released = await SerialUnitModel.findOneAndUpdate({ _id: serial._id, status: "sold" }, { $set: { status: "in_stock", updatedBy: actorId }, // Máy quay lại kho thì mọi dấu vết đã bán phải sạch, nếu không sẽ còn bảo hành khách của đơn đã hủy.
      $unset: { currentDocumentType: 1, currentDocumentId: 1, customerId: 1, customerWarranty: 1, soldAt: 1, soldOrderId: 1, soldOrderCode: 1, soldBranchId: 1 } }, { new: true, session });
    if (!released) continue;
    await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(serial._id), serialNumber: serial.serialNumber, eventType: "sale_cancelled", fromStatus: "sold", toStatus: "in_stock", documentType: "retail-order", documentId: orderId, actorId, actorName }], { session });
  }
  return serials.length;
}
