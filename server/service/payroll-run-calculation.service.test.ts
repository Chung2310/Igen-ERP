import { describe, expect, it } from "vitest";
import { calculateDetailedPayroll } from "./payroll-run-calculation.service";

describe("calculateDetailedPayroll", () => {
  it("calculates each effective segment and returns typed totals", () => {
    const result = calculateDetailedPayroll({
      employeeId: "employee-1",
      standardDays: 26,
      standardHours: 208,
      workedMinutes: 9600,
      shortageMinutes: 2880,
      paidLeaveMinutesByRate: [],
      overtime: [],
      allowances: 0,
      bonuses: 0,
      deductions: 0,
      adjustments: 0,
      segments: [
        { sourceId: "old", start: "2026-07-01", end: "2026-07-15", monthlySalary: 26000000 },
        { sourceId: "new", start: "2026-07-16", end: "2026-07-31", monthlySalary: 30000000 },
      ],
      policy: { id: "policy-1", version: 1 },
    });

    expect(result.issues).toEqual([]);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].sourceIds).toEqual(["old"]);
    expect(result.totals.grossPay).toBeGreaterThan(0);
    expect(result.totals.netPay).toBe(result.totals.grossPay);
  });
});
