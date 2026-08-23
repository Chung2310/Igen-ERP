import type { IPayrollPolicy } from "../interfaces/payroll-policy.interface";

export const DEFAULT_VIETNAM_PAYROLL_POLICY: IPayrollPolicy = {
  companyCode: "*",
  code: "vn-default",
  name: "Chính sách mặc định hệ thống",
  status: "active",
  effectiveFrom: new Date("2000-01-01T00:00:00.000Z"),
  baseSalary: 2_340_000,
  regionalMinimumWage: 4_960_000,
  socialCapMultiplier: 20,
  unemploymentCapMultiplier: 20,
  funds: [
    { code: "social", employeeRate: 0.08, employerRate: 0.175, capBasis: "baseSalary" },
    { code: "health", employeeRate: 0.015, employerRate: 0.03, capBasis: "baseSalary" },
    { code: "unemployment", employeeRate: 0.01, employerRate: 0.01, capBasis: "regionalMinimum" },
  ],
  personalDeduction: 11_000_000,
  dependentDeduction: 4_400_000,
  taxBrackets: [
    { upTo: 5_000_000, rate: 0.05 },
    { upTo: 10_000_000, rate: 0.1 },
    { upTo: 18_000_000, rate: 0.15 },
    { upTo: 32_000_000, rate: 0.2 },
    { upTo: 52_000_000, rate: 0.25 },
    { upTo: 80_000_000, rate: 0.3 },
    { rate: 0.35 },
  ],
  shortTermWithholdingRate: 0.1,
  shortTermWithholdingThreshold: 2_000_000,
  nonResidentRate: 0.2,
  overtime: {
    weekday: 1.5,
    restDay: 2,
    holiday: 3,
    nightPremium: 0.3,
    nightOvertimeBonus: 0.2,
  },
  roundingUnit: 1,
  createdBy: "system",
  version: 0,
};

export function resolvePayrollPolicy(policies: IPayrollPolicy[], date: Date | string): { policy: IPayrollPolicy; isDefault: boolean } {
  // Sort policies by effectiveFrom descending to find the newest matching policy
  const matching = policies
    .filter((p) => {
      const from = new Date(p.effectiveFrom).getTime();
      const to = p.effectiveTo ? new Date(p.effectiveTo).getTime() : Infinity;
      const target = new Date(date).getTime();
      return p.status === "active" && from <= target && target <= to;
    })
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());

  if (matching[0]) {
    return { policy: matching[0], isDefault: false };
  }
  return { policy: DEFAULT_VIETNAM_PAYROLL_POLICY, isDefault: true };
}

export function resolvePersistedPayrollPolicy(policies: IPayrollPolicy[], date: Date | string): IPayrollPolicy | undefined {
  const target = new Date(date).getTime();
  return policies.filter((policy) => policy.status === "active"
    && new Date(policy.effectiveFrom).getTime() <= target
    && (!policy.effectiveTo || target <= new Date(policy.effectiveTo).getTime()))
    .sort((left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime())[0];
}
