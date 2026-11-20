import AiGlobalBudgetCounter from '../models/AiGlobalBudgetCounter.js';
import AiUsage from '../models/AiUsage.js';
import { logger } from '../config/logger.js';
import { getEnv } from '../config/env.js';

export async function upAiCompanyGlobalBudget({ dryRun }: { dryRun: boolean }) {
  const now = new Date();
  const vietnamMonth = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const year = vietnamMonth.getUTCFullYear();
  const month = vietnamMonth.getUTCMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthStart = new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000);
  const usage = await AiUsage.aggregate<{ spentVnd: number; calls: number }>([
    { $match: { billingMode: 'COMPANY_PAID', status: { $in: ['SUCCEEDED', 'BILLING_SHORTFALL'] }, createdAt: { $gte: monthStart, $lte: now } } },
    { $group: { _id: null, calls: { $sum: 1 }, spentVnd: { $sum: { $cond: [
      { $eq: [{ $type: '$providerCostMicrousd' }, 'missing'] },
      { $ifNull: ['$reservedProviderCostVnd', getEnv().AI_GLOBAL_MAX_RESERVATION_VND] },
      { $ceil: { $divide: [{ $multiply: ['$providerCostMicrousd', '$pricingSnapshot.usdToVnd'] }, 1_000_000] } },
    ] } } } },
  ]);
  const currentMonthSpentVnd = usage[0]?.spentVnd || 0;
  if (!dryRun) {
    await AiGlobalBudgetCounter.createIndexes();
    await AiGlobalBudgetCounter.updateOne({ monthKey }, { $setOnInsert: { spentVnd: currentMonthSpentVnd, reservedVnd: 0 } }, { upsert: true });
    logger.info({ monthKey, calls: usage[0]?.calls || 0, spentVnd: currentMonthSpentVnd }, 'Backfilled current-month company-paid AI provider cost');
  }
  return { counts: {
    globalBudgetIndexes: { matched: 1, modified: dryRun ? 0 : 1 },
    existingMonthAiUsage: { matched: usage[0]?.calls || 0, modified: dryRun ? 0 : 1 },
  } };
}

export async function downAiCompanyGlobalBudget() {
  throw new Error('Keep global AI spend history; deploy a forward migration to change the budget ledger.');
}
