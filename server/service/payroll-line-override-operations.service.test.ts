import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  overrideFind: vi.fn(),
  overrideFindOne: vi.fn(),
  overrideFindOneAndUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne },
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

import {
  bulkSavePayrollLineOverrides,
  listPayrollLineOverrides,
} from "./payroll-line-override-operations.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const periodKey = "2026-07";
const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
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
    mocks.runFindOne.mockReturnValue(lean({ _id: "run-a", status: "draft" }));
    mocks.overrideFindOne.mockReturnValue(lean(null));
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
});
