export type CommissionScheme = "official_monthly" | "seasonal_hourly";
export type PolicyStatus = "draft" | "active" | "retired";
export type RoundingMode = "floor" | "nearest" | "ceil";

export type LaborPartner = {
  _id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  status: "active" | "inactive";
  defaultPolicyId?: string | null;
  defaultOfficialPolicyId?: string | null;
  defaultSeasonalPolicyId?: string | null;
  note?: string;
  taxCode?: string; representative?: string; address?: string; bankName?: string; bankAccountNo?: string; bankAccountName?: string;
  referralSummary?: { active: number; pending?: number; official?: number; seasonal?: number; total: number };
};

export type CommissionPolicy = {
  _id: string;
  name: string;
  version: number;
  status: PolicyStatus;
  effectiveFrom: string;
  effectiveTo?: string | null;
  settlementCycle: { type: "calendar_month" | "cutoff_day"; cutoffDay?: number | null };
  official: { enabled: boolean; maxMonths?: 1 | 2 | 3 | null; milestones: Array<{ month: 1 | 2 | 3; amount: number; eligibilityRule: "contract_active" | "manual_confirmation" | "attendance_threshold"; minWorkedDays?: number | null; minWorkedHours?: number | null }> };
  seasonal: { enabled: boolean; aggregationScope?: "partner_period" | "partner_project_period" | null; tierMode?: "flat" | "progressive" | null; minHoursPerWorker?: number | null; maxEligibleHoursPerWorker?: number | null; hourRounding: { unitMinutes: 1 | 5 | 15 | 30 | 60; mode: RoundingMode }; moneyRounding: { unitVnd: number; mode: RoundingMode }; tiers: Array<{ minHours: number; maxHours?: number | null; hourlyRate: number }> };
};

export type WorkerReferral = { _id: string; workerId: string; partnerId: string | { _id: string; code: string; name: string }; policyId: string; commissionScheme: CommissionScheme; referredAt: string; employmentStartDate: string; effectiveFrom: string; effectiveTo?: string | null; status: "pending" | "active" | "ended" | "rejected"; confirmationSource: "contract" | "manual" | "attendance"; note?: string };

export type SettlementStatus = "draft" | "calculated" | "approved" | "partially_paid" | "paid" | "void";
export type LaborPartnerSettlement = {
  _id: string; partnerId: string | { _id: string; code: string; name: string }; periodStart: string; periodEnd: string;
  status: SettlementStatus; officialAmount: number; seasonalMinutes: number; seasonalAmount: number;
  adjustmentAmount: number; totalAmount: number; paidAmount: number; balanceAmount: number; version: number;
  warnings?: Array<{ code?: string; message?: string }>;
};
export type CommissionLine = {
  _id: string; scheme: CommissionScheme | "adjustment"; status: "draft" | "approved" | "void"; officialMilestone?: number | null;
  eligibleMinutes?: number | null; hourlyRate?: number | null; amount: number; explanation: string; sourceAttendanceLogIds?: string[]; sourceContractId?: string | null;
  workerId?: string | { _id: string; fullName: string; code?: string; phone?: string } | null;
};
export type LaborPartnerPayout = { _id: string; amount: number; paidAt: string; method: "cash" | "bank_transfer"; reference?: string; note?: string; reversalOfPayoutId?: string | null };
export type SettlementDetail = LaborPartnerSettlement & { lines: CommissionLine[]; payouts: LaborPartnerPayout[] };
export type SettlementFilters = { partnerId?: string; status?: SettlementStatus; scheme?: CommissionScheme; periodStart?: string; periodEnd?: string };
export type LaborPartnerReportSummary = { settlementCount: number; accruedAmount: number; approvedAmount: number; paidAmount: number; balanceAmount: number };
export type LaborPartnerKpiRow = {
  _id: string | null;
  partnerId: string;
  partner: { _id: string; code: string; name: string; status: "active" | "inactive" };
  periodStart: string;
  periodEnd: string;
  targetReferrals: number;
  actualReferrals: number;
  remainingReferrals: number | null;
  completionRate: number | null;
  status: "not_set" | "achieved" | "incomplete";
  note: string;
};
export type LaborPartnerOverview = {
  partner: LaborPartner;
  referrals: Array<Omit<WorkerReferral, "workerId" | "policyId"> & { workerId: string | { _id: string; code?: string; fullName: string; phone?: string }; policyId: string | { _id: string; name: string; version: number } }>;
  settlements: LaborPartnerSettlement[];
  payouts: LaborPartnerPayout[];
  totals: { accruedAmount: number; paidAmount: number; balanceAmount: number };
};
