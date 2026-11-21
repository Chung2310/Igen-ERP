import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  create: vi.fn(),
  customVariableFind: vi.fn(),
}));
vi.mock("../model/payroll-formula.model", () => ({ PayrollFormulaModel: mocks }));
vi.mock("../model/payroll-custom-variable.model", () => ({
  PayrollCustomVariableModel: { find: mocks.customVariableFind },
}));

import {
  activatePayrollFormula,
  clonePayrollFormula,
  createPayrollFormula,
  retirePayrollFormula,
  updatePayrollFormula,
} from "./payroll-formula-operations.service";

const lean = <T>(value: T) => ({ select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value) });
const definition = {
  code: "attendance",
  name: "Chuyên cần",
  resultBucket: "allowance",
  priority: 1,
  effectiveFrom: "2026-01-01",
  conditions: { combinator: "and", items: [] },
  expression: { type: "constant", value: 500_000 },
  rounding: { mode: "nearest", unit: 1000 },
};

describe("payroll formula operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockImplementation(async (value: any) => value);
    mocks.findOne.mockReturnValue(lean({ ...definition, _id: "formula-1", status: "draft", version: 2 }));
    mocks.customVariableFind.mockReturnValue(lean([]));
  });

  it("creates a tenant-scoped draft with a clean version", async () => {
    const value = await createPayrollFormula("ACME", "manager", definition);

    expect(value).toMatchObject({ companyCode: "ACME", status: "draft", version: 0, createdBy: "manager" });
    expect(value).not.toHaveProperty("activatedBy");
  });

  it("rejects tenant and lifecycle fields in a create payload", async () => {
    await expect(createPayrollFormula("ACME", "manager", {
      ...definition, companyCode: "OTHER", status: "active", activatedBy: "attacker",
    })).rejects.toMatchObject({ code: "PAYROLL_FORMULA_FIELD_INVALID", status: 400 });

    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate formula code to a conflict", async () => {
    mocks.create.mockRejectedValue({ code: 11000 });

    await expect(createPayrollFormula("ACME", "manager", definition))
      .rejects.toMatchObject({ code: "PAYROLL_FORMULA_DUPLICATE", status: 409 });
  });

  it("updates only definition fields using the expected version", async () => {
    mocks.findOneAndUpdate.mockReturnValue(lean({ ...definition, status: "active", version: 3 }));

    await updatePayrollFormula("ACME", "formula-1", 2, definition);

    const [filter, update] = mocks.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual(expect.objectContaining({
      companyCode: "ACME", status: { $in: ["draft", "active"] }, version: 2,
    }));
    expect(update.$inc).toEqual({ version: 1 });
    expect(update.$set).toEqual(expect.objectContaining({ code: "attendance", expression: definition.expression }));
    expect(update.$set).not.toHaveProperty("companyCode");
    expect(update.$set).not.toHaveProperty("status");
  });

  it("prevents a formula update from moving it to another company or changing its lifecycle", async () => {
    await expect(updatePayrollFormula("ACME", "formula-1", 2, {
      ...definition, companyCode: "OTHER", status: "retired", createdBy: "attacker",
    })).rejects.toMatchObject({ code: "PAYROLL_FORMULA_FIELD_INVALID", status: 400 });

    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects missing or invalid expected versions before updating", async () => {
    await expect(updatePayrollFormula("ACME", "formula-1", Number.NaN, definition))
      .rejects.toMatchObject({ code: "PAYROLL_FORMULA_VERSION_INVALID", status: 400 });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("maps duplicate code changes to a conflict", async () => {
    mocks.findOneAndUpdate.mockReturnValue({
      ...lean(null),
      lean: vi.fn().mockRejectedValue({ code: 11000 }),
    });

    await expect(updatePayrollFormula("ACME", "formula-1", 2, { ...definition, code: "other" }))
      .rejects.toMatchObject({ code: "PAYROLL_FORMULA_DUPLICATE", status: 409 });
  });

  it("rejects active formulas that reference custom fields that are not enabled", async () => {
    mocks.findOne.mockReturnValue(lean({
      ...definition,
      _id: "formula-1",
      status: "active",
      version: 2,
      expression: { type: "variable", key: "custom.sales" },
    }));

    await expect(updatePayrollFormula("ACME", "formula-1", 2, {
      ...definition, expression: { type: "variable", key: "custom.sales" },
    })).rejects.toMatchObject({ code: "PAYROLL_FORMULA_CUSTOM_VARIABLE_INVALID", status: 409 });

    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("requires referenced custom fields to be active before formula activation", async () => {
    mocks.findOne.mockReturnValue(lean({
      ...definition,
      _id: "formula-1",
      status: "draft",
      version: 2,
      expression: { type: "variable", key: "custom.sales" },
    }));

    await expect(activatePayrollFormula("ACME", "formula-1", "manager"))
      .rejects.toMatchObject({ code: "PAYROLL_FORMULA_CUSTOM_VARIABLE_INVALID", status: 409 });

    expect(mocks.customVariableFind).toHaveBeenCalledWith({
      companyCode: "ACME", status: "active", code: { $in: ["sales"] },
    });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("increments versions on activation and retirement", async () => {
    mocks.findOne.mockReturnValue(lean({ ...definition, _id: "formula-1", status: "draft", version: 2 }));
    mocks.findOneAndUpdate.mockReturnValue(lean({ ...definition, status: "active", version: 3 }));
    await activatePayrollFormula("ACME", "formula-1", "manager");
    expect(mocks.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ companyCode: "ACME", status: { $in: ["draft", "retired"] }, version: 2 }),
      expect.objectContaining({ $inc: { version: 1 }, $set: expect.objectContaining({ activatedBy: "manager" }) }),
      expect.any(Object),
    );

    await retirePayrollFormula("ACME", "formula-1", "manager");
    expect(mocks.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ companyCode: "ACME", status: "active" }),
      expect.objectContaining({ $inc: { version: 1 }, $set: expect.objectContaining({ retiredBy: "manager" }) }),
      expect.any(Object),
    );
  });

  it("clones only formula definition fields into a new tenant-owned draft", async () => {
    mocks.findOne.mockReturnValue(lean({
      _id: "formula-1", companyCode: "ACME", ...definition, status: "active", version: 6,
      createdBy: "creator", activatedBy: "approver", activatedAt: new Date(),
    }));

    const cloned = await clonePayrollFormula("ACME", "formula-1", "manager", "attendance-copy");

    expect(cloned).toMatchObject({
      companyCode: "ACME", status: "draft", version: 0, createdBy: "manager",
      code: "attendance-copy", name: "Chuyên cần - Bản sao",
    });
    expect(cloned).not.toHaveProperty("activatedBy");
  });
});
