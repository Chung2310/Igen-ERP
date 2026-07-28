import { afterEach, describe, expect, it, vi } from "vitest";
import { BranchModel } from "../model/branch.model";
import type { AuthenticatedRequest } from "../middleware/auth";
import { resolveRecruitmentScope } from "./recruitment-scope";

function request(
  role: string,
  branchId?: string,
  selectedBranchId?: string,
): AuthenticatedRequest {
  return {
    headers: selectedBranchId ? { "x-branch-id": selectedBranchId } : {},
    user: {
      id: "user-1",
      email: "user@example.com",
      role,
      companyCode: " acme ",
      branchId,
    },
  } as AuthenticatedRequest;
}

describe("resolveRecruitmentScope", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires an admin to select a branch", async () => {
    await expect(resolveRecruitmentScope(request("admin"))).rejects.toThrow(
      "A branch must be selected",
    );
  });

  it("accepts an active branch belonging to the admin company", async () => {
    vi.spyOn(BranchModel, "findOne").mockReturnValue({
      select: () => ({ lean: async () => ({ _id: "branch-a" }) }),
    } as never);

    await expect(
      resolveRecruitmentScope(request("admin", undefined, "branch-a")),
    ).resolves.toEqual({ companyCode: "ACME", branchId: "branch-a" });

    expect(BranchModel.findOne).toHaveBeenCalledWith({
      _id: "branch-a",
      companyCode: "ACME",
      isActive: true,
    });
  });

  it("rejects a foreign or inactive branch selected by an admin", async () => {
    vi.spyOn(BranchModel, "findOne").mockReturnValue({
      select: () => ({ lean: async () => null }),
    } as never);

    await expect(
      resolveRecruitmentScope(request("admin", undefined, "branch-x")),
    ).rejects.toThrow("Branch is outside company scope or inactive");
  });

  it("forces non-admin users to their profile branch and ignores headers", async () => {
    const findOne = vi.spyOn(BranchModel, "findOne").mockReturnValue({
      select: () => ({ lean: async () => ({ _id: "branch-profile" }) }),
    } as never);

    await expect(
      resolveRecruitmentScope(
        request("manager", "branch-profile", "branch-requested"),
      ),
    ).resolves.toEqual({ companyCode: "ACME", branchId: "branch-profile" });

    expect(findOne).toHaveBeenCalledWith({
      _id: "branch-profile",
      companyCode: "ACME",
      isActive: true,
    });
  });

  it("rejects a non-admin whose profile branch is missing or inactive", async () => {
    await expect(
      resolveRecruitmentScope(request("manager", undefined, "branch-requested")),
    ).rejects.toThrow("A profile branch is required");

    vi.spyOn(BranchModel, "findOne").mockReturnValue({
      select: () => ({ lean: async () => null }),
    } as never);

    await expect(
      resolveRecruitmentScope(request("manager", "branch-inactive")),
    ).rejects.toThrow("Branch is outside company scope or inactive");
  });
});
