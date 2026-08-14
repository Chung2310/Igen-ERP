import type { CommissionTier } from "../../interfaces/commission-policy.interface";
import { roundMinutes, roundMoney } from "./rounding";

export type SeasonalPolicy = {
  tierMode: "flat" | "progressive";
  tiers: CommissionTier[];
  minHoursPerWorker?: number | null;
  maxEligibleHoursPerWorker?: number | null;
  hourRounding: { unitMinutes: number; mode: "floor" | "nearest" | "ceil" };
  moneyRounding: { unitVnd: number; mode: "floor" | "nearest" | "ceil" };
};

function lastMatchingTierIndex(tiers: CommissionTier[], hours: number): number {
  let match = -1;
  for (let index = 0; index < tiers.length; index += 1) if (hours >= tiers[index].minHours) match = index;
  return match;
}

export function calculateSeasonalCommission(rawMinutes: number, policy: SeasonalPolicy) {
  const roundedMinutes = Math.max(0, roundMinutes(rawMinutes, policy.hourRounding));
  const minMinutes = Math.max(0, Math.round(Number(policy.minHoursPerWorker || 0) * 60));
  const maxMinutes = policy.maxEligibleHoursPerWorker == null ? null : Math.max(0, Math.round(Number(policy.maxEligibleHoursPerWorker) * 60));
  if (roundedMinutes < minMinutes) return { eligibleMinutes: roundedMinutes, hours: roundedMinutes / 60, hourlyRate: 0, amount: 0, tierIndex: -1 };
  const eligibleMinutes = maxMinutes == null ? roundedMinutes : Math.min(roundedMinutes, maxMinutes);
  const hours = eligibleMinutes / 60;
  const tiers = [...policy.tiers].sort((a, b) => a.minHours - b.minHours);
  if (!tiers.length || hours === 0) return { eligibleMinutes, hours, hourlyRate: 0, amount: 0, tierIndex: -1 };
  if (policy.tierMode === "flat") {
    const tierIndex = lastMatchingTierIndex(tiers, hours);
    const tier = tiers[Math.max(0, tierIndex)];
    return { eligibleMinutes, hours, hourlyRate: tier.hourlyRate, amount: roundMoney(hours * tier.hourlyRate, policy.moneyRounding), tierIndex: Math.max(0, tierIndex) };
  }
  let amount = 0;
  for (let index = 0; index < tiers.length; index += 1) {
    const tier = tiers[index];
    const nextMin = tiers[index + 1]?.minHours ?? Infinity;
    const tierHours = Math.max(0, Math.min(hours, nextMin) - tier.minHours);
    amount += tierHours * tier.hourlyRate;
  }
  const tierIndex = lastMatchingTierIndex(tiers, hours);
  return { eligibleMinutes, hours, hourlyRate: tiers[Math.max(0, tierIndex)]?.hourlyRate || 0, amount: roundMoney(amount, policy.moneyRounding), tierIndex: Math.max(0, tierIndex) };
}
