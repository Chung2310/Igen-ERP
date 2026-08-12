import { describe, expect, it } from "vitest";
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
  const result: any = await transitionPayrollRun({
    action, actorId: "manager", expectedVersion: 3, reason,
    run: {
      get: async () => run(status),
      apply: async (_version, from, to, fields) => {
        applied.push({ from, to, fields });
        return { ...run(status), ...fields, status: to, version: 4 };
      },
    },
    revision: { getActive: async () => revision },
    audit: async (entry) => { audits.push(entry); },
  });
  return { result, applied, audits };
}

describe("canonical payroll workflow", () => {
  it("moves draft through review to closed", async () => {
    expect((await act("review", "draft")).result.run.status).toBe("review");
    expect((await act("close", "review")).result.run.status).toBe("closed");
  });

  it.each(["review", "closed"])("reopens %s to draft and audits the trimmed reason", async (status) => {
    const { result, applied, audits } = await act("reopen", status, "  Sai ngày công  ");
    expect(result.run.status).toBe("draft");
    expect(applied[0]).toMatchObject({ from: status, to: "draft", fields: { closedBy: null, closedAt: null } });
    expect(audits[0]).toEqual(expect.objectContaining({ action: "reopen", metadata: expect.objectContaining({ reason: "Sai ngày công" }) }));
  });

  it("requires a reason to reopen", async () => {
    expect((await act("reopen", "closed", "   ")).result).toMatchObject({ code: "PAYROLL_REOPEN_REASON_REQUIRED", status: 400 });
  });

  it("never reopens paid", async () => {
    expect((await act("reopen", "paid", "Sửa lại")).result).toMatchObject({ code: "PAYROLL_PAID_RUN_IMMUTABLE", status: 409 });
  });
});
