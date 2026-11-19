import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { Types, type Model } from 'mongoose';
import { ERROR_CODES } from '../errors/errorCodes.js';
import AiBillingPolicy from '../models/AiBillingPolicy.js';
import AiUsage from '../models/AiUsage.js';
import CreditLedgerEntry from '../models/CreditLedgerEntry.js';
import CreditPackage from '../models/CreditPackage.js';
import CreditPricing from '../models/CreditPricing.js';
import PaymentOrder from '../models/PaymentOrder.js';
import type { AuthenticatedUser } from '../types/express.js';
import { recordAudit } from './auditService.js';
import { adjustCredits } from './creditWalletService.js';
import { AI_TASK_TYPES, type AiTaskType } from './creditTypes.js';
import { withTransaction } from './transactionService.js';

interface PolicyInput { taskType: AiTaskType; enabled: boolean; maxReservationCredits: number; fallbackCredits: number; markupBasisPoints: number; minBillableCredits: number }
interface ListQuery { page?: unknown; limit?: unknown; status?: unknown; gateway?: unknown; taskType?: unknown; userId?: unknown; type?: unknown }
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
const packageView = (item: { _id: unknown; name: string; description: string; amountVnd: number; baseCredits: number; bonusCredits: number; active: boolean; sortOrder: number }) => ({ id: String(item._id), name: item.name, description: item.description, amountVnd: item.amountVnd, baseCredits: item.baseCredits, bonusCredits: item.bonusCredits, active: item.active, sortOrder: item.sortOrder });

export async function getPricing() {
  const [pricing, policies] = await Promise.all([CreditPricing.findOne({ key: 'GLOBAL' }).lean(), AiBillingPolicy.find().sort({ taskType: 1 }).lean()]);
  if (!pricing) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Chưa cấu hình quy đổi credit.' });
  return { vndPerCredit: pricing.vndPerCredit, usdToVnd: pricing.usdToVnd, policies };
}
export async function updatePricing(actor: AuthenticatedUser, input: { vndPerCredit: number; usdToVnd: number; policies: PolicyInput[] }) {
  if (new Set(input.policies.map((item) => item.taskType)).size !== AI_TASK_TYPES.length || AI_TASK_TYPES.some((type) => !input.policies.some((item) => item.taskType === type))) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Phải cung cấp đúng một policy cho mỗi loại tác vụ AI.' });
  await withTransaction(async (session) => {
    await CreditPricing.updateOne({ key: 'GLOBAL' }, { $set: { vndPerCredit: input.vndPerCredit, usdToVnd: input.usdToVnd, updatedById: actor.id } }, { upsert: true, session });
    for (const policy of input.policies) await AiBillingPolicy.updateOne({ taskType: policy.taskType }, { $set: { ...policy, updatedById: actor.id } }, { upsert: true, session });
    await recordAudit({ actor, action: 'CREDIT_PRICING_UPDATED', resourceType: 'creditPricing', resourceId: 'GLOBAL', metadata: { version: 1 } }, session);
  });
  return getPricing();
}
async function baseCredits(amountVnd: number) { const pricing = await CreditPricing.findOne({ key: 'GLOBAL' }).lean(); if (!pricing) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Chưa cấu hình quy đổi credit.' }); return Math.floor(amountVnd / pricing.vndPerCredit); }
export async function listPackages() { return (await CreditPackage.find().sort({ sortOrder: 1, amountVnd: 1 }).lean()).map(packageView); }
export async function createPackage(actor: AuthenticatedUser, input: { name: string; description?: string; amountVnd: number; bonusCredits: number; active: boolean; sortOrder: number }) {
  const item = await CreditPackage.create({ ...input, description: input.description || '', baseCredits: await baseCredits(input.amountVnd), updatedById: actor.id });
  await recordAudit({ actor, action: 'CREDIT_PACKAGE_CREATED', resourceType: 'creditPackage', resourceId: item.id, metadata: { amountVnd: item.amountVnd } }); return packageView(item);
}
export async function updatePackage(actor: AuthenticatedUser, id: string, input: Partial<{ name: string; description: string; amountVnd: number; bonusCredits: number; active: boolean; sortOrder: number }>) {
  const item = await CreditPackage.findById(id); if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy gói credit.' });
  for (const key of ['name', 'description', 'amountVnd', 'bonusCredits', 'active', 'sortOrder'] as const) if (input[key] !== undefined) item.set(key, input[key]);
  item.baseCredits = await baseCredits(item.amountVnd); item.updatedById = new Types.ObjectId(actor.id); await item.save();
  await recordAudit({ actor, action: 'CREDIT_PACKAGE_UPDATED', resourceType: 'creditPackage', resourceId: item.id, metadata: { amountVnd: item.amountVnd } }); return packageView(item);
}
export async function deletePackage(actor: AuthenticatedUser, id: string) { const item = await CreditPackage.findByIdAndDelete(id); if (!item) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy gói credit.' }); await recordAudit({ actor, action: 'CREDIT_PACKAGE_DELETED', resourceType: 'creditPackage', resourceId: id, metadata: { amountVnd: item.amountVnd } }); }
export async function createAdjustment(actor: AuthenticatedUser, input: { userId: string; credits: number; reason: string }, requestKey: string) {
  const uniqueKey = `admin-adjustment:${input.userId}:${Date.now()}:${randomUUID()}`;
  return withTransaction(async (session) => {
    const wallet = await adjustCredits(
      {
        userId: input.userId,
        actorUserId: actor.id,
        credits: input.credits,
        reason: input.reason,
        idempotencyKey: uniqueKey,
      },
      session,
    );
    await recordAudit(
      {
        actor,
        action: 'CREDIT_ADJUSTED',
        resourceType: 'creditWallet',
        resourceId: wallet.id,
        metadata: { credits: input.credits, reasonCode: 'MANUAL', requestKey },
      },
      session,
    );
    return {
      id: wallet.id,
      availableCredits: wallet.availableCredits,
      reservedCredits: wallet.reservedCredits,
    };
  });
}
async function listModel(Model: Model<unknown>, query: ListQuery, fixed: Record<string, unknown> = {}) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 20); const filter: Record<string, unknown> = { ...fixed };
  for (const key of ['status', 'gateway', 'taskType', 'userId', 'type'] as const) if (query[key] !== undefined && !(key in fixed)) filter[key] = query[key];
  const queryChain = Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  if ('schema' in Model && (Model as { schema?: { path?: (k: string) => unknown } }).schema?.path?.('userId')) {
    (queryChain as unknown as { populate: (k: string, f: string) => void }).populate('userId', 'fullName username phone email role');
  }
  if ('schema' in Model && (Model as { schema?: { path?: (k: string) => unknown } }).schema?.path?.('actorUserId')) {
    (queryChain as unknown as { populate: (k: string, f: string) => void }).populate('actorUserId', 'fullName username phone email role');
  }
  const [items, total] = await Promise.all([queryChain.lean(), Model.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export const listPaymentOrders = (query: ListQuery) => listModel(PaymentOrder as unknown as Model<unknown>, query);
export const listAiUsage = (query: ListQuery) => listModel(AiUsage as unknown as Model<unknown>, query);
export const listCreditLedger = (query: ListQuery) => listModel(CreditLedgerEntry as unknown as Model<unknown>, query);
export const listShortfalls = (query: ListQuery) => listModel(AiUsage as unknown as Model<unknown>, query, { status: 'BILLING_SHORTFALL' });
