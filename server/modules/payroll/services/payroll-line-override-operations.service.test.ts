import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  overrideFind: vi.fn(),
  overrideFindOne: vi.fn(),
  overrideFindOneAndUpdate: vi.fn(),
  customFind: vi.fn(),
  auditCreate: vi.fn(),
  revisionFindOne: vi.fn(),
}));

vi.mock("../models/payroll-run.model", () => ({
  PayrollRunModel: {
    findOne: mocks.runFindOne,
    findOneAndUpdate: mocks.runFindOneAndUpdate,
  },
}));
vi.mock("../models/payroll-line-override.model", () => ({
  PayrollLineOverrideModel: {
    find: mocks.overrideFind,
    findOne: mocks.overrideFindOne,
    findOneAndUpdate: mocks.overrideFindOneAndUpdate,
  },
}));
vi.mock("../models/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate },
}));
vi.mock("../models/payroll-custom-variable.model", () => ({
  PayrollCustomVariableModel: { find: mocks.customFind },
}));
vi.mock("../models/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: { findOne: mocks.revisionFindOne },
}));

import {
  createPayrollLineOverrideOperations,
} from "./payroll-line-override-operations.service";
import { loadAuthoritativePayrollSourceLines } from "./payroll-effective-line.service";
import { calculatePayrollChecksum } from "./payroll-checksum.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const periodKey = "2026-07";
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const sessionLean = <T>(value: T) => {
  const query: any = {
    lean: vi.fn().mockResolvedValue(value),
  };
  query.session = vi.fn().mockReturnValue(query);
  return query;
};
const sortedLean = <T>(value: T) => ({
  sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
});
const row = (changes: Record<string, unknown> = {}) => ({
  employeeId: "employee-a",
  expectedVersion: 0,
  reason: "Payroll reconciliation",
  values: { baseSalary: 12_000_000 },
  customValues: {},
  clearFields: [],
  ...changes,
});

let operations: ReturnType<typeof createPayrollLineOverrideOperations>;
const bulkSavePayrollLineOverrides = (...args: any[]) => (
  (operations.bulkSavePayrollLineOverrides as any)(...args)
);
const listPayrollLineOverrides = (...args: any[]) => (
  (operations.listPayrollLineOverrides as any)(...args)
);

describe("payroll line override operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    operations = createPayrollLineOverrideOperations({
      transactionRunner: async (operation) => operation(undefined),
      loadSourceLines: async () => [
        { employeeId: "employee-a" },
        { employeeId: "employee-b" },
      ],
    });
    mocks.runFindOne.mockReturnValue(sortedLean({ _id: "run-a", status: "draft", version: 0 }));
    mocks.runFindOneAndUpdate.mockReturnValue(lean({ _id: "run-a", status: "draft", version: 1 }));
    mocks.overrideFindOne.mockReturnValue(lean(null));
    mocks.customFind.mockReturnValue(lean([
      { companyCode: "ACME", code: "sales", status: "active" },
      { companyCode: "ACME", code: "quality", status: "active" },
    ]));
    mocks.auditCreate.mockResolvedValue({});
  });

  it("lists overrides only in the requested company, branch, and period", async () => {
    const items = [{ employeeId: "employee-a", version: 1 }];
    mocks.overrideFind.mockReturnValue(sortedLean(items));

    await expect(listPayrollLineOverrides(scope, periodKey)).resolves.toEqual(items);

    expect(mocks.overrideFind).toHaveBeenCalledWith({ ...scope, periodKey });
  });

  it.each([
    { run: null, label: "missing" },
    { run: { _id: "run-a", status: "review" }, label: "non-draft" },
  ])("locks writes when the regular run is $label", async ({ run }) => {
    mocks.runFindOne.mockReturnValue(sortedLean(run));

    await expect(bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row()]))
      .rejects.toMatchObject({
        code: "PAYROLL_LINE_OVERRIDE_LOCKED",
        status: 409,
      });

    expect(mocks.runFindOne).toHaveBeenCalledWith({ ...scope, periodKey, type: "regular" });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("sorts the canonical run once and pins every row claim to that exact run id", async () => {
    const canonical = sortedLean({ _id: "run-a", status: "draft", version: 0 });
    mocks.runFindOne.mockReturnValue(canonical);
    mocks.runFindOneAndUpdate.mockImplementation((filter) => lean({
      _id: filter._id,
      status: "draft",
      version: 1,
    }));
    mocks.overrideFindOneAndUpdate.mockImplementation((filter) => lean({
      employeeId: filter.employeeId,
      version: 1,
    }));

    const results = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ employeeId: "employee-a" }),
      row({ employeeId: "employee-b" }),
    ]);

    expect(canonical.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(results).toEqual([
      expect.objectContaining({ employeeId: "employee-a", status: "success" }),
      expect.objectContaining({ employeeId: "employee-b", status: "success" }),
    ]);
    expect(mocks.runFindOneAndUpdate.mock.calls.map(([filter]) => filter._id))
      .toEqual(["run-a", "run-a"]);
  });

  it("uses the active revision as membership authority and never stale embedded run lines", async () => {
    const revisionLines = [{ employeeId: "employee-a", calculation: { net: 100 } }];
    const totals = { grossPay: 100, deductions: 0, netPay: 100 };
    const checksum = calculatePayrollChecksum({ lines: revisionLines, totals });
    const session = { id: "session-revision" } as any;
    mocks.runFindOneAndUpdate.mockReturnValue(sessionLean({
      _id: "run-a",
      ...scope,
      periodKey,
      status: "draft",
      activeRevisionId: "revision-a",
      activeRevisionChecksum: checksum,
      lines: [{ employeeId: "employee-stale", calculation: { net: 1 } }],
    }));
    const revisionQuery = sessionLean({
      _id: "revision-a",
      runId: "run-a",
      status: "completed",
      lines: revisionLines,
      totals,
      checksum,
    });
    mocks.revisionFindOne.mockReturnValue(revisionQuery);
    const operations = createPayrollLineOverrideOperations({
      transactionRunner: (async (operation: any) => operation(session)) as any,
      loadSourceLines: loadAuthoritativePayrollSourceLines,
    });

    const [result] = await operations.bulkSavePayrollLineOverrides(
      scope,
      periodKey,
      "actor-a",
      [row({ employeeId: "employee-stale" })],
    );

    expect(result).toMatchObject({
      employeeId: "employee-stale",
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_EMPLOYEE_NOT_IN_RUN",
    });
    expect(mocks.revisionFindOne).toHaveBeenCalledWith({
      _id: "revision-a",
      runId: "run-a",
      ...scope,
    });
    expect(revisionQuery.session).toHaveBeenCalledWith(session);
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { label: "inactive", catalog: [{ companyCode: "ACME", code: "sales", status: "draft" }] },
    { label: "retired", catalog: [{ companyCode: "ACME", code: "sales", status: "retired" }] },
    { label: "unknown", catalog: [] },
    { label: "cross-tenant", catalog: [{ companyCode: "OTHER", code: "sales", status: "active" }] },
  ])("rejects $label custom values outside the company's active catalog", async ({ catalog }) => {
    mocks.customFind.mockImplementation((filter) => lean(catalog.filter((item) => (
      item.companyCode === filter.companyCode
      && item.status === filter.status
      && filter.code.$in.includes(item.code)
    ))));

    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row({
      values: {},
      customValues: { sales: 1 },
    })]);

    expect(result).toMatchObject({
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_FIELD_INVALID",
    });
    expect(mocks.customFind).toHaveBeenCalledWith({
      companyCode: "ACME",
      status: "active",
      code: { $in: ["sales"] },
    });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects a custom restore path that is not in the active company catalog", async () => {
    mocks.customFind.mockReturnValue(lean([]));

    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row({
      values: {},
      clearFields: ["custom.unknown"],
    })]);

    expect(result).toMatchObject({
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_FIELD_INVALID",
    });
    expect(mocks.customFind).toHaveBeenCalledWith({
      companyCode: "ACME",
      status: "active",
      code: { $in: ["unknown"] },
    });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requires a nonblank audit reason", async () => {
    await expect(bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ reason: "   " }),
    ])).rejects.toMatchObject({
      code: "PAYROLL_LINE_OVERRIDE_REASON_REQUIRED",
    });
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { rows: [], label: "empty rows" },
    { rows: undefined, label: "missing rows" },
    { rows: {}, label: "non-array rows" },
  ])("rejects $label before preflight", async ({ rows }) => {
    await expect(bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", rows as any))
      .rejects.toMatchObject({
        code: "PAYROLL_LINE_OVERRIDE_ROWS_REQUIRED",
        status: 400,
      });
    expect(mocks.runFindOne).not.toHaveBeenCalled();
  });

  it.each([
    { invalidRow: null, label: "null" },
    { invalidRow: undefined, label: "undefined" },
    { invalidRow: [], label: "array" },
  ])(
    "rejects a non-object row before preflight: $label",
    async ({ invalidRow }) => {
      await expect(bulkSavePayrollLineOverrides(
        scope,
        periodKey,
        "actor-a",
        [invalidRow] as any,
      )).rejects.toMatchObject({
        code: "PAYROLL_LINE_OVERRIDE_ROW_INVALID",
        status: 400,
      });
      expect(mocks.runFindOne).not.toHaveBeenCalled();
    },
  );

  it.each([
    { expectedVersion: undefined, label: "missing" },
    { expectedVersion: "0", label: "coerced string" },
    { expectedVersion: -1, label: "negative" },
    { expectedVersion: 1.5, label: "fractional" },
  ])("requires expectedVersion to be a supplied non-negative integer number: $label", async ({ expectedVersion }) => {
    const input = row({ expectedVersion });
    if (expectedVersion === undefined) delete (input as any).expectedVersion;

    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [input as any]);

    expect(result).toMatchObject({
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_VERSION_INVALID",
    });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { values: { baseSalary: -1 }, customValues: {}, label: "negative core value" },
    { values: { overtime: Number.NaN }, customValues: {}, label: "NaN core value" },
    { values: {}, customValues: { sales: Number.POSITIVE_INFINITY }, label: "infinite custom value" },
  ])("rejects a $label", async ({ values, customValues }) => {
    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ values, customValues }),
    ]);

    expect(result).toMatchObject({
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_VALUE_INVALID",
    });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { changes: { values: { deductionTotal: 1 } }, label: "derived deductionTotal value" },
    { changes: { values: { net: 1 } }, label: "derived net value" },
    { changes: { values: { mystery: 1 } }, label: "unknown value" },
    { changes: { clearFields: ["deductionTotal"] }, label: "derived clear field" },
    { changes: { clearFields: ["custom.1invalid"] }, label: "invalid custom clear code" },
    { changes: { customValues: { "bad-code": 1 } }, label: "invalid custom value code" },
  ])("rejects a $label", async ({ changes }) => {
    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row(changes)]);

    expect(result).toMatchObject({
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_FIELD_INVALID",
    });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("keeps submitted zeroes while unsetting restored core and custom fields", async () => {
    const before = {
      ...scope,
      periodKey,
      employeeId: "employee-a",
      baseSalary: 10_000_000,
      bonusTotal: 500_000,
      customValues: { sales: 10, quality: 20 },
      reason: "Prior change",
      version: 1,
    };
    const after = {
      ...before,
      baseSalary: 0,
      customValues: { sales: 0 },
      reason: "Restore calculated fields",
      version: 2,
    };
    mocks.overrideFindOne.mockReturnValue(lean(before));
    mocks.overrideFindOneAndUpdate.mockReturnValue(lean(after));

    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row({
      expectedVersion: 1,
      reason: "  Restore calculated fields  ",
      values: { baseSalary: 0 },
      customValues: { sales: 0 },
      clearFields: ["bonusTotal", "custom.quality"],
    })]);

    expect(result).toEqual({ employeeId: "employee-a", status: "success", data: after });
    expect(mocks.overrideFindOneAndUpdate).toHaveBeenCalledWith(
      { ...scope, periodKey, employeeId: "employee-a", version: 1 },
      {
        $set: {
          baseSalary: 0,
          "customValues.sales": 0,
          reason: "Restore calculated fields",
          updatedBy: "actor-a",
        },
        $setOnInsert: { ...scope, periodKey, employeeId: "employee-a" },
        $unset: { bonusTotal: 1, "customValues.quality": 1 },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', upsert: false, runValidators: true },
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      ...scope,
      periodKey,
      action: "adjustment",
      actorId: "actor-a",
      metadata: {
        operation: "line_override",
        runId: "run-a",
        employeeId: "employee-a",
        reason: "Restore calculated fields",
        values: { baseSalary: 0, customValues: { sales: 0 } },
        clearFields: ["bonusTotal", "custom.quality"],
        before,
        after,
      },
    });
  });

  it("reports an optimistic version conflict without writing audit", async () => {
    mocks.overrideFindOneAndUpdate.mockReturnValue(lean(null));

    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ expectedVersion: 3 }),
    ]);

    expect(result).toMatchObject({
      employeeId: "employee-a",
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_VERSION_CONFLICT",
    });
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("retains successful row results when another row fails", async () => {
    const saved = { employeeId: "employee-a", baseSalary: 12_000_000, version: 1 };
    mocks.overrideFindOneAndUpdate
      .mockReturnValueOnce(lean(saved))
      .mockReturnValueOnce(lean(null));

    const results = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row(),
      row({ employeeId: "employee-b" }),
    ]);

    expect(results).toEqual([
      { employeeId: "employee-a", status: "success", data: saved },
      expect.objectContaining({
        employeeId: "employee-b",
        status: "error",
        code: "PAYROLL_LINE_OVERRIDE_VERSION_CONFLICT",
      }),
    ]);
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rolls back the run guard and override mutation when audit insertion fails", async () => {
    let runVersion = 0;
    let storedOverride: any = null;
    const beforeQueries: any[] = [];
    const customQueries: any[] = [];
    const session: any = { id: "session-a" };
    const transactionRunner = vi.fn(async (callback: (received: any) => Promise<unknown>) => {
      const snapshot = { runVersion, storedOverride };
      try {
        return await callback(session);
      } catch (error) {
        runVersion = snapshot.runVersion;
        storedOverride = snapshot.storedOverride;
        throw error;
      }
    });
    operations = createPayrollLineOverrideOperations({
      transactionRunner: transactionRunner as any,
      loadSourceLines: async () => [{ employeeId: "employee-a" }],
    });
    mocks.runFindOneAndUpdate.mockImplementation(() => {
      runVersion += 1;
      return sessionLean({ _id: "run-a", status: "draft", version: runVersion, lines: [{ employeeId: "employee-a" }] });
    });
    mocks.overrideFindOne.mockImplementation(() => {
      const query = sessionLean(storedOverride);
      beforeQueries.push(query);
      return query;
    });
    mocks.customFind.mockImplementation(() => {
      const query = sessionLean([]);
      customQueries.push(query);
      return query;
    });
    mocks.overrideFindOneAndUpdate.mockImplementation((_filter, update) => {
      storedOverride = {
        ...scope,
        periodKey,
        employeeId: "employee-a",
        ...update.$set,
        version: 1,
      };
      return sessionLean(storedOverride);
    });
    mocks.auditCreate.mockRejectedValue(new Error("audit unavailable"));

    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row()]);

    expect(result).toMatchObject({ status: "error", code: "PAYROLL_LINE_OVERRIDE_ERROR" });
    expect(storedOverride).toBeNull();
    expect(runVersion).toBe(0);
    expect(transactionRunner).toHaveBeenCalledOnce();
    expect(beforeQueries[0].session).toHaveBeenCalledWith(session);
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "run-a", ...scope, periodKey, type: "regular", status: "draft" },
      { $inc: { version: 1 } },
      { returnDocument: 'after', session },
    );
    expect(mocks.overrideFindOneAndUpdate.mock.calls[0][2]).toEqual(
      expect.objectContaining({ session }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ metadata: expect.objectContaining({ operation: "line_override", runId: "run-a" }) })],
      { session },
    );
    expect(customQueries).toHaveLength(0);
  });

  it("rechecks and claims the draft run per row so a status transition wins against later rows", async () => {
    let runStatus = "draft";
    let runVersion = 0;
    const sessions: any[] = [];
    const transactionRunner = vi.fn(async (callback: (received: any) => Promise<unknown>) => {
      const session: any = { id: `session-${sessions.length + 1}` };
      sessions.push(session);
      return callback(session);
    });
    operations = createPayrollLineOverrideOperations({
      transactionRunner: transactionRunner as any,
      loadSourceLines: async () => [{ employeeId: "employee-a" }, { employeeId: "employee-b" }],
    });
    mocks.runFindOneAndUpdate.mockImplementation(() => {
      if (runStatus !== "draft") return sessionLean(null);
      runVersion += 1;
      return sessionLean({ _id: "run-a", status: "draft", version: runVersion });
    });
    mocks.overrideFindOne.mockImplementation(() => sessionLean(null));
    mocks.overrideFindOneAndUpdate.mockImplementation((_filter) => sessionLean({
      ...scope,
      periodKey,
      employeeId: _filter.employeeId,
      baseSalary: 12_000_000,
      version: 1,
    }));
    mocks.auditCreate.mockImplementation(async (value) => {
      runStatus = "review";
      return Array.isArray(value) ? value : [value];
    });

    const results = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row(),
      row({ employeeId: "employee-b" }),
    ]);

    expect(results).toEqual([
      expect.objectContaining({ employeeId: "employee-a", status: "success" }),
      expect.objectContaining({
        employeeId: "employee-b",
        status: "error",
        code: "PAYROLL_LINE_OVERRIDE_LOCKED",
      }),
    ]);
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.overrideFindOneAndUpdate).toHaveBeenCalledOnce();
    expect(sessions).toHaveLength(2);
    expect(transactionRunner).toHaveBeenCalledTimes(2);
  });

  it.each([
    { employeeId: "", label: "empty employee id" },
    { employeeId: "employee-from-another-run", label: "unknown or cross-run employee" },
  ])("rejects an override for an $label inside the row transaction", async ({ employeeId }) => {
    const session = { id: "session-a" } as any;
    const transactionRunner = vi.fn(async (operation: (received: any) => Promise<unknown>) => operation(session));
    const loadSourceLines = vi.fn(async () => [{ employeeId: "employee-a" }]);
    const operations = createPayrollLineOverrideOperations({
      transactionRunner: transactionRunner as any,
      loadSourceLines,
    });
    mocks.runFindOneAndUpdate.mockReturnValue(sessionLean({
      _id: "run-a",
      status: "draft",
      version: 1,
    }));

    const [result] = await operations.bulkSavePayrollLineOverrides(
      scope,
      periodKey,
      "actor-a",
      [row({ employeeId })],
    );

    expect(result).toMatchObject({
      employeeId,
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_EMPLOYEE_NOT_IN_RUN",
      message: "Employee is not part of the active payroll run",
    });
    expect(loadSourceLines).toHaveBeenCalledWith(
      scope,
      expect.objectContaining({ _id: "run-a" }),
      session,
    );
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects differing trimmed reasons for one bulk API before any row write", async () => {
    const operations = createPayrollLineOverrideOperations({
      transactionRunner: async (operation) => operation(undefined),
      loadSourceLines: async () => [{ employeeId: "employee-a" }, { employeeId: "employee-b" }],
    });

    await expect(operations.bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ employeeId: "employee-a", reason: "  Reconcile July  " }),
      row({ employeeId: "employee-b", reason: "Different reason" }),
    ])).rejects.toMatchObject({
      code: "PAYROLL_LINE_OVERRIDE_REASON_MISMATCH",
      status: 400,
    });

    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("uses one normalized trimmed reason for every row in a bulk API", async () => {
    mocks.overrideFindOneAndUpdate
      .mockReturnValueOnce(lean({ employeeId: "employee-a", version: 1 }))
      .mockReturnValueOnce(lean({ employeeId: "employee-b", version: 1 }));

    const results = await operations.bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ employeeId: "employee-a", reason: "  Reconcile July  " }),
      row({ employeeId: "employee-b", reason: "Reconcile July" }),
    ]);

    expect(results).toEqual([
      expect.objectContaining({ employeeId: "employee-a", status: "success" }),
      expect.objectContaining({ employeeId: "employee-b", status: "success" }),
    ]);
    expect(mocks.overrideFindOneAndUpdate).toHaveBeenCalledTimes(2);
    for (const call of mocks.overrideFindOneAndUpdate.mock.calls) {
      expect(call[1].$set.reason).toBe("Reconcile July");
    }
    expect(mocks.auditCreate).toHaveBeenCalledTimes(2);
  });

  it("rejects a blank reason anywhere in a bulk API before preflight", async () => {
    await expect(operations.bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ employeeId: "employee-a", reason: "Reconcile July" }),
      row({ employeeId: "employee-b", reason: "   " }),
    ])).rejects.toMatchObject({
      code: "PAYROLL_LINE_OVERRIDE_REASON_REQUIRED",
      status: 400,
    });

    expect(mocks.runFindOne).not.toHaveBeenCalled();
    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("uses the injected transaction runner and fails the request closed when atomic writes are unavailable", async () => {
    const transactionRunner = vi.fn(async () => {
      throw Object.assign(new Error("Transactions unavailable"), {
        code: "PAYROLL_TRANSACTION_UNAVAILABLE",
        status: 503,
      });
    });
    const operations = createPayrollLineOverrideOperations({
      transactionRunner,
      loadSourceLines: async () => [{ employeeId: "employee-a" }],
    });

    await expect(operations.bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row()]))
      .rejects.toMatchObject({ status: 503, code: "PAYROLL_TRANSACTION_UNAVAILABLE" });
    expect(transactionRunner).toHaveBeenCalledOnce();
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("returns committed success and retains every remaining row when transactions become unavailable mid-batch", async () => {
    let transactionCall = 0;
    const transactionRunner = vi.fn(async (operation: (session?: any) => Promise<unknown>) => {
      transactionCall += 1;
      if (transactionCall === 1) return operation(undefined);
      throw Object.assign(new Error("Transactions became unavailable"), {
        code: "PAYROLL_TRANSACTION_UNAVAILABLE",
        status: 503,
      });
    });
    const operations = createPayrollLineOverrideOperations({
      transactionRunner: transactionRunner as any,
      loadSourceLines: async () => [
        { employeeId: "employee-a" },
        { employeeId: "employee-b" },
        { employeeId: "employee-c" },
      ],
    });
    mocks.overrideFindOneAndUpdate.mockReturnValueOnce(lean({
      employeeId: "employee-a",
      version: 1,
    }));

    const results = await operations.bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ employeeId: "employee-a" }),
      row({ employeeId: "employee-b" }),
      row({ employeeId: "employee-c" }),
    ]);

    expect(results).toEqual([
      expect.objectContaining({ employeeId: "employee-a", status: "success" }),
      expect.objectContaining({
        employeeId: "employee-b",
        status: "error",
        code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      }),
      expect.objectContaining({
        employeeId: "employee-c",
        status: "error",
        code: "PAYROLL_TRANSACTION_UNAVAILABLE",
      }),
    ]);
    expect(transactionRunner).toHaveBeenCalledTimes(2);
    expect(mocks.overrideFindOneAndUpdate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });
});
