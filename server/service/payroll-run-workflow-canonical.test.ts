import { describe, expect, it, vi } from "vitest";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { transitionPayrollRun, type PayrollWorkflowAction } from "./payroll-run-workflow.service";

const lines = [{ employeeId: "employee-a", calculation: { net: 12_000_000 } }];
const totals = { grossPay: 12_000_000, deductions: 0, netPay: 12_000_000 };
const checksum = calculatePayrollChecksum({ lines, totals });
const revision = { status: "completed", lines, totals, checksum };
const run = (status: string) => ({ _id: "run-a", version: 3, status, activeRevisionId: "rev-1", activeRevisionChecksum: checksum, issues: [] });

async function act(action: PayrollWorkflowAction, status: string, reason?: string) {
  const applied: any[] = [];
  const audits: any[] = [];
  const effectiveSnapshot = {
    sourceRevisionId: "rev-1",
    sourceRevisionChecksum: checksum,
    checksum: "effective-checksum",
    lines: [{ employeeId: "employee-a", calculation: { net: 11_000_000 }, overrideVersion: 2 }],
  };
  const pin = vi.fn(async () => effectiveSnapshot);
  const verify = vi.fn(async () => true);
  const storedRun = {
    ...run(status),
    ...(["review", "closed"].includes(status) ? { effectiveSnapshot } : {}),
  };
  const result: any = await transitionPayrollRun({
    action, actorId: "manager", expectedVersion: 3, reason,
    run: {
      get: async () => storedRun,
      apply: async (_version, from, to, fields) => {
        applied.push({ from, to, fields });
        return { ...storedRun, ...fields, status: to, version: 4 };
      },
    },
    revision: { getActive: async () => revision },
    effective: { pin, verify },
    audit: async (entry) => { audits.push(entry); },
  });
  return { result, applied, audits, effectiveSnapshot, pin, verify };
}

describe("canonical payroll workflow", () => {
  it("moves draft through review to closed", async () => {
    const reviewed = await act("review", "draft");
    expect(reviewed.result.run.status).toBe("review");
    expect(reviewed.pin).toHaveBeenCalledOnce();
    expect(reviewed.applied[0].fields.effectiveSnapshot).toEqual(reviewed.effectiveSnapshot);

    const closed = await act("close", "review");
    expect(closed.result.run.status).toBe("closed");
    expect(closed.verify).toHaveBeenCalledOnce();
  });

  it("refuses to close when the pinned effective snapshot checksum is invalid", async () => {
    const applied: any[] = [];
    const result: any = await transitionPayrollRun({
      action: "close",
      actorId: "manager",
      expectedVersion: 3,
      run: {
        get: async () => ({ ...run("review"), effectiveSnapshot: { checksum: "invalid" } }),
        apply: async (...args) => { applied.push(args); return null; },
      },
      revision: { getActive: async () => revision },
      effective: { pin: async () => ({}), verify: async () => false },
      audit: async () => undefined,
    });

    expect(result).toMatchObject({ code: "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH", status: 409 });
    expect(applied).toHaveLength(0);
  });

  it("pins a compatibility snapshot when closing a pre-upgrade review run", async () => {
    const compatibilitySnapshot = {
      sourceRevisionId: "rev-1",
      sourceRevisionChecksum: checksum,
      checksum: "compatibility-effective-checksum",
      lines,
    };
    const pin = vi.fn(async () => compatibilitySnapshot);
    const verify = vi.fn(async () => false);
    const apply = vi.fn(async (_version, _from, to, fields) => ({
      ...run("review"),
      ...fields,
      status: to,
      version: 4,
    }));

    const result: any = await transitionPayrollRun({
      action: "close",
      actorId: "manager",
      expectedVersion: 3,
      run: { get: async () => run("review"), apply },
      revision: { getActive: async () => revision },
      effective: { pin, verify },
      audit: async () => undefined,
    });

    expect(result.run.status).toBe("closed");
    expect(pin).toHaveBeenCalledOnce();
    expect(verify).not.toHaveBeenCalled();
    expect(apply.mock.calls[0][3]).toEqual(expect.objectContaining({
      effectiveSnapshot: compatibilitySnapshot,
    }));
  });

  it.each(["review", "closed"])("reopens %s to draft and audits the trimmed reason", async (status) => {
    const { result, applied, audits } = await act("reopen", status, "  Sai ngày công  ");
    expect(result.run.status).toBe("draft");
    expect(applied[0]).toMatchObject({
      from: status,
      to: "draft",
      fields: { closedBy: null, closedAt: null, effectiveSnapshot: null },
    });
    expect(audits[0]).toEqual(expect.objectContaining({ action: "reopen", metadata: expect.objectContaining({ reason: "Sai ngày công" }) }));
  });

  it("does not reopen a run while it has confirmed payment allocations", async () => {
    const apply = vi.fn();
    const result: any = await transitionPayrollRun({
      action: "reopen",
      actorId: "manager",
      expectedVersion: 3,
      reason: "Recalculate",
      run: { get: async () => run("closed"), apply },
      revision: { getActive: async () => revision },
      effective: { pin: async () => ({}), verify: async () => true },
      hasConfirmedPayments: async () => true,
      audit: async () => undefined,
    } as any);

    expect(result).toMatchObject({
      code: "PAYROLL_CONFIRMED_PAYMENTS_EXIST",
      status: 409,
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("requires a reason to reopen", async () => {
    expect((await act("reopen", "closed", "   ")).result).toMatchObject({ code: "PAYROLL_REOPEN_REASON_REQUIRED", status: 400 });
  });

  it("never reopens paid", async () => {
    expect((await act("reopen", "paid", "Sửa lại")).result).toMatchObject({ code: "PAYROLL_PAID_RUN_IMMUTABLE", status: 409 });
  });
  it("marks only a closed run as paid and audits the final transition", async () => {
    const { result, applied, audits } = await act("markPaid", "closed");

    expect(result.run.status).toBe("paid");
    expect(applied[0]).toMatchObject({ from: "closed", to: "paid", fields: { paidBy: "manager" } });
    expect(applied[0].fields.paidAt).toBeInstanceOf(Date);
    expect(audits[0]).toEqual(expect.objectContaining({
      action: "mark_paid",
      metadata: expect.objectContaining({ operation: "markPaid" }),
    }));
  });

  it.each(["draft", "review"])("does not mark a %s run as paid", async (status) => {
    const { result, applied, audits } = await act("markPaid", status);
    expect(result).toMatchObject({ code: "PAYROLL_INVALID_TRANSITION", status: 409 });
    expect(applied).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });
});
