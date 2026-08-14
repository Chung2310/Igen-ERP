import { describe, expect, it } from "vitest";
import { resolvePayrollLineOverride } from "./payroll-line-override-resolver.service";

const system = {
  baseSalary: 20_000_000,
  adjustedBase: 18_000_000,
  overtime: 1_000_000,
  bonusTotal: 500_000,
  hiddenIncome: 700_000,
  penaltyTotal: 100_000,
  socialInsurance: 400_000,
  healthInsurance: 100_000,
  unemploymentInsurance: 50_000,
  personalIncomeTax: 200_000,
  otherDeductions: 25_000,
  advances: 300_000,
};

describe("resolvePayrollLineOverride", () => {
  it("replaces components but preserves hidden system income", () => {
    const result = resolvePayrollLineOverride(system, {
      bonusTotal: 0,
      socialInsurance: 250_000,
    });

    expect(result.values.bonusTotal).toBe(0);
    expect(result.values.hiddenIncome).toBe(700_000);
    expect(result.deductionTotal).toBe(1_025_000);
    expect(result.net).toBe(18_675_000);
    expect(result.provenance.bonusTotal).toBe("manual_override");
    expect(result.provenance.hiddenIncome).toBe("system");
  });

  it("keeps absent fields from the system row", () => {
    const result = resolvePayrollLineOverride(system, { otherDeductions: 0 });

    expect(result.values.adjustedBase).toBe(18_000_000);
    expect(result.values.overtime).toBe(1_000_000);
    expect(result.values.socialInsurance).toBe(400_000);
    expect(result.provenance.adjustedBase).toBe("system");
    expect(result.provenance.otherDeductions).toBe("manual_override");
  });

  it("recomputes derived deduction and net values from resolved components", () => {
    const result = resolvePayrollLineOverride(system, {
      penaltyTotal: 200_000,
      healthInsurance: 0,
      advances: 500_000,
    });

    expect(result.deductionTotal).toBe(1_375_000);
    expect(result.net).toBe(18_825_000);
  });

  it("ignores client-supplied derived fields", () => {
    const derivedOverride = {
      bonusTotal: 100_000,
      deductionTotal: 1,
      net: 1,
      hiddenIncome: 1,
    } as unknown as { bonusTotal: number };
    const result = resolvePayrollLineOverride(system, derivedOverride);

    expect(result.values.hiddenIncome).toBe(700_000);
    expect(result.deductionTotal).toBe(1_175_000);
    expect(result.net).toBe(18_625_000);
    expect(result.provenance.hiddenIncome).toBe("system");
  });

  it("rounds the derived deduction total with the same currency semantics as net pay", () => {
    const result = resolvePayrollLineOverride({
      ...system,
      adjustedBase: 1_000,
      overtime: 0,
      bonusTotal: 0,
      hiddenIncome: 0,
      penaltyTotal: 10.4,
      socialInsurance: 20.4,
      healthInsurance: 0,
      unemploymentInsurance: 0,
      personalIncomeTax: 0,
      otherDeductions: 0,
      advances: 0,
    }, {});

    expect(result.deductionTotal).toBe(31);
    expect(result.net).toBe(969);
  });
});
