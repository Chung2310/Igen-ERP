import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  runFindOneAndUpdate: vi.fn(),
  scopeReservationFindOneAndUpdate: vi.fn(),
  inputFindOne: vi.fn(),
  inputFindOneAndUpdate: vi.fn(),
  customVariableFind: vi.fn(),
  customVariableCreate: vi.fn(),
  customVariableFindOne: vi.fn(),
  customVariableFindOneAndUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transactionRunner: vi.fn(),
}));

vi.mock("../model/payroll-run.model", () => ({
  PayrollRunModel: { findOne: mocks.runFindOne, findOneAndUpdate: mocks.runFindOneAndUpdate },
}));
vi.mock("../model/payroll-run-scope-reservation.model", () => ({
  PayrollRunScopeReservationModel: { findOneAndUpdate: mocks.scopeReservationFindOneAndUpdate },
}));
vi.mock("../model/payroll-period-input.model", () => ({
  PayrollPeriodInputModel: { findOne: mocks.inputFindOne, findOneAndUpdate: mocks.inputFindOneAndUpdate },
}));
vi.mock("../model/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.auditCreate } }));
vi.mock("../model/payroll-custom-variable.model", () => ({
  PayrollCustomVariableModel: {
    find: mocks.customVariableFind,
    create: mocks.customVariableCreate,
    findOne: mocks.customVariableFindOne,
    findOneAndUpdate: mocks.customVariableFindOneAndUpdate,
  },
}));
vi.mock("./payroll-transaction.service", () => ({ runPayrollAtomicTransaction: mocks.transactionRunner }));

import {
  activatePayrollCustomVariable,
  createPayrollCustomVariable,
  retirePayrollCustomVariable,
  savePayrollPeriodInput,
  updatePayrollCustomVariable,
} from "./payroll-period-input-operations.service";

const query = <T>(value: T) => ({
  session: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});
const request = (overrides: Record<string, unknown> = {}) => ({
  reason: "reconcile",
  expectedVersion: 0,
  agreedSalary: 1,
  ...overrides,
});
const scope = { companyCode: "A", branchId: "B" };

describe("payroll period input operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transactionRunner.mockImplementation((operation: (session?: unknown) => unknown) => operation(undefined));
    mocks.runFindOne.mockReturnValue(query({ _id: "run-a", status: "draft", version: 4 }));
    mocks.runFindOneAndUpdate.mockReturnValue(query({ _id: "run-a", status: "draft", version: 5 }));
    mocks.scopeReservationFindOneAndUpdate.mockResolvedValue({});
    mocks.inputFindOne.mockReturnValue(query(null));
    mocks.inputFindOneAndUpdate.mockReturnValue(query({ employeeId: "e1", version: 1 }));
    mocks.customVariableFind.mockReturnValue(query([]));
    mocks.customVariableFindOne.mockReturnValue(query({
      _id: "variable-1", companyCode: "A", code: "sales", unit: "number", status: "draft", version: 0,
    }));
    mocks.customVariableFindOneAndUpdate.mockReturnValue(query({ _id: "variable-1", status: "active", version: 1 }));
    mocks.customVariableCreate.mockImplementation(async (value: any) => value);
    mocks.auditCreate.mockResolvedValue({});
  });

  it("rejects writes after a payroll period leaves draft", async () => {
    mocks.runFindOne.mockReturnValue(query({ status: "review" }));

    await expect(savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request()))
      .rejects.toMatchObject({ code: "PAYROLL_PERIOD_INPUT_LOCKED" });

    expect(mocks.runFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.inputFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requires a reason before starting the write transaction", async () => {
    await expect(savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({ reason: " " })))
      .rejects.toMatchObject({ code: "PAYROLL_PERIOD_INPUT_REASON_REQUIRED" });

    expect(mocks.transactionRunner).not.toHaveBeenCalled();
  });

  it("uses a run state guard and optimistic input version when saving an explicit zero", async () => {
    mocks.inputFindOneAndUpdate.mockReturnValue(query({ employeeId: "e1", version: 1, bonus: 0 }));

    await savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({ bonus: 0 }));

    expect(mocks.scopeReservationFindOneAndUpdate).toHaveBeenCalledWith(
      { scopeKey: JSON.stringify(["A", "B"]) },
      expect.objectContaining({ $inc: { revision: 1 } }),
      expect.objectContaining({ upsert: true }),
    );
    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "run-a", status: "draft", version: 4 }),
      expect.objectContaining({ $set: { needsInputRefresh: true }, $inc: { version: 1 } }),
      expect.objectContaining({ returnDocument: "after" }),
    );
    expect(mocks.inputFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ version: 0 }),
      expect.objectContaining({ $set: expect.objectContaining({ bonus: 0 }) }),
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it("does not write inputs if the run is closed between the read and state guard", async () => {
    mocks.runFindOneAndUpdate.mockReturnValue(query(null));

    await expect(savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request()))
      .rejects.toMatchObject({ code: "PAYROLL_PERIOD_INPUT_LOCKED" });

    expect(mocks.inputFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("drops untrusted record fields from period input updates", async () => {
    await savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({
      employeeId: "someone-else",
      companyCode: "OTHER",
      branchId: "OTHER-BRANCH",
      periodKey: "2026-09",
      version: 99,
      updatedBy: "forged-actor",
      status: "closed",
    }));

    const [filter, update] = mocks.inputFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual(expect.objectContaining({ companyCode: "A", branchId: "B", periodKey: "2026-08", employeeId: "e1" }));
    expect(update.$set).not.toHaveProperty("companyCode");
    expect(update.$set).not.toHaveProperty("branchId");
    expect(update.$set).not.toHaveProperty("periodKey");
    expect(update.$set).not.toHaveProperty("employeeId");
    expect(update.$set).not.toHaveProperty("updatedBy", "forged-actor");
    expect(update.$set).not.toHaveProperty("status");
  });

  it("rejects values for inactive custom payroll fields before saving", async () => {
    await expect(savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({
      customValues: { unregistered: 300 },
    }))).rejects.toMatchObject({ code: "PAYROLL_PERIOD_INPUT_CUSTOM_FIELD_INVALID", status: 409 });

    expect(mocks.customVariableFind).toHaveBeenCalledWith({
      companyCode: "A", status: "active", code: { $in: ["unregistered"] },
    });
    expect(mocks.inputFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("accepts an explicitly active custom field", async () => {
    mocks.customVariableFind.mockReturnValue(query([{ code: "sales" }]));

    await savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({
      customValues: { sales: 300 },
    }));

    expect(mocks.inputFindOneAndUpdate.mock.calls[0][1].$set.customValues).toEqual({ sales: 300 });
  });

  it("rejects custom percentage values above one hundred", async () => {
    mocks.customVariableFind.mockReturnValue(query([{ code: "completion", unit: "percent" }]));

    await expect(savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({
      customValues: { completion: 100.01 },
    }))).rejects.toMatchObject({ code: "PAYROLL_PERIOD_INPUT_VALUE_INVALID", status: 400 });

    expect(mocks.inputFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("keeps the input update and audit in the same transaction session", async () => {
    const session = { transaction: "session" };
    mocks.transactionRunner.mockImplementation((operation: (session?: unknown) => unknown) => operation(session));
    mocks.auditCreate.mockResolvedValue([]);

    await savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request());

    expect(mocks.runFindOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), expect.objectContaining({ session }),
    );
    expect(mocks.inputFindOneAndUpdate.mock.results[0].value.session).toHaveBeenCalledWith(session);
    expect(mocks.auditCreate).toHaveBeenCalledWith([expect.objectContaining({ action: "adjustment" })], { session });
  });

  it("restores cleared core and custom fields without turning them into zeroes", async () => {
    mocks.inputFindOne.mockReturnValue(query({ bonus: 99, customValues: { sales: 12 }, version: 2 }));
    mocks.inputFindOneAndUpdate.mockReturnValue(query({ employeeId: "e1", version: 3 }));

    await savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request({
      expectedVersion: 2,
      bonus: 99,
      customValues: { sales: 12 },
      clearFields: ["bonus", "custom.sales"],
    }));

    const update = mocks.inputFindOneAndUpdate.mock.calls[0][1];
    expect(update.$unset).toEqual({ bonus: 1, "customValues.sales": 1 });
    expect(update.$set).not.toHaveProperty("bonus");
    expect(update.$set.customValues).toBeUndefined();
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        before: expect.objectContaining({ bonus: 99 }),
        after: expect.objectContaining({ version: 3 }),
        clearFields: ["bonus", "custom.sales"],
      }),
    }));
  });

  it("turns concurrent first-insert collisions into a version conflict", async () => {
    mocks.inputFindOneAndUpdate.mockReturnValue({
      ...query(null),
      lean: vi.fn().mockRejectedValue({ code: 11000 }),
    });

    await expect(savePayrollPeriodInput(scope, "2026-08", "e1", "manager", request()))
      .rejects.toMatchObject({ code: "PAYROLL_PERIOD_INPUT_VERSION_CONFLICT", status: 409 });
  });

  it("rejects company or lifecycle fields in a custom-variable create payload", async () => {
    await expect(createPayrollCustomVariable("A", "manager", {
      code: "commission", name: "Commission", unit: "money", companyCode: "OTHER", status: "active",
    })).rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_FIELD_INVALID", status: 400 });

    expect(mocks.customVariableCreate).not.toHaveBeenCalled();
  });

  it("rejects unsafe custom-variable codes that collide with built-in object properties", async () => {
    await expect(createPayrollCustomVariable("A", "manager", {
      code: "toString", name: "Unsafe field", unit: "number",
    })).rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_CODE_INVALID", status: 400 });
  });

  it("normalizes custom-variable codes to the formula engine's lowercase syntax", async () => {
    const variable = await createPayrollCustomVariable("A", "manager", {
      code: "SalesBonus", name: "Sales bonus", unit: "money",
    });

    expect(variable).toMatchObject({ code: "salesbonus", status: "draft" });
  });

  it("maps duplicate custom-variable codes to a clear conflict", async () => {
    mocks.customVariableCreate.mockRejectedValue({ code: 11000 });

    await expect(createPayrollCustomVariable("A", "manager", {
      code: "commission", name: "Commission", unit: "money", defaultValue: "",
    })).rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_CODE_DUPLICATE", status: 409 });
  });

  it("does not allow custom-variable updates to change tenant or lifecycle ownership", async () => {
    await expect(updatePayrollCustomVariable("A", "variable-1", 0, {
      companyCode: "OTHER", status: "retired", createdBy: "forged-actor",
    })).rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_FIELD_INVALID", status: 400 });

    expect(mocks.customVariableFindOne).not.toHaveBeenCalled();
    expect(mocks.customVariableFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("keeps percentage defaults within the valid range when changing a variable unit", async () => {
    mocks.customVariableFindOne.mockReturnValue(query({
      _id: "variable-1", companyCode: "A", code: "sales", unit: "money", defaultValue: 150,
      status: "draft", version: 0,
    }));

    await expect(updatePayrollCustomVariable("A", "variable-1", 0, { unit: "percent" }))
      .rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_VALUE_INVALID", status: 400 });

    expect(mocks.customVariableFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not allow renaming the code of an active custom variable", async () => {
    mocks.customVariableFindOne.mockReturnValue(query({
      _id: "variable-1", companyCode: "A", code: "sales", unit: "number", status: "active", version: 1,
    }));

    await expect(updatePayrollCustomVariable("A", "variable-1", 1, { code: "commission" }))
      .rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_CODE_IMMUTABLE", status: 409 });

    expect(mocks.customVariableFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("maps duplicate code updates to a clear conflict", async () => {
    mocks.customVariableFindOneAndUpdate.mockReturnValue({
      ...query(null),
      lean: vi.fn().mockRejectedValue({ code: 11000 }),
    });

    await expect(updatePayrollCustomVariable("A", "variable-1", 0, { code: "commission" }))
      .rejects.toMatchObject({ code: "PAYROLL_CUSTOM_VARIABLE_CODE_DUPLICATE", status: 409 });
  });

  it("increments custom-variable versions on activation and retirement", async () => {
    await activatePayrollCustomVariable("A", "variable-1", "manager");
    expect(mocks.customVariableFindOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ companyCode: "A", status: { $in: ["draft", "retired"] } }),
      expect.objectContaining({ $inc: { version: 1 }, $set: expect.objectContaining({ activatedBy: "manager" }) }),
      expect.objectContaining({ returnDocument: "after" }),
    );

    await retirePayrollCustomVariable("A", "variable-1", "manager");
    expect(mocks.customVariableFindOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ companyCode: "A", status: "active" }),
      expect.objectContaining({ $inc: { version: 1 }, $set: expect.objectContaining({ retiredBy: "manager" }) }),
      expect.objectContaining({ returnDocument: "after" }),
    );
  });
});
