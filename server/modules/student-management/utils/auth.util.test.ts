import { describe, expect, it } from "vitest";
import { buildCompanyUserFilter, buildStudentBranchQuery, requireStudentBranch } from "./auth.util";

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
