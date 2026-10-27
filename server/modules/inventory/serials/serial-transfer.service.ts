import { SerialEventModel } from "./serial-event.model";
import { SerialUnitModel } from "./serial-unit.model";
import { randomUUID } from "node:crypto";
import { requestInventoryTransfer, receiveInventoryTransfer, cancelInventoryTransfer } from "../transfers/transfer.service";
import { ensureDefaultWarehouse } from "../warehouse/warehouse.service";
import { runInventoryTransaction } from "../../../integrations/shared/inventory-transaction";
import { InventoryTransferModel } from "../transfers/transfer.model";

type Scope = { companyCode: string; branchId: string; warehouseId?: string };
type Actor = { id: string; name: string };

async function singleUnitDocument(scope: Scope, id: string, documentId: string, receiving: boolean) {
  const transfer = await InventoryTransferModel.findOne({ _id: documentId, companyCode: scope.companyCode, [receiving ? "toBranchId" : "fromBranchId"]: scope.branchId }).lean();
  if (!transfer || transfer.items.length !== 1 || transfer.items[0].quantity !== 1 || transfer.items[0].serialUnitIds.length !== 1 || transfer.items[0].serialUnitIds[0] !== id) {
    throw Object.assign(new Error("Hãy nhận hoặc hủy nguyên phiếu tại mục Điều chuyển. Thao tác trên một đơn vị không được xử lý các hàng khác trong phiếu."), { statusCode: 409, code: "TRANSFER_DOCUMENT_REQUIRED" });
  }
  if (scope.warehouseId && scope.warehouseId !== (receiving ? transfer.toWarehouseId : transfer.fromWarehouseId)) throw Object.assign(new Error("Kho không khớp chứng từ điều chuyển."), { statusCode: 409 });
  return transfer;
}

export async function requestSerialTransfer(scope: Scope, id: string, input: { toBranchId: string; toWarehouseId?: string; reason: string }, actor: Actor) {
  if (!input.toBranchId || !input.reason?.trim()) throw Object.assign(new Error("Chi nhánh nhận và lý do chuyển là bắt buộc."), { statusCode: 400 });
  const unit = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}), status: "in_stock" }).lean();
  if (!unit?.variantId || !unit.warehouseId) throw Object.assign(new Error("IMEI chưa gắn SKU và kho hợp lệ để điều chuyển."), { statusCode: 409, code: "SERIAL_NOT_TRANSFERABLE" });
  const destination = input.toWarehouseId || String((await ensureDefaultWarehouse(scope.companyCode, input.toBranchId))?._id || "");
  await requestInventoryTransfer({ companyCode: scope.companyCode, branchId: scope.branchId }, {
    idempotencyKey: randomUUID(),
    fromWarehouseId: unit.warehouseId, toBranchId: input.toBranchId, toWarehouseId: destination,
    reason: input.reason.trim(), items: [{ variantId: unit.variantId, quantity: 1, serialNumbers: [unit.serialNumber] }],
  }, actor);
  return SerialUnitModel.findById(id).lean();
}

export async function acceptSerialTransfer(scope: Scope, id: string, input: { warehouseId?: string }, actor: Actor) {
  const pending = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode, transferToBranchId: scope.branchId, status: "in_transit" }).lean();
  if (pending?.currentDocumentType === "inventory-transfer" && pending.currentDocumentId) {
    const transfer = await singleUnitDocument(scope, id, pending.currentDocumentId, true);
    if (input.warehouseId && input.warehouseId !== transfer.toWarehouseId) throw Object.assign(new Error("Kho nhận phải khớp chứng từ điều chuyển."), { statusCode: 409 });
    await receiveInventoryTransfer({ companyCode: scope.companyCode, branchId: scope.branchId }, pending.currentDocumentId, actor);
    return SerialUnitModel.findById(id).lean();
  }
  if (pending?.currentDocumentType === "serial-transfer") throw Object.assign(new Error("Phiếu chuyển serial cũ chưa có sổ kho. Hãy hủy và tạo lại phiếu điều chuyển để đồng bộ tồn."), { statusCode: 409, code: "LEGACY_SERIAL_TRANSFER_REQUIRES_REISSUE" });
  throw Object.assign(new Error("Không tìm thấy serial đang chờ nhận."), { statusCode: 409, code: "SERIAL_TRANSFER_NOT_PENDING" });
}

export async function cancelSerialTransfer(scope: Scope, id: string, reason: string, actor: Actor) {
  if (!reason.trim()) throw Object.assign(new Error("Lý do hủy chuyển kho là bắt buộc."), { statusCode: 400 });
  const pending = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, status: "in_transit" }).lean();
  if (pending?.currentDocumentType === "inventory-transfer" && pending.currentDocumentId) {
    await singleUnitDocument(scope, id, pending.currentDocumentId, false);
    await cancelInventoryTransfer({ companyCode: scope.companyCode, branchId: scope.branchId }, pending.currentDocumentId, reason, actor);
    return SerialUnitModel.findById(id).lean();
  }
  return runInventoryTransaction(async (session) => {
    const unit: any = await SerialUnitModel.findOneAndUpdate({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}), status: "in_transit", currentDocumentType: "serial-transfer" }, { $set: { status: "in_stock", updatedBy: actor.id }, $unset: { transferToBranchId: 1, transferToWarehouseId: 1 } }, { returnDocument: 'after', session });
    if (!unit) throw Object.assign(new Error("Không tìm thấy serial đang chờ chuyển tại kho gửi."), { statusCode: 409, code: "SERIAL_TRANSFER_NOT_PENDING" });
    await SerialEventModel.create([{ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "transfer_cancelled", fromStatus: "in_transit", toStatus: "in_stock", documentType: "serial-transfer", documentId: String(unit._id), reason: reason.trim(), actorId: actor.id, actorName: actor.name }], { session });
    return unit;
  });
}
