import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";
import type { ClientSession } from "mongoose";

export async function recordRepairSerialLifecycle(ticket: any, phase: "received" | "delivered" | "cancelled" | "returned", actor: { id: string; name: string }, session?: ClientSession) {
  if (ticket.intakeSource) {
    if (ticket.intakeSource === 'external') return;
    if (!session?.inTransaction() || !ticket.linkedSerialUnitId) throw Object.assign(new Error('Thiếu transaction hoặc định danh đã xác minh của phiếu.'), { statusCode: 409 });
    const fromStatus = phase === 'received' ? 'sold' : 'repairing';
    const toStatus = phase === 'received' ? 'repairing' : 'sold';
    if (phase !== 'received' && !await SerialEventModel.exists({ companyCode: ticket.companyCode, serialUnitId: ticket.linkedSerialUnitId, documentType: 'repair-ticket', documentId: String(ticket._id), eventType: 'repair_received' }).session(session)) throw Object.assign(new Error('Không đủ bằng chứng tiếp nhận để bàn giao/trả lại hàng.'), { statusCode: 409 });
    const unit = await SerialUnitModel.findOneAndUpdate({ _id: ticket.linkedSerialUnitId, companyCode: ticket.companyCode, status: fromStatus, ...(phase !== 'received' ? { currentDocumentType: 'repair-ticket', currentDocumentId: String(ticket._id) } : {}) }, { $set: { status: toStatus, currentDocumentType: 'repair-ticket', currentDocumentId: String(ticket._id), updatedBy: actor.id } }, { returnDocument: 'after', session });
    if (!unit) throw Object.assign(new Error('Đơn vị hàng đã thay đổi hoặc đang thuộc phiếu khác. Cần đối soát trước khi tiếp tục.'), { statusCode: 409 });
    await SerialEventModel.create([{ companyCode: ticket.companyCode, branchId: ticket.branchId, serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: `repair_${phase}`, fromStatus, toStatus, documentType: 'repair-ticket', documentId: String(ticket._id), reason: ticket.ticketCode, actorId: actor.id, actorName: actor.name }], { session });
    return;
  }
  const serial = String(ticket?.device?.serialNumber || ticket?.device?.imei || "").trim();
  if (!serial) return;
  const fromStatus = phase === "received" ? "sold" : "repairing";
  const toStatus = phase === "received" ? "repairing" : "sold";
  const unit: any = await SerialUnitModel.findOneAndUpdate(
    { companyCode: String(ticket.companyCode), normalizedSerialNumber: normalizeSerialNumber(serial), status: fromStatus },
    { $set: { status: toStatus, currentDocumentType: "repair-ticket", currentDocumentId: String(ticket._id), updatedBy: actor.id } },
    { returnDocument: 'after' },
  );
  if (!unit) return;
  await SerialEventModel.create({ companyCode: String(ticket.companyCode), branchId: String(ticket.branchId), serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: `repair_${phase}`, fromStatus, toStatus, documentType: "repair-ticket", documentId: String(ticket._id), reason: String(ticket.ticketCode || ""), actorId: actor.id, actorName: actor.name });
}
