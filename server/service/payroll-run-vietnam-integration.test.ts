import { describe, expect, it } from "vitest";
import type { IPayrollPolicy } from "../interface/payroll-policy.interface";
import { calculateDetailedPayroll } from "./payroll-run-calculation.service";

const policy: IPayrollPolicy = {
  companyCode: "ACME", code: "vn-2026", name: "2026", status: "active",
  effectiveFrom: new Date("2026-01-01"),
  baseSalary: 2_340_000, regionalMinimumWage: 4_960_000,
  socialCapMultiplier: 20, unemploymentCapMultiplier: 20,
  funds: [
    { code: "social", employeeRate: 0.08, employerRate: 0.175, capBasis: "baseSalary" },
    { code: "health", employeeRate: 0.015, employerRate: 0.03, capBasis: "baseSalary" },
    { code: "unemployment", employeeRate: 0.01, employerRate: 0.01, capBasis: "regionalMinimum" },
  ],
  personalDeduction: 11_000_000, dependentDeduction: 4_400_000,
  taxBrackets: [{ upTo: 5_000_000, rate: 0.05 }, { upTo: 10_000_000, rate: 0.1 }, { rate: 0.2 }],
  shortTermWithholdingRate: 0.1, shortTermWithholdingThreshold: 2_000_000, nonResidentRate: 0.2,
  overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: 0.3, nightOvertimeBonus: 0.2 },
  roundingUnit: 1, createdBy: "admin", version: 3,
};

const input = (overrides: any = {}) => ({
  employeeId: "emp-1",
  segments: [{ sourceId: "contract-1:0", start: "2026-07-01", end: "2026-07-31", monthlySalary: 30_000_000 }],
  standardDays: 23, standardHours: 184,
  workedMinutes: 184 * 60, shortageMinutes: 0,
  paidLeaveMinutesByRate: [], overtime: [],
  allowances: 0, bonuses: 0, deductions: 0, adjustments: 0,
  issues: [],
  ...overrides,
});

describe("run calculation with an active policy", () => {
  it("keeps the legacy formula when no policy is attached", () => {
    const { lines } = calculateDetailedPayroll(input());

    expect(lines[0].formulaVersion).toBe("vietnam-payroll-1");
    expect(lines[0].vietnam).toBeUndefined();
  });

  it("switches to the Vietnam formulas and stores the full breakdown", () => {
    const { lines } = calculateDetailedPayroll(input({
      vietnam: { policy, insuranceSalary: 20_000_000, dependentCount: 1 },
    }));

    const line = lines[0];
    expect(line.formulaVersion).toBe("vietnam-payroll-2");
    expect((line.vietnam as any).insurance.employeeTotal).toBe(2_100_000);
    expect((line.vietnam as any).tax.deductions.dependents).toBe(4_400_000);
    expect((line.vietnam as any).employerCost).toBeGreaterThan(line.calculation.gross);
    expect(line.calculation.net).toBe((line.vietnam as any).netPay);
  });

  it("prorates insurance and pay across a mid-month salary change", () => {
    const { lines } = calculateDetailedPayroll(input({
      segments: [
        { sourceId: "contract-1:0", start: "2026-07-01", end: "2026-07-15", monthlySalary: 20_000_000 },
        { sourceId: "contract-1:1", start: "2026-07-16", end: "2026-07-31", monthlySalary: 30_000_000 },
      ],
      vietnam: { policy, insuranceSalary: 20_000_000, dependentCount: 0 },
    }));

    expect(lines).toHaveLength(2);
    const insuranceBases = lines.map((line) => (line.vietnam as any).insurance.funds[0].base);
    expect(insuranceBases[0]).toBeLessThan(insuranceBases[1]);
    expect(insuranceBases[0] + insuranceBases[1]).toBeCloseTo(20_000_000, -1);
  });

  it("charges no insurance for an employee who does not participate", () => {
    const { lines } = calculateDetailedPayroll(input({
      vietnam: { policy, insuranceSalary: 20_000_000, participatesInsurance: false },
    }));

    expect((lines[0].vietnam as any).insurance.employeeTotal).toBe(0);
    expect((lines[0].vietnam as any).tax.deductions.insurance).toBe(0);
  });

  it("applies the non-resident rate when the profile says so", () => {
    const { lines } = calculateDetailedPayroll(input({
      vietnam: { policy, insuranceSalary: 20_000_000, taxMethod: "nonResident" },
    }));

    expect((lines[0].vietnam as any).tax.method).toBe("nonResident");
    expect((lines[0].vietnam as any).tax.tax).toBe(30_000_000 * 0.2);
  });

  it("pays night overtime above day overtime for the same minutes", () => {
    const day = calculateDetailedPayroll(input({
      overtime: [{ minutes: 120, category: "weekday" }],
      vietnam: { policy, insuranceSalary: 20_000_000 },
    }));
    const night = calculateDetailedPayroll(input({
      overtime: [{ minutes: 120, category: "weekday", night: true }],
      vietnam: { policy, insuranceSalary: 20_000_000 },
    }));

    expect((night.lines[0].vietnam as any).overtime.total)
      .toBeGreaterThan((day.lines[0].vietnam as any).overtime.total);
  });

  it("surfaces the carry-forward warning on the line", () => {
    const { lines } = calculateDetailedPayroll(input({
      segments: [{ sourceId: "contract-1:0", start: "2026-07-01", end: "2026-07-31", monthlySalary: 4_000_000 }],
      deductions: 9_000_000,
      vietnam: { policy, insuranceSalary: 4_000_000 },
    }));

    expect(lines[0].warnings).toContain("PAYROLL_DEDUCTIONS_EXCEED_INCOME");
    expect(lines[0].calculation.net).toBe(0);
  });
});
