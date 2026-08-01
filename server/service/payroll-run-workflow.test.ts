import { describe, expect, it, vi } from "vitest";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { transitionPayrollRun, type PayrollWorkflowAction } from "./payroll-run-workflow.service";

const lines = [{ employeeId: "employee-a", calculation: { gross: 12_000_000, deductions: 0, net: 12_000_000 } }];
const totals = { grossPay: 12_000_000, deductions: 0, netPay: 12_000_000 };
const checksum = calculatePayrollChecksum({ lines, totals });

const activeRevision = (overrides: any = {}) => ({ _id: "revision-1", status: "completed", lines, totals, checksum, ...overrides });

const harness = (run: any, revision: any = activeRevision()) => {
  const applied: any[] = [];
  const audits: any[] = [];
  return {
    applied,
    audits,
    args: {
      run: {
        get: async () => run,
        apply: async (expectedVersion: number, from: string, to: string, fields: Record<string, unknown>) => {
          applied.push({ expectedVersion, from, to, fields });
          return { ...run, ...fields, status: to, version: run.version + 1 };
        },
      },
      revision: { getActive: async () => revision },
      audit: async (entry: any) => { audits.push(entry); return entry; },
    },
  };
};

const baseRun = (overrides: any = {}) => ({
  _id: "run-a", version: 3, status: "reviewed", createdBy: "preparer",
  activeRevisionId: "revision-1", activeRevisionChecksum: checksum, issues: [], ...overrides,
});

const act = (action: PayrollWorkflowAction, run: any, extra: any = {}, revision?: any) => {
  const context = harness(run, revision);
  return transitionPayrollRun({
    action, actorId: "approver", expectedVersion: run.version, ...context.args, ...extra,
  }).then((result) => ({ result: result as any, ...context }));
};

describe("payroll run workflow", () => {
  it("moves a calculated run to reviewed and records who reviewed it", async () => {
    const { result, applied } = await act("review", baseRun({ status: "calculated" }));

    expect(result.run.status).toBe("reviewed");
    expect(applied[0]).toEqual({ expectedVersion: 3, from: "calculated", to: "reviewed", fields: { reviewedBy: "approver" } });
  });

  it("approves a reviewed run whose checksum still matches the active revision", async () => {
    const { result, applied, audits } = await act("approve", baseRun());

    expect(result.run.status).toBe("approved");
    expect(applied[0].fields).toEqual({ approvedBy: "approver" });
    expect(audits[0]).toEqual({
      action: "approve",
      metadata: expect.objectContaining({
        operation: "approve", runId: "run-a",
        before: { status: "reviewed", version: 3 },
        after: { status: "approved", version: 4 },
      }),
    });
  });

  it("blocks approval when the payroll results changed after calculation", async () => {
    const tampered = activeRevision({ totals: { ...totals, netPay: 99_000_000 } });
    const { result, applied } = await act("approve", baseRun(), {}, tampered);

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_CHECKSUM_MISMATCH", status: 409 }));
    expect(applied).toHaveLength(0);
  });

  it("blocks approval when the run checksum no longer matches the stored revision", async () => {
    const { result } = await act("approve", baseRun({ activeRevisionChecksum: "stale-checksum" }));

    expect(result.code).toBe("PAYROLL_CHECKSUM_MISMATCH");
  });

  it("stops the run creator from approving their own run", async () => {
    const { result, applied } = await act("approve", baseRun({ createdBy: "approver" }));

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_SEPARATION_OF_DUTIES", status: 403 }));
    expect(applied).toHaveLength(0);
  });

  it("refuses to approve while blocking issues remain", async () => {
    const { result } = await act("approve", baseRun({ issues: [{ code: "X", severity: "blocking" }] }));

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_BLOCKING_ISSUES", status: 409 }));
  });

  it("requires a reason to reject and clears the review and approval marks", async () => {
    const missing = await act("reject", baseRun());
    expect(missing.result).toEqual(expect.objectContaining({ code: "PAYROLL_REASON_REQUIRED", status: 400 }));
    expect(missing.applied).toHaveLength(0);

    const rejected = await act("reject", baseRun({ status: "approved" }), { reason: "  sai phụ cấp  " });
    expect(rejected.applied[0]).toEqual({
      expectedVersion: 3, from: "approved", to: "calculated",
      fields: { rejectedBy: "approver", rejectionReason: "sai phụ cấp", reviewedBy: null, approvedBy: null },
    });
    expect(rejected.audits[0].metadata.reason).toBe("sai phụ cấp");
  });

  it("closes an approved run and stamps who closed it", async () => {
    const now = new Date("2026-07-31T10:00:00.000Z");
    const { result, applied } = await act("close", baseRun({ status: "approved" }), { now });

    expect(result.run.status).toBe("closed");
    expect(applied[0].fields).toEqual({ closedBy: "approver", closedAt: now });
  });

  it("rejects every transition out of a closed or paid run", async () => {
    for (const status of ["closed", "partially_paid", "paid"]) {
      const { result, applied } = await act("approve", baseRun({ status }));
      expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_RUN_CLOSED", status: 409, currentVersion: 3 }));
      expect(applied).toHaveLength(0);
    }
  });

  it("rejects a transition from a status the action does not allow", async () => {
    const { result } = await act("close", baseRun({ status: "calculated" }));

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_INVALID_TRANSITION", status: 409 }));
  });

  it("returns the current version when the run moved on before the transition", async () => {
    const { result, applied } = await act("approve", baseRun(), { expectedVersion: 2 });

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_VERSION_CONFLICT", status: 409, currentVersion: 3 }));
    expect(applied).toHaveLength(0);
  });

  it("reports a conflict when the concurrent update wins the write", async () => {
    const result: any = await transitionPayrollRun({
      action: "review",
      actorId: "approver",
      expectedVersion: 3,
      run: { get: async () => baseRun({ status: "calculated" }), apply: async () => null },
      revision: { getActive: async () => activeRevision() },
      audit: vi.fn(),
    });

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_VERSION_CONFLICT", status: 409 }));
  });

  it("refuses to approve a run with no completed calculation revision", async () => {
    const noRevision = await act("approve", baseRun({ activeRevisionId: undefined }));
    expect(noRevision.result.code).toBe("PAYROLL_REVISION_MISSING");

    const running = await act("approve", baseRun(), {}, activeRevision({ status: "running" }));
    expect(running.result.code).toBe("PAYROLL_REVISION_MISSING");
  });

  it("carries the correlation id into the audit trail", async () => {
    const { audits } = await act("review", baseRun({ status: "calculated" }), { correlationId: "trace-9" });

    expect(audits[0].metadata.correlationId).toBe("trace-9");
  });

  it("reports a missing run as not found", async () => {
    const { result } = await act("review", baseRun({ status: "calculated" }), { run: { get: async () => null, apply: async () => null } });

    expect(result).toEqual(expect.objectContaining({ code: "PAYROLL_RUN_NOT_FOUND", status: 404 }));
  });
});
