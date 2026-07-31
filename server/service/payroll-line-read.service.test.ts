import { describe, expect, it } from "vitest";
import { readPayrollLine } from "./payroll-line-read.service";

describe("readPayrollLine", () => {
  it("prefers the active typed revision and falls back to legacy lines", async () => {
    const typed = await readPayrollLine({
      run: { activeRevisionId: "revision-1", lines: [{ employeeId: "employee-1", calculation: { net: 1 } }] },
      revision: { getLine: async () => ({ employeeId: "employee-1", formulaVersion: "vietnam-payroll-1", calculation: { net: 26000000 } }) },
      employeeId: "employee-1",
    });
    expect(typed?.formulaVersion).toBe("vietnam-payroll-1");

    const legacy = await readPayrollLine({
      run: { lines: [{ employeeId: "employee-2", calculation: { net: 12000000 } }] },
      revision: { getLine: async () => undefined },
      employeeId: "employee-2",
    });
    expect(legacy?.formulaVersion).toBe("legacy");
    expect(legacy?.calculation.net).toBe(12000000);
  });
});
