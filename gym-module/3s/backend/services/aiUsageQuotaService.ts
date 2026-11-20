import mongoose, { type ClientSession } from 'mongoose';
import { APP_POLICY, getEnv } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import AiUsageQuotaCounter from '../models/AiUsageQuotaCounter.js';
import { requireCenterId } from '../tenancy/centerContext.js';

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1_000;

interface PeriodKey {
  dayKey: string;
  monthKey: string;
}

interface CounterFilter {
  scope: 'USER' | 'CENTER';
  userId?: mongoose.Types.ObjectId;
  periodType: 'DAY' | 'MONTH';
  periodKey: string;
}

interface ReservedCounter {
  filter: CounterFilter;
  limit: number;
  resetAt: Date;
}

export interface AiUsageQuotaPlan {
  periodKeys: PeriodKey;
  counters: ReservedCounter[];
}

function localDateParts(date: Date) {
  const local = new Date(date.getTime() + VIETNAM_OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
  };
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function getPeriodKeys(date: Date): PeriodKey {
  const { year, month, day } = localDateParts(date);
  return {
    dayKey: `${year}-${pad(month)}-${pad(day)}`,
    monthKey: `${year}-${pad(month)}`,
  };
}

function nextDayReset(date: Date) {
  const { year, month, day } = localDateParts(date);
  return new Date(Date.UTC(year, month - 1, day + 1) - VIETNAM_OFFSET_MS);
}

function nextMonthReset(date: Date) {
  const { year, month } = localDateParts(date);
  return new Date(Date.UTC(year, month, 1) - VIETNAM_OFFSET_MS);
}

function describeReset(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function limitError(counter: ReservedCounter): AppError {
  const resetAt = describeReset(counter.resetAt);
  const scopeMessage = counter.filter.scope === 'CENTER'
    ? 'Phòng gym đã đạt giới hạn sử dụng AI trong tháng này.'
    : counter.filter.periodType === 'DAY'
      ? 'Bạn đã đạt giới hạn sử dụng AI trong hôm nay.'
      : 'Bạn đã đạt giới hạn sử dụng AI trong tháng này.';
  return new AppError({
    status: 429,
    code: ERROR_CODES.AI_USAGE_LIMIT_EXCEEDED,
    message: `${scopeMessage} Hạn mức sẽ được làm mới lúc ${resetAt}.`,
    details: { resetAt: counter.resetAt.toISOString(), period: counter.filter.periodType },
  });
}

function createCounterFilter(scope: 'USER' | 'CENTER', periodType: 'DAY' | 'MONTH', periodKey: string, userId?: string): CounterFilter {
  return {
    scope,
    ...(userId ? { userId: new mongoose.Types.ObjectId(userId) } : {}),
    periodType,
    periodKey,
  };
}

export function makeAiUsageQuotaPlan(userId: string, date = new Date()): AiUsageQuotaPlan {
  const centerId = requireCenterId('AiUsageQuotaCounter');
  const env = getEnv();
  const periodKeys = getPeriodKeys(date);
  const dayResetAt = nextDayReset(date);
  const monthResetAt = nextMonthReset(date);
  const counters: ReservedCounter[] = [
    {
      filter: createCounterFilter('USER', 'DAY', periodKeys.dayKey, userId),
      limit: env.AI_COMPANY_PAID_DAILY_CALLS_PER_USER ?? APP_POLICY.AI_COMPANY_PAID_DAILY_CALLS_PER_USER,
      resetAt: dayResetAt,
    },
    {
      filter: createCounterFilter('USER', 'MONTH', periodKeys.monthKey, userId),
      limit: env.AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER ?? APP_POLICY.AI_COMPANY_PAID_MONTHLY_CALLS_PER_USER,
      resetAt: monthResetAt,
    },
    {
      filter: createCounterFilter('CENTER', 'MONTH', periodKeys.monthKey),
      limit: env.AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER ?? APP_POLICY.AI_COMPANY_PAID_MONTHLY_CALLS_PER_CENTER,
      resetAt: monthResetAt,
    },
  ];
  // Keep centerId lookup explicit so callers fail closed if they ever run outside an authenticated tenant.
  if (!centerId) throw new Error('A center is required to apply the AI usage limit.');
  return { periodKeys, counters };
}

export async function prepareAiUsageQuotaCounters(plan: AiUsageQuotaPlan) {
  for (const { filter } of plan.counters) {
    try {
      await AiUsageQuotaCounter.updateOne(
        filter,
        { $setOnInsert: { usedRequests: 0, reservedRequests: 0, providerCostMicrousd: 0 } },
        { upsert: true },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Another request created this period's counter at the same time.
    }
  }
}

export async function reserveAiUsageQuotaCounters(plan: AiUsageQuotaPlan, session: ClientSession) {
  if (!session.inTransaction()) throw new Error('AI quota reservation requires a transaction.');
  for (const counter of plan.counters) {
    const updated = await AiUsageQuotaCounter.findOneAndUpdate(
      {
        ...counter.filter,
        $expr: { $lt: [{ $add: ['$usedRequests', '$reservedRequests'] }, counter.limit] },
      },
      { $inc: { reservedRequests: 1 } },
      { session, returnDocument: 'after' },
    );
    if (!updated) throw limitError(counter);
  }
}

export async function settleAiUsageQuotaCounters(plan: AiUsageQuotaPlan, providerCostMicrousd: number, session: ClientSession) {
  for (const { filter } of plan.counters) {
    const result = await AiUsageQuotaCounter.updateOne(
      { ...filter, reservedRequests: { $gte: 1 } },
      { $inc: { reservedRequests: -1, usedRequests: 1, providerCostMicrousd } },
      { session },
    );
    if (result.modifiedCount !== 1) throw new Error('AI usage quota reservation could not be settled.');
  }
}

export async function releaseAiUsageQuotaCounters(plan: AiUsageQuotaPlan, session: ClientSession) {
  for (const { filter } of plan.counters) {
    const result = await AiUsageQuotaCounter.updateOne(
      { ...filter, reservedRequests: { $gte: 1 } },
      { $inc: { reservedRequests: -1 } },
      { session },
    );
    if (result.modifiedCount !== 1) throw new Error('AI usage quota reservation could not be released.');
  }
}

function isDuplicateKey(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
