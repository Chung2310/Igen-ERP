import { SerialEventModel } from "./serial-event.model";
import { SerialUnitModel } from "./serial-unit.model";

type Scope = { companyCode: string; branchId: string; warehouseId?: string };
type Actor = { id: string; name: string };

export async function requestSerialTransfer(scope: Scope, id: string, input: { toBranchId: string; toWarehouseId?: string; reason: string }, actor: Actor) {
  if (!input.toBranchId || !input.reason?.trim()) throw Object.assign(new Error("Chi nhánh nhận và lý do chuyển là bắt buộc."), { statusCode: 400 });
  const unit: any = await SerialUnitModel.findOneAndUpdate({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}), status: "in_stock" }, { $set: { status: "in_transit", transferToBranchId: input.toBranchId, transferToWarehouseId: input.toWarehouseId, currentDocumentType: "serial-transfer", currentDocumentId: id, updatedBy: actor.id } }, { new: true });
  if (!unit) throw Object.assign(new Error("IMEI/serial không sẵn sàng để chuyển kho."), { statusCode: 409, code: "SERIAL_NOT_TRANSFERABLE" });
  await SerialEventModel.create({ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "transfer_requested", fromStatus: "in_stock", toStatus: "in_transit", documentType: "serial-transfer", documentId: String(unit._id), reason: `${scope.branchId}/${scope.warehouseId || ""} → ${input.toBranchId}/${input.toWarehouseId || ""}: ${input.reason.trim()}`, actorId: actor.id, actorName: actor.name });
  return unit;
}

export async function acceptSerialTransfer(scope: Scope, id: string, input: { warehouseId?: string }, actor: Actor) {
  const unit: any = await SerialUnitModel.findOneAndUpdate({ _id: id, companyCode: scope.companyCode, transferToBranchId: scope.branchId, status: "in_transit" }, { $set: { branchId: scope.branchId, warehouseId: input.warehouseId, status: "in_stock", currentDocumentType: "serial-transfer", currentDocumentId: id, updatedBy: actor.id }, $unset: { transferToBranchId: 1, transferToWarehouseId: 1 } }, { new: true });
  if (!unit) throw Object.assign(new Error("Không tìm thấy serial đang chờ nhận."), { statusCode: 409, code: "SERIAL_TRANSFER_NOT_PENDING" });
  await SerialEventModel.create({ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "transfer_received", fromStatus: "in_transit", toStatus: "in_stock", documentType: "serial-transfer", documentId: String(unit._id), actorId: actor.id, actorName: actor.name });
  return unit;
}

export async function cancelSerialTransfer(scope: Scope, id: string, reason: string, actor: Actor) {
  if (!reason.trim()) throw Object.assign(new Error("Lý do hủy chuyển kho là bắt buộc."), { statusCode: 400 });
  const unit: any = await SerialUnitModel.findOneAndUpdate({ _id: id, companyCode: scope.companyCode, branchId: scope.branchId, ...(scope.warehouseId ? { warehouseId: scope.warehouseId } : {}), status: "in_transit" }, { $set: { status: "in_stock", updatedBy: actor.id } }, { new: true });
  if (!unit) throw Object.assign(new Error("Không tìm thấy serial đang chờ chuyển tại kho gửi."), { statusCode: 409, code: "SERIAL_TRANSFER_NOT_PENDING" });
  await SerialEventModel.create({ companyCode: scope.companyCode, branchId: scope.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: "transfer_cancelled", fromStatus: "in_transit", toStatus: "in_stock", documentType: "serial-transfer", documentId: String(unit._id), reason: reason.trim(), actorId: actor.id, actorName: actor.name });
  return unit;
}
