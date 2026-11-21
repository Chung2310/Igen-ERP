import type { ClientSession } from "mongoose";
import { randomUUID } from "node:crypto";
import { UserModel } from "../../model/user.model";
import { RepairTicketModel } from "./repair-ticket.model";
import type { RepairTicketDocument } from "./repair-ticket.interface";
import { assertRepairTransition, type RepairStatus } from "./repair-state";
import { dispatchRepairNotification } from "./services/repair-notify.service";
import { publishRepairTicketEvent } from "./services/repair-events";
import { recordRepairSerialLifecycle } from "./services/repair-serial-lifecycle";
import { accrueRepairCommission } from "../retail/services/retail-commission.service";
import { createGeneralRepairIntake } from "./services/repair-intake.service";
import { inInventoryTransaction } from "../inventory/inventory-transaction";

export type RepairScope = { companyCode: string; branchId: string };
export type RepairActor = { id: string; name: string };
function assertGeneralRepairSession(ticket: { intakeSource?: string }, session?: ClientSession) {
  if (ticket.intakeSource && session && !session.inTransaction()) throw Object.assign(new Error('Thao tác phiếu cần transaction đang hoạt động.'), { statusCode: 503 });
}

export async function createRepairTicket(scope: RepairScope, input: unknown, actor: RepairActor, session?: ClientSession) {
  const saved = await createGeneralRepairIntake(scope, input, actor, session);
  if (!session) afterRepairTicketEvent(saved, "received", actor);
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

export async function transitionRepairTicket(scope: RepairScope, id: string, to: RepairStatus, actor: RepairActor, note?: string, customerNotified = false, session?: ClientSession, technicianId?: string): Promise<RepairTicketDocument & { _id: unknown }> {
  const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertGeneralRepairSession(ticket, session);
  if (ticket.intakeSource && to === 'cancelled') return cancelRepairTicket(scope, id, note || '', actor, session);
  if (ticket.intakeSource && ticket.status === to && ['delivered', 'returned'].includes(to)) return ticket.toObject();
  if (ticket.intakeSource && !session) {
    const saved = await inInventoryTransaction((active) => transitionRepairTicket(scope, id, to, actor, note, customerNotified, active, technicianId));
    if (to === 'done' || to === 'delivered') afterRepairTicketEvent(saved, to, actor);
    return saved;
  }
  if (ticket.intakeSource && to === 'returned') {
    if (ticket.paidAmount > 0) throw Object.assign(new Error('Cần xử lý hoàn tiền trước khi trả đối tượng tiếp nhận.'), { statusCode: 409 });
    const { listRepairParts, returnRepairPart } = await import('./repair-part.service');
    for (const part of await listRepairParts(scope, id, session)) if (part.status === 'issued') await returnRepairPart(scope, id, String(part._id), note || 'Trả đối tượng tiếp nhận', actor, session);
    await recordRepairSerialLifecycle(ticket, 'returned', actor, session);
  }
  assertRepairTransition(ticket.status, to); const from = ticket.status;
  if (to === "delivered" && Math.max(0, Number(ticket.totalAmount || 0) - Number(ticket.paidAmount || 0)) > 0) throw Object.assign(new Error("Không thể giao máy khi phiếu còn công nợ."), { statusCode: 403, code: "REPAIR_DEBT_BLOCKED" });
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
  if (to === "done") {
    ticket.completedAt = new Date();
    ticket.dueAmount = Math.max(0, Number(ticket.totalAmount || 0) - Number(ticket.paidAmount || 0));
    ticket.paymentStatus = ticket.dueAmount === 0 ? "paid" : ticket.paidAmount > 0 ? "partial" : "unpaid";
    if (!ticket.feedbackToken) ticket.feedbackToken = randomUUID();
  }
  if (to === "delivered") ticket.deliveredAt = new Date(); ticket.updatedBy = actor.id; if (session) ticket.$session(session); await ticket.save();
  const saved = ticket.toObject();
  if (to === "delivered") { await recordRepairSerialLifecycle(saved, "delivered", actor, session); await accrueRepairCommission(scope, saved, session); }
  if (!session && (to === "done" || to === "delivered")) afterRepairTicketEvent(saved, to, actor);
  return saved;
}

export async function quoteRepairTicket(scope: RepairScope, id: string, amount: number, actor: RepairActor, note?: string, session?: ClientSession): Promise<RepairTicketDocument & { _id: unknown }> {
  if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error("Báo giá không hợp lệ."), { statusCode: 400 });
  const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertGeneralRepairSession(ticket, session);
  if (ticket.intakeSource && !session) return inInventoryTransaction((active) => quoteRepairTicket(scope, id, amount, actor, note, active));
  if (ticket.intakeSource && !Number.isSafeInteger(amount)) throw Object.assign(new Error('Báo giá cần là số nguyên VND để khớp luồng thu tiền.'), { statusCode: 400 });
  const quoteNote = String(note || "").trim();
  assertRepairTransition(ticket.status, "quoted"); ticket.quotedAmount = amount; ticket.quotedAt = new Date(); ticket.totalAmount = amount; ticket.dueAmount = 0; ticket.status = "quoted"; ticket.statusHistory.push({ from: "diagnosing", to: "quoted", at: new Date(), by: actor.id, byName: actor.name, ...(quoteNote ? { note: quoteNote } : {}), customerNotified: true }); await ticket.save(); return ticket.toObject();
}

export async function approveRepairQuote(scope: RepairScope, id: string, actor: RepairActor, session?: ClientSession): Promise<RepairTicketDocument & { _id: unknown }> {
  const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertGeneralRepairSession(ticket, session);
  if (ticket.intakeSource && !session) return inInventoryTransaction((active) => approveRepairQuote(scope, id, actor, active));
  assertRepairTransition(ticket.status, "approved"); ticket.customerApprovedAt = new Date(); ticket.dueAmount = 0; ticket.status = "approved"; ticket.statusHistory.push({ from: "quoted", to: "approved", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }); await ticket.save(); return ticket.toObject();
}

export async function deliverRepairTicket(scope: RepairScope, id: string, actor: RepairActor, _allowDebt = false) {
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (ticket.intakeSource) return transitionRepairTicket(scope, id, 'delivered', actor);
  assertRepairTransition(ticket.status, "delivered"); const dueAmount = Math.max(0, Number(ticket.totalAmount || 0) - Number(ticket.paidAmount || 0)); if (dueAmount > 0) throw Object.assign(new Error("Không thể giao máy khi phiếu còn công nợ."), { statusCode: 403, code: "REPAIR_DEBT_BLOCKED" });
  ticket.status = "delivered"; ticket.deliveredAt = new Date(); ticket.statusHistory.push({ from: "done", to: "delivered", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }); await ticket.save(); await accrueRepairCommission(scope, ticket); return ticket.toObject();
}

export async function recordRepairPayment(scope: RepairScope, id: string, amount: number, actor: RepairActor) {
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Số tiền thanh toán không hợp lệ."), { statusCode: 400 });
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (ticket.status !== "done") throw Object.assign(new Error("Chỉ ghi nhận thanh toán khi giao máy."), { statusCode: 409, code: "REPAIR_PAYMENT_NOT_DUE" });
  ticket.dueAmount = Math.max(0, Number(ticket.totalAmount || 0) - Number(ticket.paidAmount || 0));
  if (amount > ticket.dueAmount) throw Object.assign(new Error("Số tiền thanh toán vượt quá công nợ."), { statusCode: 400 });
  ticket.paidAmount += amount; ticket.dueAmount = Math.max(0, ticket.totalAmount - ticket.paidAmount); ticket.paymentStatus = ticket.dueAmount === 0 ? "paid" : "partial"; ticket.updatedBy = actor.id; await ticket.save(); return ticket.toObject();
}

export async function cancelRepairTicket(scope: RepairScope, id: string, reason: string, actor: RepairActor, session?: ClientSession): Promise<RepairTicketDocument & { _id: unknown }> {
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hủy phiếu là bắt buộc."), { statusCode: 400 });
  const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertGeneralRepairSession(ticket, session);
  if (ticket.intakeSource && !session) return inInventoryTransaction((active) => cancelRepairTicket(scope, id, note, actor, active));
  if (ticket.intakeSource && ticket.status === 'cancelled') {
    if (ticket.statusHistory.at(-1)?.note === note) return ticket.toObject();
    throw Object.assign(new Error('Phiếu đã hủy với lý do khác. Hãy tải lại lịch sử phiếu.'), { statusCode: 409 });
  }
  if (ticket.intakeSource && Number(ticket.paidAmount || 0) > 0) throw Object.assign(new Error('Cần xử lý hoàn tiền trước khi hủy phiếu.'), { statusCode: 409 });
  if (ticket.intakeSource) {
    const { listRepairParts, returnRepairPart } = await import('./repair-part.service');
    for (const part of await listRepairParts(scope, id, session)) if (part.status === 'issued') await returnRepairPart(scope, id, String(part._id), `Hủy phiếu: ${note}`, actor, session);
    await recordRepairSerialLifecycle(ticket, 'cancelled', actor, session);
  }
  assertRepairTransition(ticket.status, "cancelled"); const from = ticket.status; ticket.status = "cancelled"; ticket.statusHistory.push({ from, to: "cancelled", at: new Date(), by: actor.id, byName: actor.name, note, customerNotified: false }); await ticket.save(session ? { session } : {});
  if (ticket.intakeSource) return ticket.toObject();
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
