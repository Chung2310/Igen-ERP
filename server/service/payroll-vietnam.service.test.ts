import { describe, expect, it } from "vitest";
import type { IPayrollPolicy } from "../interface/payroll-policy.interface";
import {
  calculateInsurance,
  calculateOvertimePay,
  calculatePersonalIncomeTax,
  calculateProgressiveTax,
  calculateVietnamPayroll,
  insuranceBaseFor,
  overtimeMultiplier,
} from "./payroll-vietnam.service";

const policy = (overrides: Partial<IPayrollPolicy> = {}): IPayrollPolicy => ({
  companyCode: "ACME",
  code: "vn-2026",
  name: "Chính sách 2026",
  status: "active",
  effectiveFrom: new Date("2026-01-01"),
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
  overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: 0.3, nightOvertimeBonus: 0.2 },
  roundingUnit: 1,
  createdBy: "admin",
  version: 1,
  ...overrides,
});

describe("overtime multipliers", () => {
  it("uses the policy rate for each day category", () => {
    expect(overtimeMultiplier(policy(), { minutes: 60, category: "weekday" })).toBe(1.5);
    expect(overtimeMultiplier(policy(), { minutes: 60, category: "restDay" })).toBe(2);
    expect(overtimeMultiplier(policy(), { minutes: 60, category: "holiday" })).toBe(3);
  });

  it("adds the night premium and the night overtime bonus on the weekday rate", () => {
    // 1.5 + 0.3 + 0.2 * 1.5
    expect(overtimeMultiplier(policy(), { minutes: 60, category: "weekday", night: true })).toBeCloseTo(2.1);
    // 3 + 0.3 + 0.2 * 1.5
    expect(overtimeMultiplier(policy(), { minutes: 60, category: "holiday", night: true })).toBeCloseTo(3.6);
  });

  it("pays each overtime block separately and totals them", () => {
    const result = calculateOvertimePay(policy(), 100_000, [
      { minutes: 120, category: "weekday" },
      { minutes: 60, category: "holiday", night: true },
    ]);

    expect(result.details[0].amount).toBe(300_000);
    expect(result.details[1].amount).toBe(360_000);
    expect(result.total).toBe(660_000);
  });
});

describe("insurance", () => {
  it("caps social and health at twenty times the base salary", () => {
    const fund = policy().funds[0];
    expect(insuranceBaseFor(policy(), fund, 10_000_000)).toBe(10_000_000);
    expect(insuranceBaseFor(policy(), fund, 100_000_000)).toBe(46_800_000);
  });

  it("caps unemployment at twenty times the regional minimum wage", () => {
    const fund = policy().funds[2];
    expect(insuranceBaseFor(policy(), fund, 200_000_000)).toBe(99_200_000);
  });

  it("splits the contribution between employee and employer", () => {
    const result = calculateInsurance(policy(), 20_000_000);

    expect(result.employeeTotal).toBe(20_000_000 * 0.105);
    expect(result.employerTotal).toBe(20_000_000 * 0.215);
    expect(result.funds.map((fund) => fund.code)).toEqual(["social", "health", "unemployment"]);
  });

  it("charges nothing when the employee does not participate", () => {
    const result = calculateInsurance(policy(), 20_000_000, false);

    expect(result.funds).toEqual([]);
    expect(result.employeeTotal).toBe(0);
    expect(result.employerTotal).toBe(0);
  });
});

describe("progressive tax", () => {
  it("taxes each slice of income at its own rate", () => {
    // 5tr*5% + 5tr*10% + 2tr*15%
    expect(calculateProgressiveTax(policy().taxBrackets, 12_000_000).tax).toBe(1_050_000);
  });

  it("charges nothing on zero or negative assessable income", () => {
    expect(calculateProgressiveTax(policy().taxBrackets, 0).tax).toBe(0);
    expect(calculateProgressiveTax(policy().taxBrackets, -5_000_000).tax).toBe(0);
  });

  it("applies the open-ended top bracket above the last ceiling", () => {
    const result = calculateProgressiveTax(policy().taxBrackets, 100_000_000);

    expect(result.details.at(-1)).toEqual({ rate: 0.35, taxableAmount: 20_000_000, tax: 7_000_000 });
  });
});

describe("personal income tax", () => {
  it("deducts the personal allowance, dependents and insurance before the brackets", () => {
    const result = calculatePersonalIncomeTax(policy(), {
      method: "progressive", taxableIncome: 40_000_000, employeeInsurance: 2_100_000, dependentCount: 2,
    });

    expect(result.deductions.total).toBe(11_000_000 + 8_800_000 + 2_100_000);
    expect(result.assessableIncome).toBe(18_100_000);
    // 5tr*5% + 5tr*10% + 8tr*15% + 0,1tr*20%
    expect(result.tax).toBe(1_970_000);
  });

  it("never produces tax when the deductions exceed the income", () => {
    const result = calculatePersonalIncomeTax(policy(), {
      method: "progressive", taxableIncome: 8_000_000, employeeInsurance: 800_000, dependentCount: 0,
    });

    expect(result.assessableIncome).toBe(0);
    expect(result.tax).toBe(0);
  });

  it("withholds a flat rate for short-term contracts above the threshold", () => {
    expect(calculatePersonalIncomeTax(policy(), { method: "shortTerm", taxableIncome: 5_000_000, employeeInsurance: 0, dependentCount: 0 }).tax)
      .toBe(500_000);
  });

  it("skips short-term withholding below the threshold or with a valid commitment", () => {
    expect(calculatePersonalIncomeTax(policy(), { method: "shortTerm", taxableIncome: 1_900_000, employeeInsurance: 0, dependentCount: 0 }).tax).toBe(0);
    expect(calculatePersonalIncomeTax(policy(), {
      method: "shortTerm", taxableIncome: 9_000_000, employeeInsurance: 0, dependentCount: 0, hasWithholdingCommitment: true,
    }).tax).toBe(0);
  });

  it("taxes a non-resident at the flat rate with no deductions", () => {
    const result = calculatePersonalIncomeTax(policy(), {
      method: "nonResident", taxableIncome: 30_000_000, employeeInsurance: 2_000_000, dependentCount: 3,
    });

    expect(result.deductions.total).toBe(0);
    expect(result.tax).toBe(6_000_000);
  });
});

describe("full Vietnam payroll", () => {
  const base = {
    workPay: 30_000_000,
    hourlyRate: 172_413,
    overtime: [],
    insuranceSalary: 20_000_000,
    dependentCount: 1,
  };

  it("chains work pay, overtime, insurance and tax into net pay and employer cost", () => {
    const result = calculateVietnamPayroll(policy(), { ...base, overtime: [{ minutes: 60, category: "weekday" }] });

    const overtimePay = result.overtime.total;
    expect(result.income.totalIncome).toBe(30_000_000 + overtimePay);
    expect(result.insurance.employeeTotal).toBe(2_100_000);
    expect(result.netPay).toBe(result.income.totalIncome - 2_100_000 - result.tax.tax);
    expect(result.employerCost).toBe(result.income.totalIncome + result.insurance.employerTotal);
    expect(result.formulaVersion).toBe("vietnam-payroll-2");
  });

  it("keeps tax-exempt allowances out of the taxable income but inside total income", () => {
    const result = calculateVietnamPayroll(policy(), { ...base, exemptAllowances: 3_000_000 });

    expect(result.income.totalIncome).toBe(33_000_000);
    expect(result.income.taxableIncome).toBe(30_000_000);
  });

  it("carries the excess forward instead of paying a negative amount", () => {
    const result = calculateVietnamPayroll(policy(), { ...base, workPay: 5_000_000, insuranceSalary: 5_000_000, advances: 9_000_000 });

    expect(result.netPay).toBe(0);
    expect(result.carryForward).toBeGreaterThan(0);
    expect(result.warnings).toEqual([expect.objectContaining({ code: "PAYROLL_DEDUCTIONS_EXCEED_INCOME" })]);
  });

  it("rounds money to the policy rounding unit", () => {
    const rounded = calculateVietnamPayroll(policy({ roundingUnit: 1_000 }), {
      ...base, overtime: [{ minutes: 37, category: "weekday" }],
    });

    expect(rounded.overtime.details[0].amount % 1_000).toBe(0);
    expect(rounded.insurance.employeeTotal % 1_000).toBe(0);
  });
});
