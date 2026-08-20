import { SerialEventModel } from "../../inventory/serials/serial-event.model";
import { SerialUnitModel } from "../../inventory/serials/serial-unit.model";
import { normalizeSerialNumber } from "../../inventory/serials/serial-state";

export async function recordRepairSerialLifecycle(ticket: any, phase: "received" | "delivered", actor: { id: string; name: string }) {
  const serial = String(ticket?.device?.serialNumber || ticket?.device?.imei || "").trim();
  if (!serial) return;
  const fromStatus = phase === "received" ? "sold" : "repairing";
  const toStatus = phase === "received" ? "repairing" : "sold";
  const unit: any = await SerialUnitModel.findOneAndUpdate(
    { companyCode: String(ticket.companyCode), normalizedSerialNumber: normalizeSerialNumber(serial), status: fromStatus },
    { $set: { status: toStatus, currentDocumentType: "repair-ticket", currentDocumentId: String(ticket._id), updatedBy: actor.id } },
    { new: true },
  );
  if (!unit) return;
  await SerialEventModel.create({ companyCode: String(ticket.companyCode), branchId: String(ticket.branchId), serialUnitId: String(unit._id), serialNumber: unit.serialNumber, eventType: `repair_${phase}`, fromStatus, toStatus, documentType: "repair-ticket", documentId: String(ticket._id), reason: String(ticket.ticketCode || ""), actorId: actor.id, actorName: actor.name });
}
