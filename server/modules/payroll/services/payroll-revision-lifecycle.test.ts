import { describe, expect, it } from "vitest";
import { runPayrollRevision } from "./payroll-run-calculation.service";

describe("runPayrollRevision", () => {
  it("creates a completed revision and activates it only after calculation succeeds", async () => {
    const revisions: any[] = [];
    let activeRevisionId = "";
    const result = await runPayrollRevision({
      revision: { create: async (value: any) => { const saved = { ...value, id: "revision-1" }; revisions.push(saved); return saved; }, update: async (_id: string, value: any) => Object.assign(revisions[0], value) },
      run: { activateRevision: async (id: string) => { activeRevisionId = id; } },
      input: {
        employeeId: "employee-1", standardDays: 26, standardHours: 208, workedMinutes: 9600, shortageMinutes: 0,
        paidLeaveMinutesByRate: [], overtime: [], allowances: 0, bonuses: 0, deductions: 0, adjustments: 0,
        period: { start: "2026-07-01", end: "2026-07-31" }, policy: { id: "policy-1", version: 1 },
        segments: [{ sourceId: "salary-1", start: "2026-07-01", end: "2026-07-31", monthlySalary: 26000000 }], issues: [],
      },
    });

    expect(result.status).toBe("completed");
    expect(revisions[0].status).toBe("completed");
    expect(activeRevisionId).toBe("revision-1");
  });
});
