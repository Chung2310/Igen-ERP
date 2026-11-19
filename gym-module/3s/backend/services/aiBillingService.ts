import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import AiUsage from '../models/AiUsage.js';
import { calculateSettledCredits, getPricingSnapshot } from './creditPricingService.js';
import type { AiBillingContext, ProviderResult, ProviderUsage } from './creditTypes.js';
import { ensureWallet, releaseCredits, reserveCredits, settleCredits } from './creditWalletService.js';
import { withRequiredTransaction as withTransaction } from './transactionService.js';
import { invokeWithAiLease, newAiLease } from './aiReservationRecoveryService.js';
import { recordUserAudit } from './auditService.js';
import { getClientType } from '../tenancy/clientTypeContext.js';
import { getEnv } from '../config/env.js';
import { prepareGlobalAiBudgetMonth, reserveGlobalAiBudget, releaseGlobalAiBudget, settleGlobalAiBudget, vndCostFromMicrousd } from './aiGlobalBudgetService.js';
import {
  makeAiUsageQuotaPlan,
  prepareAiUsageQuotaCounters,
  releaseAiUsageQuotaCounters,
  reserveAiUsageQuotaCounters,
  settleAiUsageQuotaCounters,
} from './aiUsageQuotaService.js';

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
  if (error instanceof AppError) return error.code.slice(0, 100);
  return 'PROVIDER_ERROR';
}

export async function withAiBilling<T>(context: AiBillingContext, invoke: () => Promise<ProviderResult<T>>): Promise<T> {
  const pricingSnapshot = await getPricingSnapshot(context.taskType);
  const billingMode = context.billingMode || (getClientType() === 'MOBILE' ? 'COMPANY_PAID' : 'WALLET');
  if (billingMode === 'COMPANY_PAID') {
    const quotaPlan = makeAiUsageQuotaPlan(context.userId);
    const env = getEnv();
    const globalBudgetMonthKey = quotaPlan.periodKeys.monthKey;
    const reservedProviderCostVnd = env.AI_GLOBAL_MAX_RESERVATION_VND;
    await prepareGlobalAiBudgetMonth(globalBudgetMonthKey);
    await prepareAiUsageQuotaCounters(quotaPlan);
    let usageId: string;
    try {
      usageId = await withTransaction(async (session) => {
        if (await AiUsage.exists({ requestKey: context.requestKey }).session(session)) throw duplicateRequest();
        await reserveGlobalAiBudget(globalBudgetMonthKey, reservedProviderCostVnd, env.AI_GLOBAL_MONTHLY_BUDGET_VND, session);
        await reserveAiUsageQuotaCounters(quotaPlan, session);
        const wallet = await ensureWallet(context.userId, session);
        const [usage] = await AiUsage.create([{
          userId: context.userId, walletId: wallet._id, taskType: context.taskType,
          billingMode, provider: 'pending', model: 'pending', status: 'RESERVED', requestKey: context.requestKey,
          reservedCredits: 0, settledCredits: 0, releasedCredits: 0, billingShortfall: 0, pricingSnapshot,
          quotaPeriodKeys: quotaPlan.periodKeys,
          globalBudgetMonthKey, reservedProviderCostVnd,
          leaseExpiresAt: newAiLease(),
        }], { session });
        return usage.id;
      });
    } catch (error) {
      if (isDuplicateKey(error)) throw duplicateRequest();
      throw error;
    }

    try {
      const providerResult = await invokeWithAiLease(usageId, invoke);
      validateResult<T>(providerResult);
      const actualProviderCostVnd = vndCostFromMicrousd(providerResult.usage.providerCostMicrousd, pricingSnapshot.usdToVnd, reservedProviderCostVnd);
      await withTransaction(async (session) => {
        const usage = await AiUsage.findOne({ _id: usageId, status: 'RESERVED', billingMode: 'COMPANY_PAID' }).session(session);
        if (!usage) throw duplicateRequest();
        await settleAiUsageQuotaCounters(quotaPlan, providerResult.usage.providerCostMicrousd || 0, session);
        await settleGlobalAiBudget(globalBudgetMonthKey, reservedProviderCostVnd, actualProviderCostVnd, session);
        await AiUsage.updateOne({ _id: usage._id, status: 'RESERVED' }, { $set: {
          provider: providerResult.provider.trim(), model: providerResult.model.trim(), status: 'SUCCEEDED',
          inputTokens: providerResult.usage.inputTokens, outputTokens: providerResult.usage.outputTokens,
          totalTokens: providerResult.usage.totalTokens, providerCostMicrousd: providerResult.usage.providerCostMicrousd,
        } }, { session });
      });
      return providerResult.value;
    } catch (error) {
      await withTransaction(async (session) => {
        const usage = await AiUsage.findOne({ _id: usageId, status: 'RESERVED', billingMode: 'COMPANY_PAID' }).session(session);
        if (!usage) return;
        await releaseAiUsageQuotaCounters(quotaPlan, session);
        await releaseGlobalAiBudget(globalBudgetMonthKey, reservedProviderCostVnd, session);
        await AiUsage.updateOne({ _id: usageId, status: 'RESERVED', billingMode: 'COMPANY_PAID' }, { $set: {
          status: 'FAILED', failureCode: failureCode(error),
        } }, { session });
      });
      throw error;
    }
  }

  let usageId: string;
  try {
    usageId = await withTransaction(async (session) => {
      if (await AiUsage.exists({ requestKey: context.requestKey }).session(session)) throw duplicateRequest();
      const wallet = await ensureWallet(context.userId, session);
      const [usage] = await AiUsage.create([{
        userId: context.userId, walletId: wallet._id, taskType: context.taskType,
        billingMode,
        provider: 'pending', model: 'pending', status: 'RESERVED', requestKey: context.requestKey,
        reservedCredits: pricingSnapshot.maxReservationCredits, settledCredits: 0, releasedCredits: 0,
        billingShortfall: 0, pricingSnapshot,
        leaseExpiresAt: newAiLease(),
      }], { session });
      await reserveCredits({
        userId: context.userId, usageId: usage.id, credits: pricingSnapshot.maxReservationCredits,
        idempotencyKey: `reserve:${context.requestKey}`,
      }, session);
      return usage.id;
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateRequest();
    throw error;
  }

  try {
    const providerResult = await invokeWithAiLease(usageId, invoke);
    validateResult<T>(providerResult);
    const settledCredits = calculateSettledCredits(providerResult.usage, pricingSnapshot);
    await withTransaction(async (session) => {
      const usage = await AiUsage.findOne({ _id: usageId, status: 'RESERVED' }).session(session);
      if (!usage) throw duplicateRequest();
      const settlement = await settleCredits({
        userId: context.userId, usageId, reservedCredits: usage.reservedCredits, settledCredits,
      }, session);
      await AiUsage.updateOne({ _id: usage._id, status: 'RESERVED' }, { $set: {
        provider: providerResult.provider.trim(), model: providerResult.model.trim(),
        status: settlement.billingShortfall > 0 ? 'BILLING_SHORTFALL' : 'SUCCEEDED',
        settledCredits, releasedCredits: Math.max(0, usage.reservedCredits - settledCredits),
        billingShortfall: settlement.billingShortfall,
        inputTokens: providerResult.usage.inputTokens, outputTokens: providerResult.usage.outputTokens,
        totalTokens: providerResult.usage.totalTokens, providerCostMicrousd: providerResult.usage.providerCostMicrousd,
      } }, { session });
      if (settlement.billingShortfall > 0) {
        await recordUserAudit(context.userId, {
          action: 'AI_BILLING_SHORTFALL', resourceType: 'ai_usage', resourceId: usage.id,
          metadata: { taskType: context.taskType, billingShortfall: settlement.billingShortfall },
        }, session);
      }
    });
    return providerResult.value;
  } catch (error) {
    await withTransaction(async (session) => {
      const usage = await AiUsage.findOne({ _id: usageId, status: 'RESERVED' }).session(session);
      if (!usage) return;
      await releaseCredits({
        userId: context.userId, usageId, credits: usage.reservedCredits,
        idempotencyKey: `release:${usageId}`,
      }, session);
      usage.status = 'FAILED'; usage.releasedCredits = usage.reservedCredits;
      usage.failureCode = failureCode(error); await usage.save({ session });
    });
    throw error;
  }
}
