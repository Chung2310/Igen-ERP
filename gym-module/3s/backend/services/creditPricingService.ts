import type { AiTaskType, PricingSnapshot, ProviderUsage } from './creditTypes.js';

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

/** AI pricing rules; the actual Credit balance and ledger are owned by ERP. */
export async function getPricingSnapshot(taskType: AiTaskType): Promise<PricingSnapshot> {
  const credits = ['TEXT_WORKOUT', 'TEXT_ROADMAP', 'TEXT_NUTRITION', 'IMAGE_GENERATION'].includes(taskType)
    ? 10 : taskType === 'OCR_INBODY' ? 5 : 1;
  return Object.freeze({
    usdToVnd: 26_000,
    vndPerCredit: 100,
    markupBasisPoints: 12_500,
    fallbackCredits: credits,
    minBillableCredits: credits,
    maxReservationCredits: credits,
  });
}
