import { describe, expect, it, vi } from "vitest";
import { User } from "../models/user.model";
import { buildCompanyUserFilter, buildStudentBranchQuery, getAllowedOwnerIds, requireStudentBranch } from "./auth.util";

describe("student management branch owner scope", () => {
  it("limits company owners to the authenticated branch", () => {
    expect(buildCompanyUserFilter("ACME", "branch-a")).toEqual({
      companyCode: "ACME",
      branchId: "branch-a",
    });
  });

  it("keeps the legacy company scope when no branch is available", () => {
    expect(buildCompanyUserFilter("ACME")).toEqual({ companyCode: "ACME" });
  });
});

describe("student management write branch", () => {
  it("uses the authenticated branch", () => {
    const user = { uid: "admin-a", role: "admin", centerId: "ACME", companyCode: "ACME", branchId: "branch-a" };
    expect(requireStudentBranch(user)).toBe("branch-a");
    expect(buildStudentBranchQuery("branch-a")).toEqual({ branchId: "branch-a" });
  });

  it("rejects an admin write without a selected branch", () => {
    const user = { uid: "admin-a", role: "admin", centerId: "ACME", companyCode: "ACME" };
    expect(() => requireStudentBranch(user)).toThrow(/chi nhánh/i);
  });
});

describe("admin Partner owner visibility", () => {
  it("always includes the admin uid inside the selected branch scope", async () => {
    const select = vi.fn().mockResolvedValue([{ _id: { toString: () => "worker-a" } }]);
    vi.spyOn(User, "find").mockReturnValue({ select } as never);

    const owners = await getAllowedOwnerIds({
      uid: "admin-id",
      role: "admin",
      centerId: "ACME",
      companyCode: "ACME",
      branchId: "branch-a",
    });

    expect(owners).toEqual(expect.arrayContaining(["worker-a", "branch-a", "admin-id"]));
    vi.restoreAllMocks();
  });
});