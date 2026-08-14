import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  overrideFind: vi.fn(),
  overrideFindOne: vi.fn(),
  overrideFindOneAndUpdate: vi.fn(),
  customFind: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: {
    findOne: mocks.runFindOne,
    findOneAndUpdate: mocks.runFindOneAndUpdate,
  },
}));
vi.mock("../model/payroll-line-override.model", () => ({
  PayrollLineOverrideModel: {
    find: mocks.overrideFind,
    findOne: mocks.overrideFindOne,
    findOneAndUpdate: mocks.overrideFindOneAndUpdate,
  },
}));
vi.mock("../model/payroll-audit.model", () => ({
  PayrollAuditModel: { create: mocks.auditCreate },
}));
vi.mock("../model/payroll-custom-variable.model", () => ({
  PayrollCustomVariableModel: { find: mocks.customFind },
}));

import {
  bulkSavePayrollLineOverrides,
  listPayrollLineOverrides,
} from "./payroll-line-override-operations.service";

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

describe("payroll line override operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.runFindOne.mockReturnValue(lean({ _id: "run-a", status: "draft", version: 0 }));
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
    mocks.runFindOne.mockReturnValue(lean(run));

    await expect(bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row()]))
      .rejects.toMatchObject({
        code: "PAYROLL_LINE_OVERRIDE_LOCKED",
        status: 409,
      });

    expect(mocks.runFindOne).toHaveBeenCalledWith({ ...scope, periodKey, type: "regular" });
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
    const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row({ reason: "   " }),
    ]);

    expect(result).toMatchObject({
      status: "error",
      code: "PAYROLL_LINE_OVERRIDE_REASON_REQUIRED",
    });
    expect(mocks.overrideFindOneAndUpdate).not.toHaveBeenCalled();
  });

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
      { new: true, upsert: false, runValidators: true },
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      ...scope,
      periodKey,
      action: "adjustment",
      actorId: "actor-a",
      metadata: {
        operation: "line_override",
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
    mocks.overrideFindOneAndUpdate.mockReturnValueOnce(lean(saved));

    const results = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [
      row(),
      row({ employeeId: "employee-b", reason: " " }),
    ]);

    expect(results).toEqual([
      { employeeId: "employee-a", status: "success", data: saved },
      expect.objectContaining({
        employeeId: "employee-b",
        status: "error",
        code: "PAYROLL_LINE_OVERRIDE_REASON_REQUIRED",
      }),
    ]);
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("rolls back the run guard and override mutation when audit insertion fails", async () => {
    const priorReadyState = mongoose.connection.readyState;
    let runVersion = 0;
    let storedOverride: any = null;
    const beforeQueries: any[] = [];
    const customQueries: any[] = [];
    const session: any = { endSession: vi.fn() };
    session.withTransaction = vi.fn(async (callback: () => Promise<unknown>) => {
      const snapshot = { runVersion, storedOverride };
      try {
        return await callback();
      } catch (error) {
        runVersion = snapshot.runVersion;
        storedOverride = snapshot.storedOverride;
        throw error;
      }
    });
    (mongoose.connection as any).readyState = 1;
    const startSession = vi.spyOn(mongoose, "startSession").mockResolvedValue(session);
    mocks.runFindOneAndUpdate.mockImplementation(() => {
      runVersion += 1;
      return sessionLean({ _id: "run-a", status: "draft", version: runVersion });
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

    try {
      const [result] = await bulkSavePayrollLineOverrides(scope, periodKey, "actor-a", [row()]);

      expect(result).toMatchObject({ status: "error", code: "PAYROLL_LINE_OVERRIDE_ERROR" });
      expect(storedOverride).toBeNull();
      expect(runVersion).toBe(0);
      expect(session.withTransaction).toHaveBeenCalledOnce();
      expect(session.endSession).toHaveBeenCalledOnce();
      expect(beforeQueries[0].session).toHaveBeenCalledWith(session);
      expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
        { ...scope, periodKey, type: "regular", status: "draft" },
        { $inc: { version: 1 } },
        { new: true, session },
      );
      expect(mocks.overrideFindOneAndUpdate.mock.calls[0][2]).toEqual(
        expect.objectContaining({ session }),
      );
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        [expect.objectContaining({ metadata: expect.objectContaining({ operation: "line_override" }) })],
        { session },
      );
      expect(customQueries).toHaveLength(0);
    } finally {
      startSession.mockRestore();
      (mongoose.connection as any).readyState = priorReadyState;
    }
  });

  it("rechecks and claims the draft run per row so a status transition wins against later rows", async () => {
    const priorReadyState = mongoose.connection.readyState;
    let runStatus = "draft";
    let runVersion = 0;
    const sessions: any[] = [];
    (mongoose.connection as any).readyState = 1;
    const startSession = vi.spyOn(mongoose, "startSession").mockImplementation(async () => {
      const session: any = {
        withTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
        endSession: vi.fn(),
      };
      sessions.push(session);
      return session;
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

    try {
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
      expect(sessions.every((item) => item.withTransaction.mock.calls.length === 1)).toBe(true);
      expect(sessions.every((item) => item.endSession.mock.calls.length === 1)).toBe(true);
    } finally {
      startSession.mockRestore();
      (mongoose.connection as any).readyState = priorReadyState;
    }
  });
});
