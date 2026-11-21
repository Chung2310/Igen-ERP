import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  revisionFindOne: vi.fn(),
  paymentFindOne: vi.fn(),
  paymentFind: vi.fn(),
  paymentCreate: vi.fn(),
  paymentFindOneAndUpdate: vi.fn(),
  auditCreate: vi.fn(),
  lineOverrideFind: vi.fn(),
  transactionRunner: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne, findOneAndUpdate: mocks.runFindOneAndUpdate },
}));
vi.mock("../model/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: { findOne: mocks.revisionFindOne },
}));
vi.mock("../model/payroll-payment.model", () => ({
  PayrollPaymentModel: {
    findOne: mocks.paymentFindOne,
    find: mocks.paymentFind,
    create: mocks.paymentCreate,
    findOneAndUpdate: mocks.paymentFindOneAndUpdate,
  },
}));
vi.mock("../model/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.auditCreate } }));
vi.mock("../model/payroll-line-override.model", () => ({
  PayrollLineOverrideModel: { find: mocks.lineOverrideFind },
}));
vi.mock("../service/payroll-transaction.service", () => ({
  runPayrollAtomicTransaction: mocks.transactionRunner,
}));

import { payrollController } from "./payroll.controller";
import { calculatePayrollChecksum } from "../service/payroll-checksum.service";
import { calculateEffectivePayrollChecksum } from "../service/payroll-effective-line.service";
import { projectPayrollRevisionWithOverrides } from "../service/payroll-run-calculate-operations.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLean = <T>(value: T) => ({ select: vi.fn().mockReturnValue(lean(value)) });
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const request = (body: any, params: any = { id: "run-a" }, user: any = { id: "cashier", role: "admin", ...scope }, headers: any = {}) =>
  ({ body, params, headers, query: {}, user }) as any;

const revisionLines = [
  { employeeId: "emp-1", calculation: { monthlySalary: 10_000_000, adjustedBase: 10_000_000, gross: 10_000_000, net: 10_000_000 } },
  { employeeId: "emp-2", calculation: { monthlySalary: 6_000_000, adjustedBase: 6_000_000, gross: 6_000_000, net: 6_000_000 } },
];
const revisionTotals = { grossPay: 16_000_000, deductions: 0, netPay: 16_000_000 };
const revisionChecksum = calculatePayrollChecksum({ lines: revisionLines, totals: revisionTotals });
const effectiveLines = projectPayrollRevisionWithOverrides({ lines: revisionLines }, []).effectiveLines;
const effectiveSnapshot = {
  sourceRevisionId: "revision-1",
  sourceRevisionChecksum: revisionChecksum,
  checksum: calculateEffectivePayrollChecksum(revisionChecksum, effectiveLines),
  lines: effectiveLines,
  pinnedAt: new Date("2026-08-01T00:00:00.000Z"),
};
const closedRun = (overrides: any = {}) => ({
  _id: "run-a", ...scope, periodKey: "2026-07", status: "closed",
  type: "regular", activeRevisionId: "revision-1", activeRevisionChecksum: revisionChecksum,
  version: 8, lines: [], effectiveSnapshot, ...overrides,
});
const validBody = (overrides: any = {}) => ({
  amount: 16_000_000, idempotencyKey: "pay-1",
  lines: [{ employeeId: "emp-1", amount: 10_000_000 }, { employeeId: "emp-2", amount: 6_000_000 }],
  ...overrides,
});

const arrangeRun = (run: any = closedRun(), confirmed: any[] = []) => {
  mocks.paymentFindOne.mockReturnValue(lean(null));
  mocks.runFindOne.mockReturnValue(lean(run));
  mocks.revisionFindOne.mockReturnValue(lean({
    _id: "revision-1",
    runId: "run-a",
    status: "completed",
    lines: revisionLines,
    totals: revisionTotals,
    checksum: revisionChecksum,
  }));
  mocks.lineOverrideFind.mockReturnValue(lean([]));
  mocks.paymentFind.mockReturnValue(selectLean(confirmed));
  mocks.paymentCreate.mockImplementation(async (value: any) => ({ _id: "payment-1", ...value }));
  mocks.auditCreate.mockResolvedValue({});
};

describe("creating a payroll payment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionRunner.mockImplementation((operation: any) => operation(undefined));
  });

  it("allocates against the active calculation revision, not the legacy run lines", async () => {
    arrangeRun(closedRun({ lines: [{ employeeId: "legacy", calculation: { net: 1 } }] }));
    const res = response();

    await payrollController.createPayment(request(validBody()), res);

    expect(mocks.revisionFindOne).toHaveBeenCalledWith({ _id: "revision-1", runId: "run-a", ...scope });
    expect(mocks.paymentCreate).toHaveBeenCalledWith(expect.objectContaining({
      ...scope, runId: "run-a", amount: 16_000_000, status: "draft", createdBy: "cashier",
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("limits settlement against the pinned effective override net instead of the immutable system net", async () => {
    arrangeRun(closedRun({
      effectiveSnapshot: {
        sourceRevisionId: "revision-1",
        sourceRevisionChecksum: revisionChecksum,
        checksum: "placeholder",
        lines: [],
      },
    }));
    const { createPayrollEffectiveLineLoader } = await import("../service/payroll-effective-line.service");
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => ({
        _id: "revision-1", runId: "run-a", status: "completed",
        lines: revisionLines, totals: revisionTotals, checksum: revisionChecksum,
      }),
      getOverrides: async () => [{ employeeId: "emp-1", adjustedBase: 8_000_000, version: 2 }],
    });
    const effectiveSnapshot = await loader.createSnapshot(scope, closedRun({ status: "draft" }));
    mocks.runFindOne.mockReturnValue(lean(closedRun({ effectiveSnapshot })));
    const res = response();

    await payrollController.createPayment(request(validBody()), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_PAYMENT_EXCEEDS_NET" }));
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("falls back to the legacy run lines when the run has no revision", async () => {
    arrangeRun(closedRun({
      activeRevisionId: undefined,
      activeRevisionChecksum: undefined,
      effectiveSnapshot: undefined,
      lines: revisionLines,
    }));

    await payrollController.createPayment(request(validBody()), response());

    expect(mocks.revisionFindOne).not.toHaveBeenCalled();
    expect(mocks.paymentCreate).toHaveBeenCalled();
  });

  it("counts earlier confirmed payments so the run cannot be overpaid", async () => {
    arrangeRun(closedRun(), [
      { status: "confirmed", lines: [{ employeeId: "emp-1", amount: 10_000_000 }] },
    ]);
    const res = response();

    await payrollController.createPayment(request(validBody()), res);

    expect(mocks.paymentFind).toHaveBeenCalledWith({ ...scope, runId: "run-a", status: "confirmed" });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_PAYMENT_EXCEEDS_NET" }));
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("refuses to pay a run that is not closed yet", async () => {
    arrangeRun(closedRun({ status: "review" }));
    const res = response();

    await payrollController.createPayment(request(validBody()), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_RUN_NOT_PAYABLE" }));
  });

  it("stores the payment date and evidence url", async () => {
    arrangeRun();

    await payrollController.createPayment(request(validBody({
      paymentDate: "2026-08-05T00:00:00.000Z", evidenceUrl: "https://bank.example.com/receipt/9", note: "đợt 1",
    })), response());

    expect(mocks.paymentCreate).toHaveBeenCalledWith(expect.objectContaining({
      paymentDate: new Date("2026-08-05T00:00:00.000Z"),
      evidenceUrl: "https://bank.example.com/receipt/9",
      note: "đợt 1",
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      action: "payment",
      metadata: expect.objectContaining({ operation: "create_payment", amount: 16_000_000, evidenceUrl: "https://bank.example.com/receipt/9" }),
    }));
  });

  it("rejects a non-http evidence url", async () => {
    arrangeRun();
    const res = response();

    await payrollController.createPayment(request(validBody({ evidenceUrl: "javascript:alert(1)" })), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.paymentCreate).not.toHaveBeenCalled();
  });

  it("replays the stored payment for a repeated idempotency key", async () => {
    mocks.paymentFindOne.mockReturnValue(lean({ _id: "payment-1", runId: "run-a", amount: 16_000_000, status: "draft" }));
    const res = response();

    await payrollController.createPayment(request(validBody()), res);

    expect(mocks.paymentCreate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("rejects reusing an idempotency key for a different run or amount", async () => {
    mocks.paymentFindOne.mockReturnValue(lean({ _id: "payment-1", runId: "run-b", amount: 16_000_000 }));
    const res = response();

    await payrollController.createPayment(request(validBody()), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_IDEMPOTENCY_CONFLICT" }));
  });

  it("cannot reach a run in another branch", async () => {
    mocks.paymentFindOne.mockReturnValue(lean(null));
    mocks.runFindOne.mockReturnValue(lean(null));
    const res = response();

    await payrollController.createPayment(request(validBody(), { id: "run-a" }, { id: "cashier", companyCode: "ACME", branchId: "branch-b" }), res);

    expect(mocks.runFindOne).toHaveBeenCalledWith({ _id: "run-a", companyCode: "ACME", branchId: "branch-b" });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects a malformed payload before touching the database", async () => {
    const res = response();

    await payrollController.createPayment(request({ amount: 0, idempotencyKey: "", lines: [] }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.paymentFindOne).not.toHaveBeenCalled();
  });
});

describe("payment lifecycle transitions", () => {
  const draftPayment = (overrides: any = {}) => ({
    _id: "payment-1", ...scope, runId: "run-a", amount: 10_000_000, status: "draft",
    lines: [{ employeeId: "emp-1", amount: 10_000_000 }], ...overrides,
  });

  const arrangeTransition = (payment: any, run: any, confirmedBefore: any[]) => {
    mocks.paymentFindOne.mockReturnValue(lean(payment));
    mocks.paymentFindOneAndUpdate.mockImplementation((_filter: any, update: any) => lean({ ...payment, ...update.$set }));
    mocks.runFindOne.mockReturnValue(lean(run));
    mocks.runFindOneAndUpdate.mockImplementation((_filter: any, update: any) => lean({
      ...run,
      version: update.$inc ? Number(run.version) + 1 : Number(run.version) + 1,
      ...(update.$set ?? {}),
    }));
    mocks.revisionFindOne.mockReturnValue(lean({
      _id: "revision-1",
      runId: "run-a",
      status: "completed",
      lines: revisionLines,
      totals: revisionTotals,
      checksum: revisionChecksum,
    }));
    mocks.lineOverrideFind.mockReturnValue(lean([]));
    mocks.paymentFind.mockReturnValue(selectLean(confirmedBefore));
    mocks.auditCreate.mockResolvedValue({});
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionRunner.mockImplementation((operation: any) => operation(undefined));
  });

  it("revalidates the payable balance before confirming so parallel drafts cannot overpay", async () => {
    arrangeTransition(
      draftPayment({
        amount: 16_000_000,
        lines: [
          { employeeId: "emp-1", amount: 10_000_000 },
          { employeeId: "emp-2", amount: 6_000_000 },
        ],
      }),
      closedRun(),
      [{
        _id: "payment-2",
        status: "confirmed",
        lines: [
          { employeeId: "emp-1", amount: 10_000_000 },
          { employeeId: "emp-2", amount: 6_000_000 },
        ],
      }],
    );
    const res = response();

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_PAYMENT_EXCEEDS_NET" }));
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not confirm a payment after the payroll run leaves closed status", async () => {
    arrangeTransition(draftPayment(), closedRun({ status: "review" }), []);
    const res = response();

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_RUN_NOT_PAYABLE" }));
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("confirming a part of the payroll keeps the run closed", async () => {
    arrangeTransition(draftPayment(), closedRun(), [
    ]);
    const res = response();

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), res);

    expect(mocks.paymentFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "payment-1", ...scope, status: "draft" },
      { $set: expect.objectContaining({ status: "confirmed", confirmedBy: "cashier", confirmedAt: expect.any(Date), paymentDate: expect.any(Date) }) },
      { returnDocument: 'after' },
    );
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, status: "closed", version: 8 },
      { $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success", runStatus: "closed" }));
  });

  it("confirming the last outstanding amount moves the run to paid", async () => {
    arrangeTransition(draftPayment({ amount: 6_000_000, lines: [{ employeeId: "emp-2", amount: 6_000_000 }] }), closedRun(), [
      { status: "confirmed", lines: [{ employeeId: "emp-1", amount: 10_000_000 }] },
    ]);

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), response());

    expect(mocks.runFindOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: "run-a", ...scope, status: "closed", version: 9 },
      { $set: { status: "paid" } },
      { returnDocument: 'after' },
    );
  });

  it("sums duplicate employee allocations when deriving the paid run status", async () => {
    arrangeTransition(draftPayment({
      amount: 16_000_000,
      lines: [
        { employeeId: "emp-1", amount: 4_000_000 },
        { employeeId: "emp-1", amount: 6_000_000 },
        { employeeId: "emp-2", amount: 6_000_000 },
      ],
    }), closedRun(), []);

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), response());

    expect(mocks.runFindOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: "run-a", ...scope, status: "closed", version: 9 },
      { $set: { status: "paid" } },
      { returnDocument: 'after' },
    );
  });

  it("reversing a confirmed payment returns the run to closed and records before/after", async () => {
    arrangeTransition(draftPayment({ status: "confirmed" }), closedRun({ status: "paid" }), []);

    await payrollController.reversePayment(request({ correlationId: "trace-pay" }, { id: "payment-1" }), response());

    expect(mocks.paymentFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "payment-1", ...scope, status: "confirmed" },
      { $set: expect.objectContaining({ status: "reversed", reversedBy: "cashier", reversedAt: expect.any(Date) }) },
      { returnDocument: 'after' },
    );
    expect(mocks.runFindOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: "run-a", ...scope, status: "paid", version: 9 },
      { $set: { status: "closed" } },
      { returnDocument: 'after' },
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      action: "payment",
      metadata: expect.objectContaining({
        operation: "reverse_payment",
        before: { paymentStatus: "confirmed", runStatus: "paid" },
        after: { paymentStatus: "reversed", runStatus: "closed" },
        correlationId: "trace-pay",
      }),
    }));
  });

  it.each(["draft", "review"])("does not reverse a confirmed payment while its run is %s", async (status) => {
    const payment = draftPayment({ status: "confirmed" });
    arrangeTransition(payment, closedRun({ status }), [{
      status: "confirmed",
      lines: payment.lines,
    }]);
    const res = response();

    await payrollController.reversePayment(request({}, { id: "payment-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "PAYROLL_PAYMENT_RUN_STATE_INVALID",
    }));
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("cancelling a draft payment leaves the run status untouched", async () => {
    arrangeTransition(draftPayment(), closedRun(), []);

    await payrollController.cancelPayment(request({}, { id: "payment-1" }), response());

    expect(mocks.paymentFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "payment-1", ...scope, status: "draft" },
      { $set: expect.objectContaining({ status: "cancelled", cancelledBy: "cashier", cancelledAt: expect.any(Date) }) },
      { returnDocument: 'after' },
    );
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("refuses an invalid transition without writing anything", async () => {
    mocks.paymentFindOne.mockReturnValue(lean(draftPayment({ status: "cancelled" })));
    const res = response();

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_PAYMENT_INVALID_TRANSITION" }));
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not transition a payment from another branch", async () => {
    mocks.paymentFindOne.mockReturnValue(lean(null));
    const res = response();

    await payrollController.confirmPayment(request({}, { id: "payment-1" }, { id: "cashier", companyCode: "ACME", branchId: "branch-b" }), res);

    expect(mocks.paymentFindOne).toHaveBeenCalledWith({ _id: "payment-1", companyCode: "ACME", branchId: "branch-b" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.paymentFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("reports a conflict when a concurrent request already moved the payment", async () => {
    arrangeTransition(draftPayment(), closedRun(), []);
    mocks.paymentFindOneAndUpdate.mockReturnValue(lean(null));
    const res = response();

    await payrollController.confirmPayment(request({}, { id: "payment-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("uses the supplied confirmation date over the current time", async () => {
    arrangeTransition(draftPayment(), closedRun(), []);

    await payrollController.confirmPayment(request({ paymentDate: "2026-08-10T03:00:00.000Z" }, { id: "payment-1" }), response());

    expect(mocks.paymentFindOneAndUpdate.mock.calls[0][1].$set.paymentDate).toEqual(new Date("2026-08-10T03:00:00.000Z"));
  });
});
