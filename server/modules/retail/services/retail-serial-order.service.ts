import type { ClientSession } from "mongoose";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import type { RetailBranchScope } from "../contracts";

export async function claimSerialsForOrder(scope: RetailBranchScope, items: Array<{ productId: string; variantId?: string; trackingMode?: string; serialNumbers?: string[] }>, orderId: string, actorId: string, session: ClientSession, actorName = actorId) {
  for (const item of items) {
    if (item.trackingMode !== "serial") continue;
    const serialNumbers = item.serialNumbers || [];
    if (!serialNumbers.length) throw Object.assign(new Error("Sản phẩm quản lý IMEI/serial phải chọn mã trước khi bán."), { statusCode: 400, code: "SERIAL_REQUIRED" });
    if (new Set(serialNumbers.map((value) => normalizeSerialNumber(value))).size !== serialNumbers.length) throw Object.assign(new Error("IMEI/serial trong đơn không được trùng."), { statusCode: 400, code: "SERIAL_DUPLICATE" });
    for (const value of serialNumbers) {
      const normalized = normalizeSerialNumber(value);
      const claimed = await SerialUnitModel.findOneAndUpdate(
        { companyCode: scope.companyCode, branchId: scope.branchId, productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}), normalizedSerialNumber: normalized, status: "in_stock" },
        { $set: { status: "sold", currentDocumentType: "retail-order", currentDocumentId: orderId, updatedBy: actorId } },
        { new: true, session },
      );
      if (!claimed) throw Object.assign(new Error(`IMEI/serial ${normalized} không còn khả dụng.`), { statusCode: 409, code: "SERIAL_NOT_AVAILABLE" });
      await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(claimed._id), serialNumber: claimed.serialNumber, eventType: "sold", fromStatus: "in_stock", toStatus: "sold", documentType: "retail-order", documentId: orderId, actorId, actorName }], { session });
    }
  }
}

export async function releaseSerialsForOrder(scope: RetailBranchScope, orderId: string, actorId: string, actorName: string, session: ClientSession) {
  const serials = await SerialUnitModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, currentDocumentType: "retail-order", currentDocumentId: orderId, status: "sold" }).session(session).lean();
  for (const serial of serials) {
    const released = await SerialUnitModel.findOneAndUpdate({ _id: serial._id, status: "sold" }, { $set: { status: "in_stock", updatedBy: actorId }, $unset: { currentDocumentType: 1, currentDocumentId: 1 } }, { new: true, session });
    if (!released) continue;
    await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(serial._id), serialNumber: serial.serialNumber, eventType: "sale_cancelled", fromStatus: "sold", toStatus: "in_stock", documentType: "retail-order", documentId: orderId, actorId, actorName }], { session });
  }
  return serials.length;
}
