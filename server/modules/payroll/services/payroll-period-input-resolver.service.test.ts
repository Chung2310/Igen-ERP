import { describe, expect, it } from "vitest";
import { resolvePayrollPeriodInputs } from "./payroll-period-input-resolver.service";

describe("resolvePayrollPeriodInputs", () => {
  const source = { agreedSalary: 20_000_000, reconciledDays: 24, reconciledHours: 192, allowance: 500_000, bonus: 300_000, deduction: 100_000 };
  it("preserves explicit zero and falls back only for absent fields", () => {
    const result = resolvePayrollPeriodInputs(source, { agreedSalary: 0, bonus: undefined }, []);
    expect(result.values.agreedSalary).toBe(0);
    expect(result.provenance.agreedSalary).toBe("period_override");
    expect(result.values.bonus).toBe(300_000);
    expect(result.provenance.bonus).toBe("system");
  });
  it("uses custom overrides then defaults and reports missing variables", () => {
    const result = resolvePayrollPeriodInputs(source, { customValues: { sales: 0 } }, [{ code: "sales", defaultValue: 10 }, { code: "quality" }]);
    expect(result.customValues["custom.sales"]).toEqual({ value: 0, provenance: "period_override" });
    expect(result.missing).toEqual(["custom.quality"]);
  });
});
