import mongoose, { Types } from "mongoose";
import { RepairTicketModel } from "../repair-ticket.model";
import { RepairCareCaseModel, RepairCareEventModel } from "../repair-care.model";
import type { RepairActor, RepairScope } from "../repair-ticket.service";

const fail = (message: string, code: string, statusCode = 400) => Object.assign(new Error(message), { code, statusCode });
const validKey = (value: unknown) => { const key = String(value || "").trim(); if (!key || key.length > 120) throw fail("Thiếu khóa yêu cầu CSKH hợp lệ.", "REPAIR_CARE_KEY_REQUIRED"); return key; };
async function scopedTicket(scope: RepairScope, ticketId: string, session?: mongoose.ClientSession) {
  if (!Types.ObjectId.isValid(ticketId)) throw fail("Mã phiếu sửa chữa không hợp lệ.", "REPAIR_TICKET_ID_INVALID");
  const ticket = await RepairTicketModel.findOne({ _id: ticketId, ...scope }).session(session || null).lean();
  if (!ticket) throw fail("Không tìm thấy phiếu sửa chữa.", "REPAIR_TICKET_NOT_FOUND", 404);
  return ticket;
}
export async function repairCareForTicket(scope: RepairScope, ticketId: string) {
  const ticket = await scopedTicket(scope, ticketId);
  const [careCase, events] = await Promise.all([
    RepairCareCaseModel.findOne({ ...scope, ticketId }).lean(),
    RepairCareEventModel.find({ ...scope, ticketId }).sort({ createdAt: 1, _id: 1 }).limit(500).lean(),
  ]);
  return { careCase: careCase || { ticketId, ticketCode: ticket.ticketCode, customerId: ticket.customerId, customerName: ticket.customerName, status: "open" }, events };
}
export async function repairCareForCustomer(scope: RepairScope, customerId: string) {
  const tickets = await RepairTicketModel.find({ ...scope, customerId }).select("_id ticketCode customerName status receivedAt").sort({ receivedAt: -1 }).limit(100).lean();
  const events = await RepairCareEventModel.find({ ...scope, customerId }).sort({ createdAt: -1 }).limit(200).lean();
  return { tickets, events };
}
export function normalizeCareMessage(input: any) {
  const channel = String(input.channel || ""), direction = String(input.direction || ""), body = String(input.body || "").trim();
  if (!["phone", "email", "zalo", "in_person", "internal"].includes(channel) || !["incoming", "outgoing", "note"].includes(direction) || !body || body.length > 5000) throw fail("Kênh, chiều hội thoại hoặc nội dung không hợp lệ.", "REPAIR_CARE_MESSAGE_INVALID");
  return { channel, direction, body, idempotencyKey: validKey(input.idempotencyKey) };
}
async function addEvent(scope: RepairScope, ticketId: string, key: string, actor: RepairActor, make: (status: string) => any) {
  const sameIntent = (event: any) => { const expected = make(event.fromStatus || "open"); return event.type === expected.type && (event.channel || "") === (expected.channel || "") && (event.direction || "") === (expected.direction || "") && (event.body || "") === (expected.body || "") && (event.toStatus || "") === (expected.toStatus || ""); };
  const previous = await RepairCareEventModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean();
  if (previous) { if (previous.branchId !== scope.branchId || previous.ticketId !== ticketId || !sameIntent(previous)) throw fail("Khóa yêu cầu đã dùng cho nội dung khác.", "REPAIR_CARE_KEY_REUSED", 409); return previous; }
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const ticket = await scopedTicket(scope, ticketId, session);
      const careCase: any = await RepairCareCaseModel.findOneAndUpdate({ ...scope, ticketId }, { $setOnInsert: { ...scope, ticketId, ticketCode: ticket.ticketCode, customerId: ticket.customerId, customerName: ticket.customerName, status: "open" } }, { upsert: true, returnDocument: "after", session });
      const values = make(careCase.status);
      if (values.toStatus && values.toStatus !== careCase.status) { careCase.status = values.toStatus; careCase.updatedBy = actor.id; }
      careCase.lastEventAt = new Date();
      await careCase.save({ session });
      const [event] = await RepairCareEventModel.create([{ ...scope, ticketId, customerId: ticket.customerId, idempotencyKey: key, ...values, actorId: actor.id, actorName: actor.name }], { session });
      result = event.toObject();
    });
    return result;
  } catch (error: any) {
    const replay = await RepairCareEventModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean();
    if (replay && replay.ticketId === ticketId && replay.branchId === scope.branchId && sameIntent(replay)) return replay;
    throw error;
  } finally { await session.endSession(); }
}
export async function addRepairCareMessage(scope: RepairScope, ticketId: string, input: any, actor: RepairActor) {
  const values = normalizeCareMessage(input);
  return addEvent(scope, ticketId, values.idempotencyKey, actor, () => ({ type: "message", channel: values.channel, direction: values.direction, body: values.body }));
}
export async function changeRepairCareStatus(scope: RepairScope, ticketId: string, input: any, actor: RepairActor) {
  const toStatus = String(input.status || ""), key = validKey(input.idempotencyKey);
  if (!["open", "waiting", "resolved"].includes(toStatus)) throw fail("Trạng thái CSKH không hợp lệ.", "REPAIR_CARE_STATUS_INVALID");
  return addEvent(scope, ticketId, key, actor, (fromStatus) => ({ type: "status", fromStatus, toStatus, body: String(input.note || "").trim().slice(0, 1000) }));
}
