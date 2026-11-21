import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import AiUsage from '../models/AiUsage.js';
import { calculateSettledCredits, getPricingSnapshot } from './creditPricingService.js';
import type { AiBillingContext, ProviderResult, ProviderUsage } from './creditTypes.js';
import { withRequiredTransaction } from './transactionService.js';
import { invokeWithAiLease, newAiLease } from './aiReservationRecoveryService.js';
import { recordUserAudit } from './auditService.js';
import { erpCreditOperation } from './erpCreditService.js';

function duplicateRequest(): AppError {
  return new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: 'Request AI này đã được xử lý trước đó.' });
}

function invalidProviderResult(): AppError {
  return new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI provider trả về metadata sử dụng không hợp lệ.' });
}

function isDuplicateKey(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function validateUsage(usage: unknown): asserts usage is ProviderUsage {
  if (!usage || typeof usage !== 'object') throw invalidProviderResult();
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'providerCostMicrousd'] as const) {
    const value = (usage as ProviderUsage)[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw invalidProviderResult();
  }
}

function validateResult<T>(result: unknown): asserts result is ProviderResult<T> {
  if (!result || typeof result !== 'object') throw invalidProviderResult();
  const candidate = result as Partial<ProviderResult<T>>;
  if (typeof candidate.provider !== 'string' || !candidate.provider.trim() || typeof candidate.model !== 'string' || !candidate.model.trim()) throw invalidProviderResult();
  validateUsage(candidate.usage);
}

function failureCode(error: unknown) {
  return error instanceof AppError ? error.code.slice(0, 100) : 'PROVIDER_ERROR';
}

/** Gym keeps only an AI usage record; ERP owns every Credit balance and movement. */
export async function withAiBilling<T>(context: AiBillingContext, invoke: () => Promise<ProviderResult<T>>): Promise<T> {
  const pricingSnapshot = await getPricingSnapshot(context.taskType);
  let usageId: string;
  try {
    usageId = await withRequiredTransaction(async (session) => {
      if (await AiUsage.exists({ requestKey: context.requestKey }).session(session)) throw duplicateRequest();
      const [usage] = await AiUsage.create([{
        userId: context.userId,
        taskType: context.taskType,
        billingMode: 'WALLET',
        provider: 'pending',
        model: 'pending',
        status: 'RESERVED',
        requestKey: context.requestKey,
        reservedCredits: pricingSnapshot.maxReservationCredits,
        settledCredits: 0,
        releasedCredits: 0,
        billingShortfall: 0,
        pricingSnapshot,
        leaseExpiresAt: newAiLease(),
      }], { session });
      return usage.id;
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateRequest();
    throw error;
  }

  const key = `gym:${usageId}`;
  try {
    await erpCreditOperation(context.userId, 'reserve', key, pricingSnapshot.maxReservationCredits);
  } catch (error) {
    let released = false;
    try { await erpCreditOperation(context.userId, 'release', key, 0); released = true; } catch { /* Recovery retries. */ }
    if (released) await AiUsage.updateOne({ _id: usageId, status: 'RESERVED' }, { $set: { status: 'FAILED', failureCode: failureCode(error) } });
    throw error;
  }

  let erpSettled = false;
  try {
    const providerResult = await invokeWithAiLease(usageId, invoke);
    validateResult<T>(providerResult);
    const settledCredits = calculateSettledCredits(providerResult.usage, pricingSnapshot);
    await withRequiredTransaction(async (session) => {
      const usage = await AiUsage.findOne({ _id: usageId, status: 'RESERVED' }).session(session);
      if (!usage) throw duplicateRequest();
      const settlement = await erpCreditOperation(context.userId, 'settle', key, settledCredits);
      erpSettled = true;
      const billingShortfall = settlement.billingShortfall || 0;
      await AiUsage.updateOne({ _id: usage._id, status: 'RESERVED' }, { $set: {
        provider: providerResult.provider.trim(), model: providerResult.model.trim(),
        status: billingShortfall > 0 ? 'BILLING_SHORTFALL' : 'SUCCEEDED',
        settledCredits, releasedCredits: Math.max(0, usage.reservedCredits - settledCredits),
        billingShortfall,
        inputTokens: providerResult.usage.inputTokens, outputTokens: providerResult.usage.outputTokens,
        totalTokens: providerResult.usage.totalTokens, providerCostMicrousd: providerResult.usage.providerCostMicrousd,
      } }, { session });
      if (billingShortfall > 0) {
        await recordUserAudit(context.userId, {
          action: 'AI_BILLING_SHORTFALL', resourceType: 'ai_usage', resourceId: usage.id,
          metadata: { taskType: context.taskType, billingShortfall },
        }, session);
      }
    });
    return providerResult.value;
  } catch (error) {
    if (erpSettled) throw error;
    await withRequiredTransaction(async (session) => {
      const usage = await AiUsage.findOne({ _id: usageId, status: 'RESERVED' }).session(session);
      if (!usage) return;
      const result = await erpCreditOperation(context.userId, 'release', key, 0);
      if (result.status === 'SETTLED') return;
      usage.status = 'FAILED';
      usage.releasedCredits = usage.reservedCredits;
      usage.failureCode = failureCode(error);
      await usage.save({ session });
    });
    throw error;
  }
}
