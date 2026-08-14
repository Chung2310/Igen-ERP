import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  paymentExists: vi.fn(),
  auditCreate: vi.fn(),
  revisionFindOne: vi.fn(),
  createEffectiveSnapshot: vi.fn(),
  verifyEffectiveSnapshot: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: {
    findOne: mocks.runFindOne,
    findOneAndUpdate: mocks.runFindOneAndUpdate,
  },
}));
vi.mock("../model/payroll-payment.model", () => ({
  PayrollPaymentModel: { exists: mocks.paymentExists },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate },
}));
vi.mock("../model/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: { findOne: mocks.revisionFindOne },
}));
vi.mock("./payroll-effective-line.service", () => ({
  createEffectivePayrollSnapshot: mocks.createEffectiveSnapshot,
  verifyEffectivePayrollSnapshot: mocks.verifyEffectiveSnapshot,
}));

import { createPayrollRunWorkflowOperations } from "./payroll-run-workflow-operations.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
let runPayrollWorkflowAction: ReturnType<typeof createPayrollRunWorkflowOperations>;

describe("payroll workflow payment invariants", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    runPayrollWorkflowAction = createPayrollRunWorkflowOperations({
      transactionRunner: async (operation) => operation(undefined),
    });
  });

  it("queries confirmed allocations and blocks reopening before mutating the run", async () => {
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      status: "closed",
      version: 3,
      issues: [],
    }));
    mocks.paymentExists.mockResolvedValue({ _id: "payment-a" });

    await expect(runPayrollWorkflowAction(
      scope,
      "run-a",
      "manager-a",
      "reopen",
      { expectedVersion: 3, reason: "Recalculate" },
    )).rejects.toMatchObject({
      code: "PAYROLL_CONFIRMED_PAYMENTS_EXIST",
      status: 409,
      currentVersion: 3,
    });

    expect(mocks.paymentExists).toHaveBeenCalledWith({
      ...scope,
      runId: "run-a",
      status: "confirmed",
    });
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rolls back the workflow transition when its audit write fails", async () => {
    const session = { id: "workflow-session" } as any;
    let state: any = {
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      status: "draft",
      version: 1,
      issues: [],
    };
    const runSession = vi.fn().mockReturnValue({ lean: vi.fn(async () => ({ ...state })) });
    mocks.runFindOne.mockReturnValue({ session: runSession, lean: vi.fn() });
    const updateLean = vi.fn(async () => {
      state = { ...state, status: "review", version: 2, effectiveSnapshot: { checksum: "effective" } };
      return { ...state };
    });
    mocks.runFindOneAndUpdate.mockReturnValue({ lean: updateLean });
    mocks.createEffectiveSnapshot.mockResolvedValue({ checksum: "effective", lines: [] });
    mocks.auditCreate.mockRejectedValue(new Error("audit unavailable"));
    const transactionRunner = vi.fn(async (operation: (received?: any) => Promise<unknown>) => {
      const before = { ...state };
      try {
        return await operation(session);
      } catch (error) {
        state = before;
        throw error;
      }
    });
    runPayrollWorkflowAction = createPayrollRunWorkflowOperations({
      transactionRunner: transactionRunner as any,
    });

    await expect(runPayrollWorkflowAction(
      scope,
      "run-a",
      "manager-a",
      "review",
      { expectedVersion: 1 },
    )).rejects.toThrow("audit unavailable");

    expect(state).toMatchObject({ status: "draft", version: 1 });
    expect(transactionRunner).toHaveBeenCalledOnce();
    expect(runSession).toHaveBeenCalledWith(session);
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, version: 1, status: "draft" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "review" }),
        $inc: { version: 1 },
      }),
      { new: true, session },
    );
    expect(mocks.createEffectiveSnapshot).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ _id: "run-a", status: "draft" }),
      session,
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ ...scope, periodKey: "2026-07", actorId: "manager-a", action: "review" })],
      { session },
    );
  });
});
