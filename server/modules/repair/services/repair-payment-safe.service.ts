import mongoose, { Types } from "mongoose";
import { RepairTicketModel } from "../repair-ticket.model";
import { RepairPaymentModel } from "../repair-payment.model";
import type { RepairActor, RepairScope } from "../repair-ticket.service";

const fail = (message: string, code: string, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
export function validateRepairPayment(amount: number, key: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw fail("Số tiền thanh toán phải là số nguyên dương.", "REPAIR_PAYMENT_AMOUNT_INVALID", 400);
  if (!key || key.length > 120) throw fail("Thiếu khóa yêu cầu thanh toán hợp lệ.", "REPAIR_PAYMENT_KEY_REQUIRED", 400);
}
async function replay(scope: RepairScope, ticketId: string, amount: number, key: string) {
  const payment = await RepairPaymentModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean();
  if (!payment) return null;
  if (payment.ticketId !== ticketId || payment.branchId !== scope.branchId || payment.amount !== amount) throw fail("Khóa yêu cầu đã dùng cho khoản thu khác.", "REPAIR_PAYMENT_KEY_REUSED");
  const ticket = await RepairTicketModel.findOne({ _id: ticketId, ...scope }).lean();
  if (!ticket) throw fail("Không tìm thấy phiếu sửa chữa.", "REPAIR_TICKET_NOT_FOUND", 404);
  return { ticket, payment, replayed: true };
}
export async function collectRepairPayment(scope: RepairScope, ticketId: string, amount: number, key: string, actor: RepairActor) {
  validateRepairPayment(amount, key);
  if (!Types.ObjectId.isValid(ticketId)) throw fail("Mã phiếu sửa chữa không hợp lệ.", "REPAIR_TICKET_ID_INVALID", 400);
  const prior = await replay(scope, ticketId, amount, key);
  if (prior) return prior;
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const ticket: any = await RepairTicketModel.findOne({ _id: ticketId, ...scope }).session(session);
      if (!ticket) throw fail("Không tìm thấy phiếu sửa chữa.", "REPAIR_TICKET_NOT_FOUND", 404);
      if (ticket.status !== "done") throw fail("Chỉ ghi nhận thanh toán khi phiếu đã sửa xong.", "REPAIR_PAYMENT_NOT_DUE");
      const beforePaid = Number(ticket.paidAmount || 0), due = Math.max(0, Number(ticket.totalAmount || 0) - beforePaid);
      if (amount > due) throw fail("Số tiền thanh toán vượt quá công nợ.", "REPAIR_PAYMENT_EXCEEDS_DUE", 400);
      if (ticket.paymentLedgerBaseline === undefined) ticket.paymentLedgerBaseline = beforePaid;
      ticket.paidAmount = beforePaid + amount;
      ticket.dueAmount = due - amount;
      ticket.paymentStatus = ticket.dueAmount === 0 ? "paid" : "partial";
      ticket.updatedBy = actor.id;
      await ticket.save({ session });
      const [payment] = await RepairPaymentModel.create([{ ...scope, ticketId, ticketCode: ticket.ticketCode, amount, idempotencyKey: key, beforePaid, afterPaid: ticket.paidAmount, dueAfter: ticket.dueAmount, createdBy: actor.id }], { session });
      result = { ticket: ticket.toObject(), payment: payment.toObject(), replayed: false };
    });
    return result;
  } catch (error: any) {
    const previous = await replay(scope, ticketId, amount, key);
    if (previous) return previous;
    throw error;
  } finally { await session.endSession(); }
}
export async function lookupRepairPayment(scope: RepairScope, ticketId: string, key: string) {
  const payment = await RepairPaymentModel.findOne({ ...scope, ticketId, idempotencyKey: key }).lean();
  return payment || null;
}
export async function reconcileRepairPayments(scope: RepairScope, ticketId: string) {
  const [ticket, payments] = await Promise.all([
    RepairTicketModel.findOne({ _id: ticketId, ...scope }).lean(),
    RepairPaymentModel.find({ ...scope, ticketId }).sort({ createdAt: 1 }).lean(),
  ]);
  if (!ticket) throw fail("Không tìm thấy phiếu sửa chữa.", "REPAIR_TICKET_NOT_FOUND", 404);
  const baseline = Number((ticket as any).paymentLedgerBaseline ?? (payments.length ? payments[0].beforePaid : ticket.paidAmount || 0));
  const ledgerPaid = payments.reduce((sum, item) => sum + Number(item.amount), baseline);
  const currentPaid = Number(ticket.paidAmount || 0);
  const currentDue = Math.max(0, Number(ticket.totalAmount || 0) - currentPaid);
  return { ticketId, baseline, ledgerPaid, currentPaid, currentDue, recordedDue: Number(ticket.dueAmount || 0), balanced: ledgerPaid === currentPaid && currentDue === Number(ticket.dueAmount || 0), payments };
}
