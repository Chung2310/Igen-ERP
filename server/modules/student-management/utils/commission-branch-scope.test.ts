import { beforeEach, describe, expect, it, vi } from "vitest";
import { BranchModel } from "../../../model/branch.model";
import type { AuthRequest } from "../middlewares/auth.middleware";
import { resolveCommissionBranchId } from "./commission-branch-scope";

const branchId = "64b000000000000000000001";
function request(options: { role?: string; branchId?: string; requestedBranchId?: string } = {}) {
  return {
    query: options.requestedBranchId ? { branchId: options.requestedBranchId } : {},
    body: {},
    user: { uid: "admin-1", id: "admin-1", role: options.role || "admin", centerId: "ACME", companyCode: "ACME", branchId: options.branchId },
  } as unknown as AuthRequest;
}

describe("commission branch selection", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("resolves a selected branch for an unassigned company admin", async () => {
    const lean = vi.fn().mockResolvedValue({ _id: branchId });
    const select = vi.fn().mockReturnValue({ lean });
    const findOne = vi.spyOn(BranchModel, "findOne").mockReturnValue({ select } as never);

    await expect(resolveCommissionBranchId(request({ requestedBranchId: branchId }), true)).resolves.toBe(branchId);
    expect(findOne).toHaveBeenCalledWith({ _id: branchId, companyCode: "ACME", isActive: true });
  });

  it("allows company-wide reads without a selected branch", async () => {
    await expect(resolveCommissionBranchId(request(), false)).resolves.toBeUndefined();
    await expect(resolveCommissionBranchId(request(), true)).rejects.toThrow(/chọn chi nhánh/i);
  });

  it("rejects a selected branch outside the company", async () => {
    const lean = vi.fn().mockResolvedValue(null);
    const select = vi.fn().mockReturnValue({ lean });
    vi.spyOn(BranchModel, "findOne").mockReturnValue({ select } as never);

    await expect(resolveCommissionBranchId(request({ requestedBranchId: branchId }), true)).rejects.toThrow(/không thuộc công ty/i);
  });

  it("does not let a branch-assigned account select another branch", async () => {
    await expect(resolveCommissionBranchId(request({ branchId, requestedBranchId: "64b000000000000000000002" }), true)).rejects.toThrow(/chi nhánh đã gán/i);
  });
});
