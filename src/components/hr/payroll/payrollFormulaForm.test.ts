import { describe, expect, it } from "vitest";
import { createPayrollFormulaForm, payrollFormulaFormToDefinition, validatePayrollFormulaForm } from "./payrollFormulaForm";
describe("payroll formula form", () => {
  it("serializes structured operands without source code", () => { const form = createPayrollFormulaForm(); form.code = "attendance"; form.name = "Chuyên cần"; form.leftVariable = "actualWorkDays"; form.operator = "multiply"; form.rightValue = 50000; expect(payrollFormulaFormToDefinition(form).expression).toEqual({ type: "binary", operator: "multiply", left: { type: "variable", key: "actualWorkDays" }, right: { type: "constant", value: 50000 } }); });
  it("requires metadata and a finite value", () => expect(validatePayrollFormulaForm({ ...createPayrollFormulaForm(), rightValue: Number.NaN })).toMatchObject({ code: expect.any(String), name: expect.any(String), rightValue: expect.any(String) }));
});
