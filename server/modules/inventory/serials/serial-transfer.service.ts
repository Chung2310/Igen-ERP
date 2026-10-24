import { SerialEventModel } from "./serial-event.model";
import { SerialUnitModel } from "./serial-unit.model";
import { randomUUID } from "node:crypto";
import { requestInventoryTransfer, receiveInventoryTransfer, cancelInventoryTransfer } from "../transfers/transfer.service";
import { ensureDefaultWarehouse } from "../warehouse/warehouse.service";

type Scope = { companyCode: string; branchId: string; warehouseId?: string };
type Actor = { id: string; name: string };

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
    await receiveInventoryTransfer({ companyCode: scope.companyCode, branchId: scope.branchId }, pending.currentDocumentId, actor);
    return SerialUnitModel.findById(id).lean();
  }
  const unit: any = await SerialUnitModel.findOneAndUpdate({ _id: id, companyCode: scope.companyCode, transferToBranchId: scope.branchId, status: "in_transit", currentDocumentType: "serial-transfer" }, { $set: { branchId: scope.branchId, warehouseId: input.warehouseId, status: "in_stock", currentDocumentType: "serial-transfer", currentDocumentId: id, updatedBy: actor.id }, $unset: { transferToBranchId: 1, transferToWarehouseId: 1 } }, { returnDocument: 'after' });
  if (!unit) throw Object.assign(new Error("Không tìm thấy serial đang chờ nhận."), { statusCode: 409, code: "SERIAL_TRANSFER_NOT_PENDING" });
  await SerialEventModel.create({ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "transfer_received", fromStatus: "in_transit", toStatus: "in_stock", documentType: "serial-transfer", documentId: String(unit._id), actorId: actor.id, actorName: actor.name });
  return unit;
}

export async function cancelSerialTransfer(scope: Scope, id: string, reason: string, actor: Actor) {
  if (!reason.trim()) throw Object.assign(new Error("Lý do hủy chuyển kho là bắt buộc."), { statusCode: 400 });
  const pending = await SerialUnitModel.findOne({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}), status: "in_transit" }).lean();
  if (pending?.currentDocumentType === "inventory-transfer" && pending.currentDocumentId) {
    await cancelInventoryTransfer({ companyCode: scope.companyCode, branchId: scope.branchId }, pending.currentDocumentId, reason, actor);
    return SerialUnitModel.findById(id).lean();
  }
  const unit: any = await SerialUnitModel.findOneAndUpdate({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}), status: "in_transit", currentDocumentType: "serial-transfer" }, { $set: { status: "in_stock", updatedBy: actor.id } }, { returnDocument: 'after' });
  if (!unit) throw Object.assign(new Error("Không tìm thấy serial đang chờ chuyển tại kho gửi."), { statusCode: 409, code: "SERIAL_TRANSFER_NOT_PENDING" });
  await SerialEventModel.create({ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "transfer_cancelled", fromStatus: "in_transit", toStatus: "in_stock", documentType: "serial-transfer", documentId: String(unit._id), reason: reason.trim(), actorId: actor.id, actorName: actor.name });
  return unit;
}
