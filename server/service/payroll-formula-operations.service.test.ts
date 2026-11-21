import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() }));
vi.mock("../model/payroll-formula.model", () => ({ PayrollFormulaModel: mocks }));
import { activatePayrollFormula, createPayrollFormula, updatePayrollFormula } from "./payroll-formula-operations.service";
const lean = (value: any) => ({ lean: vi.fn().mockResolvedValue(value) });
const definition: any = { code: "attendance", name: "Chuyên cần", resultBucket: "allowance", priority: 1, effectiveFrom: "2026-01-01", conditions: { combinator: "and", items: [] }, expression: { type: "constant", value: 500000 }, rounding: { mode: "nearest", unit: 1000 } };

describe("payroll formula operations", () => {
  beforeEach(() => vi.resetAllMocks());
  it("creates a tenant-scoped draft", async () => { mocks.create.mockImplementation(async (value) => value); expect(await createPayrollFormula("ACME", "manager", definition)).toMatchObject({ companyCode: "ACME", status: "draft", createdBy: "manager" }); });
  it("updates draft or active using expected version", async () => { mocks.findOneAndUpdate.mockReturnValue(lean({ ...definition, status: "active", version: 3 })); await updatePayrollFormula("ACME", "p1", 2, definition); expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ["draft", "active"] }, version: 2 }), expect.objectContaining({ $inc: { version: 1 } }), expect.any(Object)); });
  it("activates draft or retired formulas", async () => { mocks.findOneAndUpdate.mockReturnValue(lean({ ...definition, status: "active" })); await activatePayrollFormula("ACME", "p1", "manager"); expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ["draft", "retired"] } }), expect.any(Object), expect.any(Object)); });
});
