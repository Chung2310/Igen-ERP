import AiBillingPolicy from '../models/AiBillingPolicy.js';
import CreditPricing from '../models/CreditPricing.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AiTaskType, PricingSnapshot, ProviderUsage } from './creditTypes.js';

import { ensureCreditReferenceData } from './migrationService.js';

export function calculateSettledCredits(usage: ProviderUsage, pricing: PricingSnapshot): number {
  const cost = usage.providerCostMicrousd;
  if (cost === undefined) return pricing.fallbackCredits;
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error('providerCostMicrousd phải là số nguyên không âm.');
  if (cost === 0) return pricing.minBillableCredits;
  const numerator = BigInt(cost) * BigInt(pricing.usdToVnd) * BigInt(pricing.markupBasisPoints);
  const denominator = 1_000_000n * 10_000n * BigInt(pricing.vndPerCredit);
  const rounded = Number((numerator + denominator - 1n) / denominator);
  return Math.max(pricing.minBillableCredits, rounded);
}

export async function getPricingSnapshot(taskType: AiTaskType): Promise<PricingSnapshot> {
  let [pricing, policy] = await Promise.all([
    CreditPricing.findOne({ key: 'GLOBAL' }).lean(),
    AiBillingPolicy.findOne({ taskType }).lean(),
  ]);
  if (!pricing || !policy) {
    await ensureCreditReferenceData();
    [pricing, policy] = await Promise.all([
      CreditPricing.findOne({ key: 'GLOBAL' }).lean(),
      AiBillingPolicy.findOne({ taskType }).lean(),
    ]);
  }
  if (!pricing || !policy || !policy.enabled) {
    throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Chính sách tính credit cho tác vụ AI chưa sẵn sàng.' });
  }
  return Object.freeze({
    usdToVnd: pricing.usdToVnd,
    vndPerCredit: pricing.vndPerCredit,
    markupBasisPoints: policy.markupBasisPoints,
    fallbackCredits: policy.fallbackCredits,
    minBillableCredits: policy.minBillableCredits,
    maxReservationCredits: policy.maxReservationCredits,
  });
}

