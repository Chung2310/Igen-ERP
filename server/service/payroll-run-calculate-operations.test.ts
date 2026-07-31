import { describe, expect, it, vi } from "vitest";
import { calculateDetailedPayrollBatch, calculateRun } from "./payroll-run-calculation.service";

const employee = (employeeId: string, monthlySalary: number) => ({
  employeeId,
  segments: [{ sourceId: `contract:${employeeId}`, start: "2026-07-01", end: "2026-07-31", monthlySalary }],
  standardDays: 23,
  standardHours: 184,
  workedMinutes: 184 * 60,
  shortageMinutes: 0,
  paidLeaveMinutesByRate: [],
  overtime: [],
  allowances: 0,
  bonuses: 0,
  deductions: 0,
  adjustments: 0,
  issues: [],
});

describe("calculateDetailedPayrollBatch", () => {
  it("aggregates lines and totals across every employee in the run", () => {
    const result = calculateDetailedPayrollBatch([employee("emp-1", 10_000_000), employee("emp-2", 20_000_000)]);

    expect(result.lines).toHaveLength(2);
    expect(result.lines.map((line) => line.employeeId)).toEqual(["emp-1", "emp-2"]);
    expect(result.totals.netPay).toBeGreaterThan(0);
    expect(result.totals.grossPay).toBe(
      calculateDetailedPayrollBatch([employee("emp-1", 10_000_000)]).totals.grossPay
      + calculateDetailedPayrollBatch([employee("emp-2", 20_000_000)]).totals.grossPay,
    );
  });

  it("collects effective-input issues from every employee", () => {
    const withIssue = { ...employee("emp-3", 0), issues: [{ code: "SALARY_TERM_MISSING", message: "missing", employeeId: "emp-3", severity: "blocking" as const }] };
    const result = calculateDetailedPayrollBatch([employee("emp-1", 10_000_000), withIssue]);
    expect(result.issues).toEqual([{ code: "SALARY_TERM_MISSING", message: "missing", employeeId: "emp-3", severity: "blocking" }]);
  });
});

describe("calculateRun for a whole run", () => {
  const repositories = (overrides: any = {}) => ({
    run: {
      get: async () => ({ id: "run-1", status: "attendance_locked", version: 1 }),
      activateRevision: vi.fn(async () => ({ version: 2 })),
      ...overrides.run,
    },
    revision: {
      nextRevision: async () => 1,
      create: async (value: any) => ({ id: "revision-1", ...value }),
      update: async (_id: string, value: any) => ({ id: "revision-1", ...value }),
      ...overrides.revision,
    },
  });

  it("stores one line per employee of the locked snapshot", async () => {
    const repos = repositories();
    const result: any = await calculateRun({
      ...repos,
      input: async () => [employee("emp-1", 10_000_000), employee("emp-2", 12_000_000)],
      expectedVersion: 1,
    });

    expect(result.status).toBe("completed");
    expect(result.lines.map((line: any) => line.employeeId)).toEqual(["emp-1", "emp-2"]);
    expect(repos.run.activateRevision).toHaveBeenCalledWith("revision-1", 1, expect.stringMatching(/^[0-9a-f]{64}$/));
  });

  it("keeps the previous active revision when the run version moved during calculation", async () => {
    const repos = repositories({ run: { activateRevision: vi.fn(async () => null) } });
    const result: any = await calculateRun({
      ...repos,
      input: async () => [employee("emp-1", 10_000_000)],
      expectedVersion: 1,
    });

    expect(result).toEqual({ code: "PAYROLL_VERSION_CONFLICT", currentVersion: 1 });
  });

  it("refuses to calculate a run whose attendance is not locked yet", async () => {
    const repos = repositories({ run: { get: async () => ({ id: "run-1", status: "draft", version: 1 }) } });
    const result: any = await calculateRun({
      ...repos,
      input: async () => { throw new Error("must not load"); },
      expectedVersion: 1,
    });

    expect(result).toEqual({ code: "PAYROLL_RUN_STATE_INVALID", status: "draft" });
  });

  it("records the idempotency result only after a successful calculation", async () => {
    const saved: any[] = [];
    const repos = repositories();
    await calculateRun({
      ...repos,
      idempotencyKey: "key-1",
      idempotency: { get: async () => null, save: async (key: string, value: any) => { saved.push({ key, value }); } },
      input: async () => [employee("emp-1", 10_000_000)],
      expectedVersion: 1,
    });

    expect(saved).toHaveLength(1);
    expect(saved[0].key).toBe("key-1");
    expect(saved[0].value.status).toBe("completed");
  });
});
