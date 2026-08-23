import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  policyFind: vi.fn(),
  policyFindOne: vi.fn(),
  policyCreate: vi.fn(),
  policyFindOneAndUpdate: vi.fn(),
  policyUpdateOne: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../models/payroll-policy.model", () => ({
  PayrollPolicyModel: {
    find: mocks.policyFind,
    findOne: mocks.policyFindOne,
    create: mocks.policyCreate,
    findOneAndUpdate: mocks.policyFindOneAndUpdate,
    updateOne: mocks.policyUpdateOne,
  },
}));
vi.mock("../models/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.auditCreate } }));

import { payrollController } from "./index";

const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const selectLean = <T>(value: T) => ({ select: vi.fn().mockReturnValue(lean(value)) });
const sortLean = <T>(value: T) => ({ sort: vi.fn().mockReturnValue(lean(value)) });
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};
const request = (body: any = {}, params: any = {}) =>
  ({ body, params, headers: {}, query: {}, user: { id: "admin", role: "admin", companyCode: "ACME" } }) as any;

const validPolicy = (overrides: any = {}) => ({
  code: "vn-2026", name: "Chính sách 2026",
  effectiveFrom: "2026-07-01T00:00:00.000Z",
  baseSalary: 2_340_000, regionalMinimumWage: 4_960_000,
  funds: [{ code: "social", employeeRate: 0.08, employerRate: 0.175, capBasis: "baseSalary" }],
  personalDeduction: 11_000_000, dependentDeduction: 4_400_000,
  taxBrackets: [{ upTo: 5_000_000, rate: 0.05 }, { rate: 0.2 }],
  ...overrides,
});

describe("payroll policy endpoints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auditCreate.mockResolvedValue({});
  });

  it("creates a policy as a draft scoped to the company", async () => {
    mocks.policyCreate.mockImplementation(async (value: any) => ({ _id: "policy-1", ...value }));
    const res = response();

    await payrollController.createPolicy(request(validPolicy()), res);

    expect(mocks.policyCreate).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", status: "draft", createdBy: "admin", code: "vn-2026",
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("applies the statutory defaults for overtime and rounding", async () => {
    mocks.policyCreate.mockImplementation(async (value: any) => ({ _id: "policy-1", ...value }));

    await payrollController.createPolicy(request(validPolicy()), response());

    expect(mocks.policyCreate.mock.calls[0][0].overtime).toEqual({
      weekday: 1.5, restDay: 2, holiday: 3, nightPremium: 0.3, nightOvertimeBonus: 0.2,
    });
    expect(mocks.policyCreate.mock.calls[0][0].roundingUnit).toBe(1);
  });

  it("rejects tax brackets that do not end open-ended", async () => {
    const res = response();

    await payrollController.createPolicy(request(validPolicy({ taxBrackets: [{ upTo: 5_000_000, rate: 0.05 }] })), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_POLICY_BRACKETS_INVALID" }));
    expect(mocks.policyCreate).not.toHaveBeenCalled();
  });

  it("rejects a rate above one before hitting the database", async () => {
    const res = response();

    await payrollController.createPolicy(request(validPolicy({
      funds: [{ code: "social", employeeRate: 1.5, employerRate: 0.175, capBasis: "baseSalary" }],
    })), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.policyCreate).not.toHaveBeenCalled();
  });

  it("reports a duplicate policy code as a conflict", async () => {
    mocks.policyCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const res = response();

    await payrollController.createPolicy(request(validPolicy()), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_POLICY_DUPLICATE" }));
  });

  it("activates a draft policy and audits the transition", async () => {
    mocks.policyFindOne.mockReturnValue(lean({ _id: "policy-1", status: "draft", effectiveFrom: "2026-07-01" }));
    mocks.policyFind.mockReturnValue(selectLean([{ effectiveFrom: "2025-01-01", effectiveTo: "2026-06-30" }]));
    mocks.policyFindOneAndUpdate.mockReturnValue(lean({ _id: "policy-1", status: "active" }));
    const res = response();

    await payrollController.activatePolicy(request({}, { id: "policy-1" }), res);

    expect(mocks.policyFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "policy-1", companyCode: "ACME", status: "draft" },
      {
        $set: expect.objectContaining({ status: "active", activatedBy: "admin" }),
        $unset: { retiredBy: 1 },
      },
      expect.objectContaining({ returnDocument: 'after' }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      metadata: expect.objectContaining({ operation: "activate_policy", before: { status: "draft" }, after: { status: "active" } }),
    }));
  });

  it("replaces an overlapping active policy only when explicitly confirmed", async () => {
    mocks.policyFindOne.mockReturnValue(lean({ _id: "new", status: "draft", effectiveFrom: "2026-07-01" }));
    mocks.policyFind.mockReturnValue(selectLean([{ _id: "old", status: "active", effectiveFrom: "2026-01-01" }]));
    mocks.policyUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.policyFindOneAndUpdate.mockReturnValue(lean({ _id: "new", status: "active" }));
    const res = response();

    await payrollController.activatePolicy(request({ replaceOverlaps: true }, { id: "new" }), res);

    expect(mocks.policyUpdateOne).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
  });

  it("refuses to activate a policy overlapping an active one", async () => {
    mocks.policyFindOne.mockReturnValue(lean({ _id: "policy-1", status: "draft", effectiveFrom: "2026-07-01" }));
    mocks.policyFind.mockReturnValue(selectLean([{ effectiveFrom: "2026-01-01" }]));
    const res = response();

    await payrollController.activatePolicy(request({}, { id: "policy-1" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "PAYROLL_POLICY_OVERLAP" }));
    expect(mocks.policyFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("cannot activate a policy from another company", async () => {
    mocks.policyFindOne.mockReturnValue(lean(null));
    mocks.policyFind.mockReturnValue(selectLean([]));
    const res = response();

    await payrollController.activatePolicy(request({}, { id: "policy-1" }), res);

    expect(mocks.policyFindOne).toHaveBeenCalledWith({ _id: "policy-1", companyCode: "ACME" });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("retires only an active policy", async () => {
    mocks.policyFindOneAndUpdate.mockReturnValue(lean(null));
    const res = response();

    await payrollController.retirePolicy(request({}, { id: "policy-1" }), res);

    expect(mocks.policyFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: "policy-1", companyCode: "ACME", status: "active" },
      { $set: expect.objectContaining({ status: "retired", retiredBy: "admin" }) },
      { returnDocument: 'after' },
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("lists only the policies of the caller's company", async () => {
    mocks.policyFind.mockReturnValue(sortLean([{ code: "vn-2026" }]));
    const res = response();

    await payrollController.listPolicies(request(), res);

    expect(mocks.policyFind).toHaveBeenCalledWith({ companyCode: "ACME" });
    expect(res.json).toHaveBeenCalledWith({ status: "success", data: [{ code: "vn-2026" }] });
  });
});
