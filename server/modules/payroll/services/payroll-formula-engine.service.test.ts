import { describe, expect, it } from "vitest";
import { evaluatePayrollFormula, evaluatePayrollFormulas, validatePayrollFormulaDefinition } from "./payroll-formula-engine.service";

const formula = (overrides: any = {}) => ({
  code: "attendance", name: "Chuyên cần", resultBucket: "allowance", priority: 10,
  conditions: { combinator: "and", items: [{ left: "actualWorkDays", operator: "greaterThanOrEqual", right: 20 }] },
  expression: { type: "binary", operator: "multiply", left: { type: "variable", key: "actualWorkDays" }, right: { type: "constant", value: 50_000 } },
  rounding: { mode: "nearest", unit: 1000 }, version: 2, ...overrides,
});

describe("payroll formula engine", () => {
  it("evaluates conditions, arithmetic, rounding and trace", () => {
    const result = evaluatePayrollFormula(formula(), { actualWorkDays: 21 });
    expect(result).toMatchObject({ applied: true, value: 1_050_000, bucket: "allowance", code: "attendance", version: 2 });
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("skips a formula whose condition is false", () => expect(evaluatePayrollFormula(formula(), { actualWorkDays: 19 }).applied).toBe(false));

  it("supports OR conditions and rounds up", () => {
    const result = evaluatePayrollFormula(formula({ conditions: { combinator: "or", items: [{ left: "lateMinutes", operator: "equal", right: 0 }, { left: "earlyLeaveMinutes", operator: "equal", right: 0 }] }, expression: { type: "constant", value: 1001 }, rounding: { mode: "up", unit: 1000 } }), { lateMinutes: 2, earlyLeaveMinutes: 0 });
    expect(result.value).toBe(2000);
  });

  it("orders independent formulas and accumulates buckets", () => {
    const result = evaluatePayrollFormulas([formula({ code: "b", priority: 2 }), formula({ code: "a", priority: 1, resultBucket: "bonus" })], { actualWorkDays: 21 });
    expect(result.applications.map((item) => item.code)).toEqual(["a", "b"]);
    expect(result.totals).toMatchObject({ allowance: 1_050_000, bonus: 1_050_000, deduction: 0, adjustment: 0 });
  });

  it("rejects unknown variables and excessive depth", () => {
    expect(validatePayrollFormulaDefinition(formula({ expression: { type: "variable", key: "secret" } }))).toMatchObject({ code: "PAYROLL_FORMULA_VARIABLE_INVALID" });
    let expression: any = { type: "constant", value: 1 };
    for (let index = 0; index < 10; index += 1) expression = { type: "binary", operator: "add", left: expression, right: { type: "constant", value: 1 } };
    expect(validatePayrollFormulaDefinition(formula({ expression }))).toMatchObject({ code: "PAYROLL_FORMULA_DEPTH_EXCEEDED" });
  });

  it("reports missing variables and division by zero", () => {
    expect(() => evaluatePayrollFormula(formula(), {})).toThrow(/actualWorkDays/);
    expect(validatePayrollFormulaDefinition(formula({ expression: { type: "binary", operator: "divide", left: { type: "constant", value: 1 }, right: { type: "constant", value: 0 } } }))).toMatchObject({ code: "PAYROLL_FORMULA_DIVISION_BY_ZERO" });
  });
});
