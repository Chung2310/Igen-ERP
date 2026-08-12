import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn(),
  runFind: vi.fn(), revisionFind: vi.fn(), auditCreate: vi.fn(),
}));
vi.mock("../model/payroll-policy.model", () => ({ PayrollPolicyModel: { find: mocks.find, findOne: mocks.findOne, findOneAndUpdate: mocks.findOneAndUpdate, updateOne: mocks.updateOne, create: mocks.create, deleteOne: mocks.deleteOne } }));
vi.mock("../model/payroll-run.model", () => ({ PayrollRunModel: { find: mocks.runFind } }));
vi.mock("../model/payroll-calculation-revision.model", () => ({ PayrollCalculationRevisionModel: { find: mocks.revisionFind } }));
vi.mock("../model/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.auditCreate } }));

import { activatePayrollPolicy, clonePayrollPolicy, deletePayrollPolicy, updatePayrollPolicy } from "./payroll-policy-operations.service";

const lean = (value: any) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLean = (value: any) => ({ select: vi.fn().mockReturnValue(lean(value)) });
const definition = { code: "vn-2026", name: "Policy", effectiveFrom: new Date("2026-01-01"), baseSalary: 1, regionalMinimumWage: 1, socialCapMultiplier: 20, unemploymentCapMultiplier: 20, funds: [{ code: "social", employeeRate: .08, employerRate: .17, capBasis: "baseSalary" }], personalDeduction: 1, dependentDeduction: 1, taxBrackets: [{ rate: .1 }], shortTermWithholdingRate: .1, shortTermWithholdingThreshold: 1, nonResidentRate: .2, overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: .3, nightOvertimeBonus: .2 }, roundingUnit: 1 };

describe("payroll policy version operations", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.auditCreate.mockResolvedValue({}); });

  it("truncates an older overlap before activating the replacement", async () => {
    mocks.findOne.mockReturnValue(lean({ _id: "new", status: "draft", effectiveFrom: new Date("2026-07-01") }));
    mocks.find.mockReturnValue(selectLean([{ _id: "old", status: "active", effectiveFrom: new Date("2026-01-01") }]));
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.findOneAndUpdate.mockReturnValue(lean({ _id: "new", status: "active" }));

    await activatePayrollPolicy("ACME", "new", "manager", { replaceOverlaps: true });

    expect(mocks.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "old", companyCode: "ACME", status: "active" }),
      { $set: { effectiveTo: new Date("2026-06-30T00:00:00.000Z") } },
      expect.any(Object),
    );
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "new", status: "draft" }), expect.any(Object), expect.any(Object),
    );
  });

  it("retires an overlap with the same start date", async () => {
    mocks.findOne.mockReturnValue(lean({ _id: "new", status: "draft", effectiveFrom: new Date("2026-07-01") }));
    mocks.find.mockReturnValue(selectLean([{ _id: "old", status: "active", effectiveFrom: new Date("2026-07-01") }]));
    mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.findOneAndUpdate.mockReturnValue(lean({ _id: "new", status: "active" }));
    await activatePayrollPolicy("ACME", "new", "manager", { replaceOverlaps: true });
    expect(mocks.updateOne).toHaveBeenCalledWith(expect.any(Object), { $set: { status: "retired", retiredBy: "manager" } }, expect.any(Object));
  });

  it("updates only a draft at the expected version", async () => {
    mocks.findOneAndUpdate.mockReturnValue(lean({ _id: "p1", status: "draft", version: 3, ...definition }));
    await updatePayrollPolicy("ACME", "p1", "manager", 2, definition);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "p1", companyCode: "ACME", status: "draft", version: 2 }),
      { $set: definition, $inc: { version: 1 } },
      { new: true, runValidators: true },
    );
  });

  it("clones sanitized definition into a new draft", async () => {
    mocks.findOne.mockReturnValue(lean({ _id: "p1", status: "active", activatedBy: "x", version: 7, ...definition }));
    mocks.create.mockImplementation(async (value: any) => ({ _id: "p2", ...value }));
    const cloned: any = await clonePayrollPolicy("ACME", "p1", "manager", { code: "vn-copy" });
    expect(cloned).toMatchObject({ code: "vn-copy", name: "Policy Bản sao", status: "draft", createdBy: "manager" });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("activatedBy");
  });

  it("applies reviewed form values atomically when cloning", async () => {
    mocks.findOne.mockReturnValue(lean({ _id: "p1", status: "active", version: 7, ...definition }));
    mocks.create.mockImplementation(async (value: any) => ({ _id: "p2", ...value }));
    await clonePayrollPolicy("ACME", "p1", "manager", { code: "vn-copy", name: "Reviewed copy", definition: { ...definition, code: "vn-copy", name: "Reviewed copy", baseSalary: 2 } } as any);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ code: "vn-copy", name: "Reviewed copy", baseSalary: 2, status: "draft" }));
  });

  it("blocks deletion when a finalized run references the policy", async () => {
    mocks.findOne.mockReturnValue(lean({ _id: "p1", status: "retired", ...definition }));
    mocks.runFind.mockReturnValue(selectLean([{ periodKey: "2026-07", lines: [{ policyId: "p1" }] }]));
    mocks.revisionFind.mockReturnValue(selectLean([]));
    await expect(deletePayrollPolicy("ACME", "p1", "manager")).rejects.toMatchObject({ code: "PAYROLL_POLICY_IN_USE", status: 409 });
    expect(mocks.deleteOne).not.toHaveBeenCalled();
  });

  it("deletes an unused retired policy and audits it", async () => {
    mocks.findOne.mockReturnValue(lean({ _id: "p1", status: "retired", ...definition }));
    mocks.runFind.mockReturnValue(selectLean([])); mocks.revisionFind.mockReturnValue(selectLean([]));
    mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
    await deletePayrollPolicy("ACME", "p1", "manager");
    expect(mocks.deleteOne).toHaveBeenCalledWith({ _id: "p1", companyCode: "ACME", status: { $in: ["draft", "retired"] } });
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ operation: "delete_policy" }) }));
  });
});
