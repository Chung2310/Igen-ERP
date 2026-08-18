import type { ClientSession } from "mongoose";
import { randomUUID } from "node:crypto";
import { RepairTicketModel } from "./repair-ticket.model";
import type { RepairCoverage, RepairTicketDocument } from "./repair-ticket.interface";
import { assertRepairTransition, type RepairStatus } from "./repair-state";

export type RepairScope = { companyCode: string; branchId: string };
export type RepairActor = { id: string; name: string };

export async function createRepairTicket(scope: RepairScope, input: Omit<RepairTicketDocument, "companyCode" | "branchId" | "status" | "statusHistory" | "createdAt" | "updatedAt"> & { ticketCode: string; coverage: RepairCoverage }, actor: RepairActor, session?: ClientSession) {
  if (!input.customerId || !input.device?.name || !input.symptom) throw Object.assign(new Error("Khách hàng, thiết bị và mô tả lỗi là bắt buộc."), { statusCode: 400 });
  const ticket = new RepairTicketModel({ ...input, ...scope, status: "received", statusHistory: [{ to: "received", at: new Date(), by: actor.id, byName: actor.name, customerNotified: false }], createdBy: actor.id, createdByName: actor.name });
  if (session) ticket.$session(session);
  return (await ticket.save()).toObject();
}

export async function transitionRepairTicket(scope: RepairScope, id: string, to: RepairStatus, actor: RepairActor, note?: string, customerNotified = false, session?: ClientSession) {
  const query = RepairTicketModel.findOne({ _id: id, ...scope }); if (session) query.session(session); const ticket: any = await query; if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertRepairTransition(ticket.status, to); const from = ticket.status; ticket.status = to; ticket.statusHistory.push({ from, to, at: new Date(), by: actor.id, byName: actor.name, note, customerNotified });
  if (to === "done") ticket.completedAt = new Date(); if (to === "delivered") ticket.deliveredAt = new Date(); ticket.updatedBy = actor.id; if (session) ticket.$session(session); await ticket.save(); return ticket.toObject();
}

export async function quoteRepairTicket(scope: RepairScope, id: string, amount: number, actor: RepairActor) {
  if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error("Báo giá không hợp lệ."), { statusCode: 400 });
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  assertRepairTransition(ticket.status, "quoted"); ticket.quotedAmount = amount; ticket.quotedAt = new Date(); ticket.totalAmount = amount; ticket.dueAmount = Math.max(0, amount - ticket.paidAmount); ticket.status = "quoted"; ticket.statusHistory.push({ from: "diagnosing", to: "quoted", at: new Date(), by: actor.id, byName: actor.name, customerNotified: true }); await ticket.save(); return ticket.toObject();
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
  assertRepairTransition(ticket.status, "cancelled"); const from = ticket.status; ticket.status = "cancelled"; ticket.statusHistory.push({ from, to: "cancelled", at: new Date(), by: actor.id, byName: actor.name, note, customerNotified: true }); await ticket.save(); return ticket.toObject();
}

export async function createFeedbackQr(scope: RepairScope, id: string) {
  const ticket: any = await RepairTicketModel.findOne({ _id: id, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (ticket.status !== "done") throw Object.assign(new Error("Chỉ tạo QR khi phiếu đã sửa xong."), { statusCode: 409 });
  if (!ticket.feedbackToken) { ticket.feedbackToken = randomUUID(); await ticket.save(); }
  return { ticketCode: ticket.ticketCode, feedbackToken: ticket.feedbackToken, url: `/repair/feedback/${ticket.feedbackToken}` };
}
