import AiGlobalBudgetCounter from '../models/AiGlobalBudgetCounter.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { ClientSession } from 'mongoose';
import { logger } from '../config/logger.js';

export function vndCostFromMicrousd(providerCostMicrousd: number | undefined, usdToVnd: number, reservedVnd: number) {
  // When a provider omits cost metadata, charge the full conservative reserve.
  if (providerCostMicrousd === undefined) return reservedVnd;
  const amount = Number((BigInt(providerCostMicrousd) * BigInt(usdToVnd) + 999_999n) / 1_000_000n);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('AI provider cost cannot be represented as VND.');
  return amount;
}

export async function prepareGlobalAiBudgetMonth(monthKey: string) {
  try {
    await AiGlobalBudgetCounter.updateOne({ monthKey }, { $setOnInsert: { spentVnd: 0, reservedVnd: 0 } }, { upsert: true });
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) throw error;
  }
}

export async function reserveGlobalAiBudget(monthKey: string, reserveVnd: number, limitVnd: number, session: ClientSession) {
  const result = await AiGlobalBudgetCounter.updateOne({
    monthKey,
    $expr: { $lte: [{ $add: ['$spentVnd', '$reservedVnd', reserveVnd] }, limitVnd] },
  }, { $inc: { reservedVnd: reserveVnd } }, { session });
  if (result.modifiedCount !== 1) {
    throw new AppError({
      status: 429, code: ERROR_CODES.AI_USAGE_LIMIT_EXCEEDED,
      message: 'Ngân sách AI do công ty chi trả đã đạt giới hạn tháng này. Các chức năng không dùng AI vẫn hoạt động.',
      details: { period: 'MONTH', resetAt: nextMonthStart().toISOString() },
    });
  }
  const counter = await AiGlobalBudgetCounter.findOne({ monthKey }).session(session).lean();
  if (counter && counter.spentVnd + counter.reservedVnd >= Math.ceil(limitVnd * 0.8) && !counter.alertedAt) {
    const alert = await AiGlobalBudgetCounter.updateOne({ _id: counter._id, alertedAt: { $exists: false } }, { $set: { alertedAt: new Date() } }, { session });
    if (alert.modifiedCount === 1) logger.warn({ monthKey, spentVnd: counter.spentVnd, reservedVnd: counter.reservedVnd, limitVnd }, 'Company-paid AI budget reached 80%');
  }
}

export async function settleGlobalAiBudget(monthKey: string, reserveVnd: number, actualVnd: number, session: ClientSession) {
  const result = await AiGlobalBudgetCounter.updateOne({ monthKey, reservedVnd: { $gte: reserveVnd } }, {
    $inc: { reservedVnd: -reserveVnd, spentVnd: actualVnd },
  }, { session });
  if (result.modifiedCount !== 1) throw new Error('Global AI budget reservation could not be settled.');
}

export async function releaseGlobalAiBudget(monthKey: string, reserveVnd: number, session: ClientSession) {
  const result = await AiGlobalBudgetCounter.updateOne({ monthKey, reservedVnd: { $gte: reserveVnd } }, {
    $inc: { reservedVnd: -reserveVnd },
  }, { session });
  if (result.modifiedCount !== 1) throw new Error('Global AI budget reservation could not be released.');
}

function nextMonthStart() {
  const local = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - 7 * 60 * 60 * 1000);
}
