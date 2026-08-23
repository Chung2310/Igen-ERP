import { describe, expect, it } from "vitest";
import { adaptLegacyPayrollLine } from "../interfaces/payroll-revision.interface";
import { PayrollCalculationRevisionModel } from "./payroll-calculation-revision.model";

describe("adaptLegacyPayrollLine", () => {
  it("keeps legacy calculation values readable without recalculating them", () => {
    const line = adaptLegacyPayrollLine({
      employeeId: "employee-1",
      employeeName: "Nguyen Van A",
      calculation: { adjustedBase: 25000000, net: 26000000, overtime: 1000000 },
    });

    expect(line).toEqual(expect.objectContaining({
      employeeId: "employee-1",
      employeeName: "Nguyen Van A",
      calculation: expect.objectContaining({ adjustedBase: 25000000, net: 26000000 }),
      formulaVersion: "legacy",
      warnings: [],
    }));
  });

  it("defines revision state, typed totals, and a unique run/revision index", () => {
    const paths = PayrollCalculationRevisionModel.schema.paths;
    expect(paths.status.options.enum).toEqual(["running", "completed", "failed"]);
    expect(paths.revision.options.required).toBe(true);
    expect(paths["totals.grossPay"].options.required).toBe(true);
    expect(PayrollCalculationRevisionModel.schema.indexes()).toEqual(expect.arrayContaining([
      [{ runId: 1, revision: 1 }, { unique: true }],
    ]));
  });});
