import { Types, type ClientSession } from 'mongoose';
import Joi from 'joi';
import type { RepairRefundEntry, RepairRefundInput, RepairRefundResult, RepairRefundSummary, RepairRefundVoucher } from '../../../../shared/repair-refund';
import { RepairTicketModel } from '../repair-ticket.model';
import type { RepairTicketDocument } from '../repair-ticket.interface';
import type { RepairScope, RepairActor } from '../repair-ticket.service';
import { RepairRefundRequestModel } from '../repair-refund-request.model';
import { FinanceCashVoucherModel } from '../../finance/models/finance-treasury.model';
import { financeTransaction, assertCashPeriodOpen } from '../../finance/services/finance-posting.service';
import { financeToday, validDay } from '../../finance/services/financial-calculations';
import { RetailCommissionLedgerModel } from '../../retail/models/retail-commission.model';
import { reverseRepairRefundCommission } from '../../retail/services/retail-commission.service';

const fail = (message: string, code: string, statusCode = 409) => Object.assign(new Error(message), { code, statusCode });
const schema = Joi.object<RepairRefundInput>({
  amount: Joi.number().integer().min(1).max(1e14).required(),
  laborAmount: Joi.number().integer().min(0).max(Joi.ref('amount')).required(),
  reference: Joi.string().trim().min(1).max(120).required(),
  reason: Joi.string().trim().min(1).max(500).required(),
  idempotencyKey: Joi.string().pattern(/^[A-Za-z0-9_-]{8,120}$/).required(),
}).unknown(false);
type Ticket = RepairTicketDocument & { _id: unknown };
function validate(scope: RepairScope, ticketId: string) {
  if (!scope.companyCode?.trim() || !scope.branchId?.trim() || !Types.ObjectId.isValid(ticketId)) throw fail('Phạm vi hoặc mã phiếu sửa chữa không hợp lệ.', 'REPAIR_REFUND_SCOPE_INVALID', 400);
}
function parse(input: unknown): RepairRefundInput {
  const result = schema.validate(input, { convert: false, abortEarly: false });
  if (result.error) throw fail('Nhập số tiền VND nguyên dương, phần tiền công, phiếu chi và lý do hợp lệ.', 'REPAIR_REFUND_INPUT_INVALID', 400);
  return result.value;
}
async function ticketFor(scope: RepairScope, ticketId: string, session?: ClientSession) {
  validate(scope, ticketId);
  const ticket = await RepairTicketModel.findOne({ _id: ticketId, ...scope }).session(session ?? null);
  if (!ticket) throw fail('Không tìm thấy phiếu sửa chữa trong chi nhánh.', 'REPAIR_TICKET_NOT_FOUND', 404);
  return ticket;
}
function recordedRefunds(ticket: Ticket): RepairRefundEntry[] {
  const rows = ticket.commissionRefunds || [];
  if (rows.some((r) => !Types.ObjectId.isValid(r.financeVoucherId || '') || !Number.isSafeInteger(r.amount) || r.amount <= 0 || !Number.isSafeInteger(r.laborAmount) || r.laborAmount < 0 || r.laborAmount > r.amount)) throw fail('Dữ liệu hoàn tiền cũ cần được đối soát trước khi tiếp tục.', 'REPAIR_REFUND_LEGACY_UNRECONCILED');
  return rows;
}
async function summaryFor(ticket: Ticket, session?: ClientSession): Promise<RepairRefundSummary> {
  const rows = recordedRefunds(ticket);
  const earned = await RetailCommissionLedgerModel.findOne({ companyCode: ticket.companyCode, branchId: ticket.branchId, sourceKey: `repair:${ticket._id}:labor`, sourceType: 'repair', sourceId: String(ticket._id) }).session(session ?? null).lean();
  const base = Math.min(ticket.totalAmount, Math.max(0, earned?.baseAmount ?? (Number(ticket.laborFee || 0) - Number(ticket.discountAmount || 0))));
  const refundedAmount = rows.reduce((s, r) => s + r.amount, 0);
  const refundedLabor = rows.reduce((s, r) => s + r.laborAmount, 0);
  if (![ticket.totalAmount, ticket.paidAmount, base, refundedAmount, refundedLabor].every(Number.isSafeInteger) || ticket.totalAmount < 0 || ticket.paidAmount < 0 || refundedAmount > ticket.paidAmount || refundedAmount > ticket.totalAmount || refundedLabor > base || refundedAmount - refundedLabor > ticket.totalAmount - base) throw fail('Số tiền trên phiếu và sổ hoàn cần được đối soát.', 'REPAIR_REFUND_BALANCE_INVALID');
  return { ticketId: String(ticket._id), ticketCode: ticket.ticketCode, status: ticket.status, totalAmount: ticket.totalAmount, paidAmount: ticket.paidAmount, refundedAmount, netCollected: ticket.paidAmount - refundedAmount, remaining: Math.min(ticket.totalAmount, ticket.paidAmount) - refundedAmount, remainingLabor: base - refundedLabor, remainingOther: ticket.totalAmount - base - (refundedAmount - refundedLabor), refunds: rows };
}
export async function repairRefundSummary(scope: RepairScope, ticketId: string) {
  return summaryFor(await ticketFor(scope, ticketId));
}
export async function repairRefundVouchers(scope: RepairScope, ticketId: string): Promise<RepairRefundVoucher[]> {
  const ticket = await ticketFor(scope, ticketId);
  if (ticket.status !== 'delivered') return [];
  const completion = ticket.completedAt ?? ticket.deliveredAt;
  if (!completion) return [];
  const rows = await FinanceCashVoucherModel.find({ ...scope, kind: 'payment', status: 'posted', reference: ticket.ticketCode, approvedBy: { $type: 'string', $ne: '' }, approvedAt: { $type: 'date' }, sourceKey: null, sourceType: null, sourceId: null, debtId: null, occurredOn: { $gte: financeToday(new Date(completion)), $lte: financeToday() } }).select('key amount occurredOn description').sort({ occurredOn: -1, _id: -1 }).limit(100).lean();
  return rows.map((row) => ({ _id: String(row._id), key: row.key, amount: row.amount, occurredOn: row.occurredOn, description: row.description }));
}
function identity(scope: RepairScope, ticketId: string, input: RepairRefundInput, actor: RepairActor) {
  if (!actor.id?.trim()) throw fail('Thiếu người ghi nhận hoàn tiền.', 'REPAIR_REFUND_ACTOR_REQUIRED', 401);
  return { ...scope, ticketId, actorId: actor.id, idempotencyKey: input.idempotencyKey, fingerprint: JSON.stringify([scope.companyCode, scope.branchId, ticketId, actor.id, input.amount, input.laborAmount, input.reference, input.reason]) };
}
async function inspect(scope: RepairScope, ticketId: string, input: RepairRefundInput, actor: RepairActor, session?: ClientSession): Promise<RepairRefundResult> {
  const expected = identity(scope, ticketId, input, actor);
  const request = await RepairRefundRequestModel.findOne({ companyCode: scope.companyCode, idempotencyKey: input.idempotencyKey }).session(session ?? null).lean();
  if (!request) return { status: 'not_found' };
  if (request.fingerprint !== expected.fingerprint || request.actorId !== actor.id || request.branchId !== scope.branchId || request.ticketId !== ticketId) throw fail('Khóa yêu cầu đã dùng cho nội dung hoặc người thao tác khác.', 'REPAIR_REFUND_KEY_CONFLICT');
  if (request.status === 'revoked') return { status: 'revoked' };
  const ticket = await ticketFor(scope, ticketId, session);
  const row = recordedRefunds(ticket).find((r) => r.key === input.idempotencyKey);
  if (!row || row.amount !== input.amount || row.laborAmount !== input.laborAmount || row.reason !== input.reason || row.reference !== input.reference || row.by !== actor.id || row.financeVoucherId !== request.financeVoucherId) throw fail('Khoản hoàn và yêu cầu không khớp. Giữ nguyên yêu cầu để đối soát.', 'REPAIR_REFUND_PROOF_CONFLICT');
  const proof = await FinanceCashVoucherModel.findOne({ ...scope, _id: row.financeVoucherId, status: 'posted', kind: 'payment', amount: row.amount, reference: ticket.ticketCode, sourceKey: `repair-refund:${ticketId}:${row.key}`, sourceType: 'repair-refund', sourceId: ticketId, approvedBy: { $type: 'string', $ne: '' }, approvedAt: { $type: 'date' } }).session(session ?? null).lean();
  if (!proof || financeToday(new Date(row.at)) !== proof.occurredOn) throw fail('Phiếu chi hoàn tiền không còn khớp. Cần đối soát.', 'REPAIR_REFUND_PROOF_CONFLICT');
  return { status: 'completed', summary: await summaryFor(ticket, session) };
}
export async function reconcileRepairRefund(scope: RepairScope, ticketId: string, raw: unknown, actor: RepairActor) {
  await ticketFor(scope, ticketId);
  return inspect(scope, ticketId, parse(raw), actor);
}
export async function revokeRepairRefund(scope: RepairScope, ticketId: string, raw: unknown, actor: RepairActor) {
  const input = parse(raw);
  try {
    return await financeTransaction(scope, async (session) => {
      await ticketFor(scope, ticketId, session);
      const existing = await inspect(scope, ticketId, input, actor, session);
      if (existing.status !== 'not_found') return existing;
      await RepairRefundRequestModel.create([{ ...identity(scope, ticketId, input, actor), status: 'revoked' }], { session });
      return { status: 'revoked' as const };
    });
  } catch (cause) {
    const result = await inspect(scope, ticketId, input, actor);
    if (result.status !== 'not_found') return result;
    throw cause;
  }
}
export async function postRepairRefund(scope: RepairScope, ticketId: string, raw: unknown, actor: RepairActor): Promise<RepairRefundResult> {
  validate(scope, ticketId);
  const input = parse(raw);
  try {
    return await financeTransaction(scope, async (session) => {
      const ticket = await ticketFor(scope, ticketId, session);
      const existing = await inspect(scope, ticketId, input, actor, session);
      if (existing.status !== 'not_found') return existing;
      if (ticket.status !== 'delivered') throw fail('Chỉ hoàn tiền cho phiếu đã bàn giao.', 'REPAIR_REFUND_NOT_DELIVERED');
      const summary = await summaryFor(ticket, session);
      if (input.amount > summary.remaining || input.laborAmount > summary.remainingLabor || input.amount - input.laborAmount > summary.remainingOther) throw fail('Số tiền hoàn vượt khoản đã thu hoặc phần tiền công/phần khác còn lại.', 'REPAIR_REFUND_EXCEEDS_BALANCE', 400);
      const candidates = await FinanceCashVoucherModel.find({ ...scope, $or: [{ key: input.reference }, ...(Types.ObjectId.isValid(input.reference) ? [{ _id: input.reference }] : [])] }).limit(2).session(session);
      const voucher = candidates.length === 1 ? candidates[0] : null;
      if (!voucher || voucher.status !== 'posted' || voucher.kind !== 'payment' || voucher.amount !== input.amount || voucher.reference !== ticket.ticketCode || !voucher.approvedBy || !voucher.approvedAt || voucher.sourceKey != null || voucher.sourceType != null || voucher.sourceId != null || voucher.debtId != null) throw fail('Chọn phiếu chi đã duyệt, đúng số tiền, tham chiếu mã phiếu sửa và chưa liên kết nghiệp vụ khác.', 'REPAIR_REFUND_VOUCHER_INVALID');
      const day = validDay(voucher.occurredOn), completion = ticket.completedAt ?? ticket.deliveredAt;
      if (!completion || day < financeToday(new Date(completion)) || day > financeToday()) throw fail('Ngày phiếu chi không phù hợp với ngày hoàn tất sửa chữa.', 'REPAIR_REFUND_DATE_INVALID');
      await assertCashPeriodOpen(scope, day, session);
      const claimed = await FinanceCashVoucherModel.updateOne({ ...scope, _id: voucher._id, version: voucher.version, status: 'posted', sourceKey: null, sourceType: null, sourceId: null, debtId: null }, { $set: { sourceKey: `repair-refund:${ticketId}:${input.idempotencyKey}`, sourceType: 'repair-refund', sourceId: ticketId }, $inc: { version: 1 } }, { session });
      if (claimed.modifiedCount !== 1) throw fail('Phiếu chi vừa được sử dụng. Hãy đối soát lại.', 'REPAIR_REFUND_VOUCHER_CONFLICT');
      const row: RepairRefundEntry = { key: input.idempotencyKey, amount: input.amount, laborAmount: input.laborAmount, reason: input.reason, reference: input.reference, financeVoucherId: String(voucher._id), at: new Date(`${day}T00:00:00+07:00`), recordedAt: new Date(), by: actor.id, byName: actor.name || actor.id };
      ticket.commissionRefunds = [...(ticket.commissionRefunds || []), row];
      await ticket.save({ session });
      await RepairRefundRequestModel.create([{ ...identity(scope, ticketId, input, actor), financeVoucherId: row.financeVoucherId, status: 'completed' }], { session });
      await reverseRepairRefundCommission(scope, ticketId, ticket.commissionRefunds.reduce((s, r) => s + r.laborAmount, 0), input.idempotencyKey, day, session);
      return { status: 'completed', summary: await summaryFor(ticket, session) };
    });
  } catch (cause) {
    const result = await inspect(scope, ticketId, input, actor);
    if (result.status !== 'not_found') return result;
    throw cause;
  }
}
