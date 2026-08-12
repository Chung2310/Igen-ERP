import { describe, expect, it } from "vitest";
import {
  createDefaultPayrollPolicyForm,
  payrollPolicyFormToDefinition,
  policyDefinitionToForm,
  validatePayrollPolicyStep,
} from "./payrollPolicyForm";

describe("payroll policy form", () => {
  it("converts stored decimal rates to percentages and back", () => {
    const definition = payrollPolicyFormToDefinition(createDefaultPayrollPolicyForm());
    const form = policyDefinitionToForm(definition);

    expect(form.funds.social.employeeRate).toBe(8);
    expect(form.shortTermWithholdingRate).toBe(10);
    expect(definition.funds.find((fund) => fund.code === "social")?.employeeRate).toBe(0.08);
    expect(definition.shortTermWithholdingRate).toBe(0.1);
  });

  it("normalizes dates and preserves an unlimited top tax bracket", () => {
    const form = createDefaultPayrollPolicyForm();
    form.effectiveFrom = "2026-01-01";
    form.taxBrackets = [{ upTo: "5000000", rate: 5 }, { upTo: "", rate: 20 }];

    const definition = payrollPolicyFormToDefinition(form);

    expect(definition.effectiveFrom).toBe("2026-01-01");
    expect(definition.taxBrackets).toEqual([{ upTo: 5_000_000, rate: 0.05 }, { rate: 0.2 }]);
    expect(definition).not.toHaveProperty("sourceReference");
  });

  it("validates required fields and effective date order", () => {
    const form = createDefaultPayrollPolicyForm();
    form.code = "";
    form.effectiveFrom = "2026-08-10";
    form.effectiveTo = "2026-08-01";

    expect(validatePayrollPolicyStep(form, 0)).toMatchObject({
      code: expect.any(String),
      effectiveTo: expect.any(String),
    });
  });

  it("rejects invalid percentages and tax brackets", () => {
    const form = createDefaultPayrollPolicyForm();
    form.funds.social.employeeRate = 101;
    form.taxBrackets = [{ upTo: "10000000", rate: 5 }, { upTo: "5000000", rate: 10 }];

    expect(validatePayrollPolicyStep(form, 1)).toHaveProperty("funds.social.employeeRate");
    expect(validatePayrollPolicyStep(form, 2)).toHaveProperty("taxBrackets");
  });

  it("preserves accident and union funds", () => {
    const form = policyDefinitionToForm({
      ...payrollPolicyFormToDefinition(createDefaultPayrollPolicyForm()),
      funds: [{ code: "union", employeeRate: 0, employerRate: 0.02, capBasis: "none" }],
    });
    expect(form.funds.union.employerRate).toBe(2);
    expect(payrollPolicyFormToDefinition(form).funds.find((fund) => fund.code === "union")?.employerRate).toBe(0.02);
  });

  it("rejects statutory overtime multipliers below one", () => {
    const form = createDefaultPayrollPolicyForm();
    form.overtime.weekday = 0.5;
    expect(validatePayrollPolicyStep(form, 3)).toHaveProperty("overtime.weekday");
  });
});
