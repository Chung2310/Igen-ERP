import type { Document } from "mongoose";
import type { AggregationScope, PolicyStatus, RoundingMode, TierMode } from "../contracts";

export type OfficialEligibilityRule = "contract_active" | "manual_confirmation" | "attendance_threshold";
export type OfficialMilestone = { month: 1 | 2 | 3; amount: number; eligibilityRule: OfficialEligibilityRule; minWorkedDays?: number | null; minWorkedHours?: number | null };
export type CommissionTier = { minHours: number; maxHours?: number | null; hourlyRate: number };

export interface ICommissionPolicy extends Document {
  companyCode: string;
  branchId?: string;
  name: string;
  version: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: PolicyStatus;
  settlementCycle: { type: "calendar_month" | "cutoff_day"; cutoffDay?: number | null };
  official: { enabled: boolean; maxMonths?: 1 | 2 | 3; milestones: OfficialMilestone[] };
  seasonal: {
    enabled: boolean;
    aggregationScope?: AggregationScope;
    tierMode?: TierMode;
    minHoursPerWorker?: number | null;
    maxEligibleHoursPerWorker?: number | null;
    hourRounding?: { unitMinutes: 1 | 5 | 15 | 30 | 60; mode: RoundingMode };
    moneyRounding?: { unitVnd: number; mode: RoundingMode };
    tiers: CommissionTier[];
  };
  createdBy: { id: string; name: string; email: string };
  activatedBy?: { id: string; name: string; email: string } | null;
  activatedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
