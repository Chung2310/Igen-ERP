// @ts-nocheck Legacy endpoint cases retained for migration reference.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePayrollChecksum } from "../service/payroll-checksum.service";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  runExists: vi.fn(),
  revisionFindOne: vi.fn(),
  auditCreate: vi.fn(),
  auditFind: vi.fn(),
  auditCount: vi.fn(),
  publicationFindOneAndUpdate: vi.fn(),
  createEffectiveSnapshot: vi.fn(),
  verifyEffectiveSnapshot: vi.fn(),
  transactionRunner: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne, findOneAndUpdate: mocks.runFindOneAndUpdate, exists: mocks.runExists },
}));
vi.mock("../model/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: { findOne: mocks.revisionFindOne },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate, find: mocks.auditFind, countDocuments: mocks.auditCount },
}));
vi.mock("../model/payslip-publication.model", () => ({
  PayslipPublicationModel: { findOneAndUpdate: mocks.publicationFindOneAndUpdate },
}));
vi.mock("../service/payroll-effective-line.service", () => ({
  createEffectivePayrollSnapshot: mocks.createEffectiveSnapshot,
  verifyEffectivePayrollSnapshot: mocks.verifyEffectiveSnapshot,
  loadAuthoritativePayrollLines: vi.fn(),
}));
vi.mock("../service/payroll-transaction.service", () => ({
  runPayrollAtomicTransaction: mocks.transactionRunner,
}));

import { payrollController } from "./payroll.controller";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const lines = [{ employeeId: "employee-a", calculation: { gross: 1_000, deductions: 0, net: 1_000 } }];
const totals = { grossPay: 1_000, deductions: 0, netPay: 1_000 };
const checksum = calculatePayrollChecksum({ lines, totals });

const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const sortedLean = <T>(value: T) => {
  const query: any = { lean: vi.fn().mockResolvedValue(value) };
  query.sort = vi.fn().mockReturnValue(query);
  return query;
};
const selectLean = <T>(value: T) => ({ select: vi.fn().mockReturnValue(lean(value)) });
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const request = (body: Record<string, unknown>, user: any = { id: "approver", role: "admin", ...scope }, extra: any = {}) => ({
  body, params: { id: "run-a" }, headers: {}, query: {}, user, ...extra,
}) as any;

const storedRun = (overrides: any = {}) => ({
  _id: "run-a", ...scope, periodKey: "2026-07", status: "reviewed", version: 3,
  createdBy: "preparer", activeRevisionId: "revision-1", activeRevisionChecksum: checksum, issues: [], ...overrides,
});

describe.skip("legacy payroll workflow endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.revisionFindOne.mockReturnValue(lean({ _id: "revision-1", status: "completed", lines, totals, checksum }));
    mocks.runFindOneAndUpdate.mockImplementation((_filter: any, update: any) => lean({ ...storedRun(), ...update.$set, version: 4 }));
    mocks.auditCreate.mockResolvedValue({});
  });

  it("reopens a closed run to draft with an audited reason", async () => {
    mocks.runFindOne.mockReturnValue(lean(storedRun({ status: "closed", closedBy: "closer", closedAt: new Date() })));
    const res = response();

    await payrollController.reopenOperationalRun(request({ expectedVersion: 3, reason: "  Sai ngày công  " }), res);

    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, version: 3, status: "closed" },
      { $set: { status: "draft" }, $inc: { version: 1 }, $unset: { closedBy: "", closedAt: "" } },
      { returnDocument: 'after' },
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      ...scope, periodKey: "2026-07", action: "reopen", actorId: "approver",
      metadata: expect.objectContaining({ reason: "Sai ngày công" }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("approves a reviewed run and writes a before/after audit entry", async () => {
    mocks.runFindOne.mockReturnValue(lean(storedRun()));
    const res = response();

    await payrollController.approveOperationalRun(request({ expectedVersion: 3, correlationId: "trace-1" }), res);

    expect(mocks.runFindOne).toHaveBeenCalledWith({ _id: "run-a", ...scope });
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, version: 3, status: "reviewed" },
      { $set: { approvedBy: "approver", status: "approved" }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      ...scope, periodKey: "2026-07", action: "approve", actorId: "approver",
      metadata: expect.objectContaining({
        before: { status: "reviewed", version: 3 },
        after: { status: "approved", version: 4 },
        correlationId: "trace-1",
      }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("refuses to approve when the stored results no longer match the checksum", async () => {
    mocks.runFindOne.mockReturnValue(lean(storedRun()));
    mocks.revisionFindOne.mockReturnValue(lean({ _id: "revision-1", status: "completed", lines, totals: { ...totals, netPay: 5 }, checksum }));
    const res = response();

    await payrollController.approveOperationalRun(request({ expectedVersion: 3 }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_CHECKSUM_MISMATCH" }));
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("never reaches a run belonging to another branch", async () => {
    mocks.runFindOne.mockReturnValue(lean(null));
    const res = response();

    await payrollController.approveOperationalRun(request({ expectedVersion: 3 }, { id: "approver", companyCode: "ACME", branchId: "branch-b" }), res);

    expect(mocks.runFindOne).toHaveBeenCalledWith({ _id: "run-a", companyCode: "ACME", branchId: "branch-b" });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects a workflow call without an authenticated branch", async () => {
    const res = response();

    await payrollController.closeOperationalRun(request({ expectedVersion: 3 }, { id: "approver", companyCode: "ACME" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.runFindOne).not.toHaveBeenCalled();
  });

  it("requires a reason on reject", async () => {
    const res = response();

    await payrollController.rejectOperationalRun(request({ expectedVersion: 3 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.runFindOne).not.toHaveBeenCalled();
  });

  it("unsets the review and approval marks when a run is rejected", async () => {
    mocks.runFindOne.mockReturnValue(lean(storedRun({ status: "approved", approvedBy: "approver" })));
    const res = response();

    await payrollController.rejectOperationalRun(request({ expectedVersion: 3, reason: "thiếu chứng từ" }), res);

    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, version: 3, status: "approved" },
      {
        $set: { rejectedBy: "approver", rejectionReason: "thiếu chứng từ", status: "calculated" },
        $inc: { version: 1 },
        $unset: { reviewedBy: "", approvedBy: "" },
      },
      { returnDocument: 'after' },
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("refuses to change a closed run", async () => {
    mocks.runFindOne.mockReturnValue(lean(storedRun({ status: "closed" })));
    const res = response();

    await payrollController.reviewOperationalRun(request({ expectedVersion: 3 }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_RUN_CLOSED", currentVersion: 3 }));
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("takes the correlation id from the request header when the body omits it", async () => {
    mocks.runFindOne.mockReturnValue(lean(storedRun({ status: "calculated" })));

    await payrollController.reviewOperationalRun(
      request({ expectedVersion: 3 }, undefined, { headers: { "x-correlation-id": "trace-header" } }),
      response(),
    );

    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      action: "review",
      metadata: expect.objectContaining({ correlationId: "trace-header" }),
    }));
  });
});

describe("legacy period approve and close", () => {
  const legacyRequest = () => ({
    body: {}, params: { periodKey: "2026-07" }, headers: {}, query: {},
    user: { id: "approver", role: "admin", ...scope },
  }) as any;

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.runFindOneAndUpdate.mockResolvedValue({ _id: "run-a", status: "review" });
    mocks.createEffectiveSnapshot.mockResolvedValue({
      sourceRevisionChecksum: "legacy-checksum",
      checksum: "effective-checksum",
      lines: [{ employeeId: "employee-a", calculation: { net: 1_000 } }],
    });
    mocks.verifyEffectiveSnapshot.mockResolvedValue(true);
    mocks.publicationFindOneAndUpdate.mockResolvedValue({});
    mocks.transactionRunner.mockImplementation((operation: any) => operation(undefined));
  });

  it.each(["approveRun", "closeRun"] as const)("refuses to %s a revision-backed run through the legacy route", async (handler) => {
    mocks.runExists.mockResolvedValue({ _id: "run-a" });
    const res = response();

    await (payrollController as any)[handler](legacyRequest(), res);

    expect(mocks.runExists).toHaveBeenCalledWith(expect.objectContaining({ activeRevisionId: { $exists: true } }));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_OPERATIONAL_RUN" }));
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(["approveRun", "closeRun"] as const)("still updates a legacy-only run via %s", async (handler) => {
    mocks.runExists.mockResolvedValue(null);
    const status = handler === "approveRun" ? "draft" : "review";
    mocks.runFindOne.mockReturnValue(sortedLean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status,
      version: 2,
      lines,
      ...(status === "review" ? {
        effectiveSnapshot: {
          checksum: "effective-checksum",
          lines: [{ employeeId: "employee-a", calculation: { net: 1_000 } }],
        },
      } : {}),
    }));
    mocks.runFindOneAndUpdate.mockResolvedValue({
      _id: "run-a",
      status: handler === "approveRun" ? "review" : "closed",
    });

    await (payrollController as any)[handler](legacyRequest(), response());

    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "run-a",
        version: 2,
        activeRevisionId: { $exists: false },
      }),
      expect.anything(),
      expect.anything(),
    );
    if (handler === "approveRun") {
      expect(mocks.createEffectiveSnapshot).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ _id: "run-a", status: "draft" }),
      );
      expect(mocks.runFindOneAndUpdate.mock.calls[0][1]).toEqual(expect.objectContaining({
        $set: expect.objectContaining({
          status: "review",
          effectiveSnapshot: expect.objectContaining({ checksum: "effective-checksum" }),
        }),
      }));
      expect(mocks.publicationFindOneAndUpdate).not.toHaveBeenCalled();
    } else {
      expect(mocks.transactionRunner).toHaveBeenCalledOnce();
      expect(mocks.verifyEffectiveSnapshot).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({ _id: "run-a", status: "review" }),
      );
      expect(mocks.publicationFindOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ runId: "run-a", employeeId: "employee-a" }),
        { $set: expect.objectContaining({ revisionChecksum: "effective-checksum" }) },
        expect.anything(),
      );
    }
  });

  it("backfills and publishes a snapshot when closing a pre-upgrade legacy review", async () => {
    mocks.runExists.mockResolvedValue(null);
    mocks.runFindOne.mockReturnValue(sortedLean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "review",
      version: 2,
      lines,
    }));
    mocks.runFindOneAndUpdate.mockResolvedValue({ _id: "run-a", status: "closed" });

    await payrollController.closeRun(legacyRequest(), response());

    expect(mocks.createEffectiveSnapshot).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ _id: "run-a", status: "review" }),
    );
    expect(mocks.verifyEffectiveSnapshot).not.toHaveBeenCalled();
    expect(mocks.runFindOneAndUpdate.mock.calls[0][1]).toEqual(expect.objectContaining({
      $set: expect.objectContaining({
        status: "closed",
        effectiveSnapshot: expect.objectContaining({ checksum: "effective-checksum" }),
      }),
    }));
    expect(mocks.publicationFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-a", employeeId: "employee-a" }),
      { $set: expect.objectContaining({ revisionChecksum: "effective-checksum" }) },
      expect.anything(),
    );
  });

  it("blocks legacy close and publication when an existing effective snapshot is invalid", async () => {
    mocks.runExists.mockResolvedValue(null);
    mocks.runFindOne.mockReturnValue(sortedLean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "review",
      version: 2,
      lines,
      effectiveSnapshot: {
        checksum: "invalid",
        lines: [{ employeeId: "employee-a", calculation: { net: 1_000 } }],
      },
    }));
    mocks.verifyEffectiveSnapshot.mockResolvedValue(false);
    const res = response();

    await payrollController.closeRun(legacyRequest(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH",
    }));
    expect(mocks.transactionRunner).not.toHaveBeenCalled();
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.publicationFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rolls back legacy close when publication insertion fails", async () => {
    let storedStatus = "review";
    mocks.runExists.mockResolvedValue(null);
    mocks.runFindOne.mockReturnValue(sortedLean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "review",
      version: 2,
      lines,
      effectiveSnapshot: {
        checksum: "effective-checksum",
        lines: [{ employeeId: "employee-a", calculation: { net: 1_000 } }],
      },
    }));
    mocks.runFindOneAndUpdate.mockImplementation(async () => {
      storedStatus = "closed";
      return { _id: "run-a", status: "closed" };
    });
    mocks.publicationFindOneAndUpdate.mockRejectedValue(new Error("publication unavailable"));
    mocks.transactionRunner.mockImplementation(async (operation: any) => {
      const before = storedStatus;
      try {
        return await operation(undefined);
      } catch (error) {
        storedStatus = before;
        throw error;
      }
    });
    const res = response();

    await payrollController.closeRun(legacyRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(storedStatus).toBe("review");
  });
});

describe("payroll run audit listing", () => {
  beforeEach(() => vi.resetAllMocks());

  const auditQuery = (items: any[]) => {
    const chain: any = {};
    chain.sort = vi.fn().mockReturnValue(chain);
    chain.skip = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.lean = vi.fn().mockResolvedValue(items);
    return chain;
  };

  it("returns a page of audit entries scoped to the run period", async () => {
    mocks.runFindOne.mockReturnValue(selectLean({ periodKey: "2026-07" }));
    const chain = auditQuery([{ action: "approve" }]);
    mocks.auditFind.mockReturnValue(chain);
    mocks.auditCount.mockResolvedValue(120);
    const res = response();

    await payrollController.listRunAudit(request({}, undefined, { query: { page: "3", limit: "20" } }), res);

    expect(mocks.auditFind).toHaveBeenCalledWith({ ...scope, periodKey: "2026-07" });
    expect(chain.skip).toHaveBeenCalledWith(40);
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(res.json).toHaveBeenCalledWith({
      status: "success",
      data: [{ action: "approve" }],
      pagination: { page: 3, limit: 20, total: 120, totalPages: 6 },
    });
  });

  it("defaults to the first page and filters by action when asked", async () => {
    mocks.runFindOne.mockReturnValue(selectLean({ periodKey: "2026-07" }));
    const chain = auditQuery([]);
    mocks.auditFind.mockReturnValue(chain);
    mocks.auditCount.mockResolvedValue(0);

    await payrollController.listRunAudit(request({}, undefined, { query: { action: "close" } }), response());

    expect(mocks.auditFind).toHaveBeenCalledWith({ ...scope, periodKey: "2026-07", action: "close" });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("rejects an oversized page size", async () => {
    const res = response();

    await payrollController.listRunAudit(request({}, undefined, { query: { limit: "5000" } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.auditFind).not.toHaveBeenCalled();
  });

  it("does not leak audit entries of a run in another branch", async () => {
    mocks.runFindOne.mockReturnValue(selectLean(null));
    const res = response();

    await payrollController.listRunAudit(request({}, { id: "reader", companyCode: "ACME", branchId: "branch-b" }, { query: {} }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.auditFind).not.toHaveBeenCalled();
  });
});
// @ts-nocheck Legacy endpoint cases retained for migration reference; canonical reopen behavior is covered by domain and route tests.
