import type { ClientSession } from "mongoose";
import { randomUUID } from "node:crypto";
import { UserModel } from "../../model/user.model";
import { RepairTicketModel } from "./repair-ticket.model";
import type { RepairCoverage, RepairTicketDocument } from "./repair-ticket.interface";
import { assertRepairTransition, type RepairStatus } from "./repair-state";
import { dispatchRepairNotification } from "./services/repair-notify.service";
import { publishRepairTicketEvent } from "./services/repair-events";
import { assertSoldSerialForRepair } from "./repair-serial-validation";
import { recordRepairSerialLifecycle } from "./services/repair-serial-lifecycle";
import { requireSoldSerialForRepair } from "./repair-sold-serial.service";

export type RepairScope = { companyCode: string; branchId: string };
export type RepairActor = { id: string; name: string };

export async function createRepairTicket(scope: RepairScope, input: Omit<RepairTicketDocument, "companyCode" | "branchId" | "status" | "statusHistory" | "createdAt" | "updatedAt"> & { ticketCode: string; coverage: RepairCoverage }, actor: RepairActor, session?: ClientSession) {
  if (!input.customerId || !input.device?.name || !input.symptom) throw Object.assign(new Error("Khách hàng, thiết bị và mô tả lỗi là bắt buộc."), { statusCode: 400 });
  assertSoldSerialForRepair(input.device);
  await requireSoldSerialForRepair(scope, input.device);
  const ticket = new RepairTicketModel({ ...input, ...scope, status: "received", statusHistory: [{ to: "received", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }], createdBy: actor.id, createdByName: actor.name });
  if (session) ticket.$session(session);
  const saved = (await ticket.save()).toObject();
  await recordRepairSerialLifecycle(saved, "received", actor);
  afterRepairTicketEvent(saved, "received", actor);
  return saved;
}

/**
 * Phát sự kiện và gửi tin cho khách sau khi phiếu đã lưu. Cố ý không await: gửi tin
 * chậm hoặc hỏng không được làm hỏng việc tiếp nhận / chuyển trạng thái phiếu.
 */
function afterRepairTicketEvent(ticket: any, event: "received" | "done" | "delivered", actor: RepairActor) {
  void publishRepairTicketEvent(event, ticket, actor).catch(() => undefined);
  if (event === "received" || event === "done") void dispatchRepairNotification(ticket, event).catch(() => undefined);
}

export async function transitionRepairTicket(scope: RepairScope, id: string, to: RepairStatus, actor: RepairActor, note?: string, customerNotified = false, session?: ClientSession, technicianId?: string) {
  const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertRepairTransition(ticket.status, to); const from = ticket.status;
  if (ticket.status === "received" && to === "diagnosing") {
    if (!technicianId) throw Object.assign(new Error("Cần chọn kỹ thuật viên tiếp nhận."), { statusCode: 400 });
    const technician: any = await UserModel.findOne({ _id: technicianId, companyCode: scope.companyCode, isActive: { $ne: false } }).select("displayName email").lean();
    if (!technician) throw Object.assign(new Error("Cần chọn kỹ thuật viên tiếp nhận."), { statusCode: 400 });
    ticket.technicianId = String(technician._id);
    ticket.technicianName = String(technician.displayName || technician.email || "");
    ticket.assignedAt = new Date();
    ticket.assignedBy = actor.id;
  }
  ticket.status = to; ticket.statusHistory.push({ from, to, at: new Date(), by: actor.id, byName: actor.name, note, customerNotified: to === "done" ? false : customerNotified, technicianId: ticket.technicianId, technicianName: ticket.technicianName });
  if (to === "done") { ticket.completedAt = new Date(); if (!ticket.feedbackToken) ticket.feedbackToken = randomUUID(); }
  if (to === "delivered") ticket.deliveredAt = new Date(); ticket.updatedBy = actor.id; if (session) ticket.$session(session); await ticket.save();
  const saved = ticket.toObject();
  if (to === "delivered") await recordRepairSerialLifecycle(saved, "delivered", actor);
  if (to === "done" || to === "delivered") afterRepairTicketEvent(saved, to, actor);
  return saved;
}

export async function quoteRepairTicket(scope: RepairScope, id: string, amount: number, actor: RepairActor, note?: string) {
  if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error("Báo giá không hợp lệ."), { statusCode: 400 });
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  const quoteNote = String(note || "").trim();
  assertRepairTransition(ticket.status, "quoted"); ticket.quotedAmount = amount; ticket.quotedAt = new Date(); ticket.totalAmount = amount; ticket.dueAmount = Math.max(0, amount - ticket.paidAmount); ticket.status = "quoted"; ticket.statusHistory.push({ from: "diagnosing", to: "quoted", at: new Date(), by: actor.id, byName: actor.name, ...(quoteNote ? { note: quoteNote } : {}), customerNotified: true }); await ticket.save(); return ticket.toObject();
}

export async function approveRepairQuote(scope: RepairScope, id: string, actor: RepairActor) {
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertRepairTransition(ticket.status, "approved"); ticket.customerApprovedAt = new Date(); ticket.status = "approved"; ticket.statusHistory.push({ from: "quoted", to: "approved", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }); await ticket.save(); return ticket.toObject();
}

export async function deliverRepairTicket(scope: RepairScope, id: string, actor: RepairActor, allowDebt = false) {
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertRepairTransition(ticket.status, "delivered"); if (ticket.dueAmount > 0 && !allowDebt) throw Object.assign(new Error("Không thể giao máy khi phiếu còn công nợ."), { statusCode: 403, code: "REPAIR_DEBT_BLOCKED" });
  ticket.status = "delivered"; ticket.deliveredAt = new Date(); ticket.statusHistory.push({ from: "done", to: "delivered", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }); await ticket.save(); return ticket.toObject();
}

export async function recordRepairPayment(scope: RepairScope, id: string, amount: number, actor: RepairActor) {
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Số tiền thanh toán không hợp lệ."), { statusCode: 400 });
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (amount > ticket.dueAmount) throw Object.assign(new Error("Số tiền thanh toán vượt quá công nợ."), { statusCode: 400 });
  ticket.paidAmount += amount; ticket.dueAmount = Math.max(0, ticket.totalAmount - ticket.paidAmount); ticket.paymentStatus = ticket.dueAmount === 0 ? "paid" : "partial"; ticket.updatedBy = actor.id; await ticket.save(); return ticket.toObject();
}

export async function cancelRepairTicket(scope: RepairScope, id: string, reason: string, actor: RepairActor) {
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hủy phiếu là bắt buộc."), { statusCode: 400 });
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertRepairTransition(ticket.status, "cancelled"); const from = ticket.status; ticket.status = "cancelled"; ticket.statusHistory.push({ from, to: "cancelled", at: new Date(), by: actor.id, byName: actor.name, note, customerNotified: false }); await ticket.save();
  // Huỷ phiếu thì linh kiện đã xuất phải quay về kho, nếu không kho âm dần theo mỗi phiếu huỷ.
  const { listRepairParts, returnRepairPart } = await import("./repair-part.service");
  for (const part of await listRepairParts(scope, id)) {
    if ((part as any).status !== "issued") continue;
    await returnRepairPart(scope, id, String((part as any)._id), `Huỷ phiếu: ${note}`, actor).catch(() => undefined);
  } return ticket.toObject();
}

export async function createFeedbackQr(scope: RepairScope, id: string) {
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (ticket.status !== "done") throw Object.assign(new Error("Chỉ tạo QR khi phiếu đã sửa xong."), { statusCode: 409 });
  if (!ticket.feedbackToken) { ticket.feedbackToken = randomUUID(); await ticket.save(); }
  return { ticketCode: ticket.ticketCode, feedbackToken: ticket.feedbackToken, url: `/repair/feedback/${ticket.feedbackToken}` };
}
