import mongoose, { Types, type ClientSession } from 'mongoose';
import CreditWallet, { type ICreditWallet } from '../models/CreditWallet.js';
import CreditLedgerEntry, { type CreditLedgerType, type CreditReferenceType } from '../models/CreditLedgerEntry.js';
import User from '../models/User.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { withTransaction } from './transactionService.js';
import { getCenterScope, runWithCenter, MissingCenterScopeError } from '../tenancy/centerContext.js';

type WalletDocument = mongoose.HydratedDocument<ICreditWallet>;

interface LedgerInput {
  userId: string; walletId: string; type: CreditLedgerType;
  availableDelta: number; reservedDelta: number; availableAfter: number; reservedAfter: number;
  referenceType: CreditReferenceType; referenceId: string; idempotencyKey: string; reason: string; actorUserId?: string;
}

function objectId(value: string) { return new Types.ObjectId(value); }
function isDuplicateKey(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000; }
async function inTransaction<T>(session: ClientSession | undefined, work: (active: ClientSession) => Promise<T>) { return session ? work(session) : withTransaction(work); }

async function appendLedger(input: LedgerInput, session: ClientSession) {
  const [entry] = await CreditLedgerEntry.create([{ ...input, userId: objectId(input.userId), walletId: objectId(input.walletId), actorUserId: input.actorUserId ? objectId(input.actorUserId) : undefined }], { session });
  return entry;
}

async function idempotentWallet(userId: string, idempotencyKey: string, session: ClientSession): Promise<WalletDocument | null> {
  const existing = await CreditLedgerEntry.findOne({ idempotencyKey }).session(session);
  if (!existing) return null;
  if (existing.userId.toString() !== userId) throw new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Idempotency key đã được sử dụng cho giao dịch khác.' });
  const wallet = await CreditWallet.findById(existing.walletId).session(session);
  if (!wallet) throw new AppError({ status: 500, code: ERROR_CODES.INTERNAL, message: 'Không tìm thấy ví của giao dịch đã ghi nhận.' });
  return wallet;
}

export async function ensureWallet(userId: string, session?: ClientSession): Promise<WalletDocument> {
  const scope = getCenterScope();
  if (!scope) throw new MissingCenterScopeError('CreditWallet');
  const userQuery = scope.kind === 'system'
    ? User.findById(userId)
    : User.findOne({ _id: userId, centerId: scope.centerId });
  // A newly created user is only visible inside the transaction creating it.
  if (session) userQuery.session(session);
  const user = await userQuery.select({ _id: 1, centerId: 1 }).lean();
  if (!user) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy người dùng của ví credit.' });
  if (scope.kind === 'center' && !user.centerId) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Tài khoản chưa được gán trung tâm.' });
  if (scope.kind === 'system' && user.centerId) return runWithCenter(String(user.centerId), () => ensureWallet(userId, session));

  try {
    const wallet = await CreditWallet.findOneAndUpdate(
      { userId: objectId(userId) },
      { $setOnInsert: { userId: objectId(userId), availableCredits: 0, reservedCredits: 0, version: 0 } },
      { upsert: true, returnDocument: 'after', ...(session ? { session } : {}) },
    );
    if (!wallet) throw new AppError({ status: 500, code: ERROR_CODES.INTERNAL, message: 'Không thể khởi tạo ví credit.' });
    return wallet;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const query = CreditWallet.findOne({ userId: objectId(userId) });
    if (session) query.session(session);
    const wallet = await query;
    if (!wallet) throw error;
    return wallet;
  }
}

export async function getWalletSummary(userId: string) {
  const wallet = await ensureWallet(userId);
  return { id: wallet.id, availableCredits: wallet.availableCredits, reservedCredits: wallet.reservedCredits };
}

export async function grantTopupCredits(input: { userId: string; paymentOrderId: string; credits: number; idempotencyKey: string }, session?: ClientSession) {
  if (!Number.isSafeInteger(input.credits) || input.credits <= 0) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Số credit nạp phải là số nguyên dương.' });
  return inTransaction(session, async (active) => {
    const duplicate = await idempotentWallet(input.userId, input.idempotencyKey, active);
    if (duplicate) return duplicate;
    const current = await ensureWallet(input.userId, active);
    const wallet = await CreditWallet.findOneAndUpdate({ _id: current._id }, { $inc: { availableCredits: input.credits, version: 1 } }, { session: active, returnDocument: 'after' });
    if (!wallet) throw new AppError({ status: 500, code: ERROR_CODES.INTERNAL, message: 'Không thể cộng credit vào ví.' });
    await appendLedger({ userId: input.userId, walletId: wallet.id, type: 'TOPUP', availableDelta: input.credits, reservedDelta: 0, availableAfter: wallet.availableCredits, reservedAfter: wallet.reservedCredits, referenceType: 'PAYMENT_ORDER', referenceId: input.paymentOrderId, idempotencyKey: input.idempotencyKey, reason: 'Nạp credit từ đơn thanh toán.' }, active);
    return wallet;
  });
}

export async function reserveCredits(input: { userId: string; usageId: string; credits: number; idempotencyKey: string }, session?: ClientSession) {
  if (!Number.isSafeInteger(input.credits) || input.credits <= 0) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Số credit tạm giữ phải là số nguyên dương.' });
  return inTransaction(session, async (active) => {
    const duplicate = await idempotentWallet(input.userId, input.idempotencyKey, active);
    if (duplicate) return duplicate;
    const wallet = await CreditWallet.findOneAndUpdate(
      { userId: objectId(input.userId), availableCredits: { $gte: input.credits } },
      { $inc: { availableCredits: -input.credits, reservedCredits: input.credits, version: 1 } },
      { session: active, returnDocument: 'after' },
    );
    if (!wallet) throw new AppError({ status: 402, code: ERROR_CODES.INSUFFICIENT_CREDITS, message: 'Số dư credit không đủ. Vui lòng nạp thêm credit.' });
    await appendLedger({ userId: input.userId, walletId: wallet.id, type: 'RESERVE', availableDelta: -input.credits, reservedDelta: input.credits, availableAfter: wallet.availableCredits, reservedAfter: wallet.reservedCredits, referenceType: 'AI_USAGE', referenceId: input.usageId, idempotencyKey: input.idempotencyKey, reason: 'Tạm giữ credit cho tác vụ AI.' }, active);
    return wallet;
  });
}

export async function releaseCredits(input: { userId: string; usageId: string; credits: number; idempotencyKey: string }, session?: ClientSession) {
  if (!Number.isSafeInteger(input.credits) || input.credits <= 0) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Số credit hoàn phải là số nguyên dương.' });
  return inTransaction(session, async (active) => {
    const duplicate = await idempotentWallet(input.userId, input.idempotencyKey, active);
    if (duplicate) return duplicate;
    const wallet = await CreditWallet.findOneAndUpdate(
      { userId: objectId(input.userId), reservedCredits: { $gte: input.credits } },
      { $inc: { availableCredits: input.credits, reservedCredits: -input.credits, version: 1 } },
      { session: active, returnDocument: 'after' },
    );
    if (!wallet) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Reservation không còn đủ credit để hoàn.' });
    await appendLedger({ userId: input.userId, walletId: wallet.id, type: 'RELEASE', availableDelta: input.credits, reservedDelta: -input.credits, availableAfter: wallet.availableCredits, reservedAfter: wallet.reservedCredits, referenceType: 'AI_USAGE', referenceId: input.usageId, idempotencyKey: input.idempotencyKey, reason: 'Hoàn credit đã tạm giữ.' }, active);
    return wallet;
  });
}

export async function settleCredits(input: { userId: string; usageId: string; reservedCredits: number; settledCredits: number }, session?: ClientSession): Promise<{ wallet: WalletDocument; billingShortfall: number }> {
  if (![input.reservedCredits, input.settledCredits].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Credit quyết toán không hợp lệ.' });
  return inTransaction(session, async (active) => {
    const settleKey = `settle:${input.usageId}`;
    const duplicate = await idempotentWallet(input.userId, settleKey, active);
    if (duplicate) return { wallet: duplicate, billingShortfall: 0 };
    const current = await CreditWallet.findOne({ userId: objectId(input.userId) }).session(active);
    if (!current || current.reservedCredits < input.reservedCredits) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Reservation không hợp lệ để quyết toán.' });

    const covered = Math.min(input.reservedCredits, input.settledCredits);
    const extraDue = Math.max(0, input.settledCredits - input.reservedCredits);
    const extraCharged = Math.min(current.availableCredits, extraDue);
    const billingShortfall = extraDue - extraCharged;
    const release = input.reservedCredits - covered;
    const settled = await CreditWallet.findOneAndUpdate(
      { _id: current._id, availableCredits: { $gte: extraCharged }, reservedCredits: { $gte: covered } },
      { $inc: { availableCredits: -extraCharged, reservedCredits: -covered, version: 1 } },
      { session: active, returnDocument: 'after' },
    );
    if (!settled) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Ví đã thay đổi trong lúc quyết toán.' });
    await appendLedger({ userId: input.userId, walletId: settled.id, type: 'SETTLE', availableDelta: -extraCharged, reservedDelta: -covered, availableAfter: settled.availableCredits, reservedAfter: settled.reservedCredits, referenceType: 'AI_USAGE', referenceId: input.usageId, idempotencyKey: settleKey, reason: billingShortfall ? 'Quyết toán tác vụ AI có thiếu hụt.' : 'Quyết toán tác vụ AI.' }, active);
    if (release === 0) return { wallet: settled, billingShortfall };

    const released = await CreditWallet.findOneAndUpdate({ _id: current._id, reservedCredits: { $gte: release } }, { $inc: { availableCredits: release, reservedCredits: -release, version: 1 } }, { session: active, returnDocument: 'after' });
    if (!released) throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Không thể trả phần credit tạm giữ dư.' });
    await appendLedger({ userId: input.userId, walletId: released.id, type: 'RELEASE', availableDelta: release, reservedDelta: -release, availableAfter: released.availableCredits, reservedAfter: released.reservedCredits, referenceType: 'AI_USAGE', referenceId: input.usageId, idempotencyKey: `release:${input.usageId}`, reason: 'Trả phần credit tạm giữ dư sau quyết toán.' }, active);
    return { wallet: released, billingShortfall };
  });
}

export async function adjustCredits(input: { userId: string; actorUserId: string; credits: number; reason: string; idempotencyKey: string }, session?: ClientSession) {
  const reason = input.reason.trim();
  if (!reason) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Điều chỉnh credit bắt buộc có lý do.' });
  if (!Number.isSafeInteger(input.credits) || input.credits === 0) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Số credit điều chỉnh phải là số nguyên khác 0.' });
  return inTransaction(session, async (active) => {
    const duplicate = await idempotentWallet(input.userId, input.idempotencyKey, active);
    if (duplicate) return duplicate;
    await ensureWallet(input.userId, active);
    const wallet = await CreditWallet.findOneAndUpdate(
      { userId: objectId(input.userId), ...(input.credits < 0 ? { availableCredits: { $gte: -input.credits } } : {}) },
      { $inc: { availableCredits: input.credits, version: 1 } },
      { session: active, returnDocument: 'after' },
    );
    if (!wallet) throw new AppError({ status: 402, code: ERROR_CODES.INSUFFICIENT_CREDITS, message: 'Số dư credit không đủ để điều chỉnh giảm.' });
    await appendLedger({ userId: input.userId, walletId: wallet.id, type: 'ADJUSTMENT', availableDelta: input.credits, reservedDelta: 0, availableAfter: wallet.availableCredits, reservedAfter: wallet.reservedCredits, referenceType: 'ADMIN_ADJUSTMENT', referenceId: input.idempotencyKey, idempotencyKey: input.idempotencyKey, reason, actorUserId: input.actorUserId }, active);
    return wallet;
  });
}

export async function listLedger(userId: string, query: { page?: unknown; limit?: unknown; type?: unknown }) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const filter: Record<string, unknown> = { userId: objectId(userId) };
  if (String(query.type) === 'USAGE') {
    filter.type = { $in: ['SETTLE', 'RESERVE'] };
  } else if (['TOPUP', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT'].includes(String(query.type))) {
    filter.type = query.type;
  }
  const [items, total] = await Promise.all([CreditLedgerEntry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), CreditLedgerEntry.countDocuments(filter)]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
