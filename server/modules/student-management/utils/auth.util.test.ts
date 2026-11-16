import { describe, expect, it, vi } from "vitest";
import { User } from "../models/user.model";
import { buildCompanyUserFilter, buildStudentBranchQuery, getAllowedOwnerIds, getCenterOwnerIds, requireStudentBranch } from "./auth.util";

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

  it("shows both admins the same company-admin-owned records in their selected branch", async () => {
    const find = vi.spyOn(User, "find").mockImplementation(((query: Record<string, string>) => ({
      select: async () => (query.role === "admin"
        ? ["admin-a", "admin-b"].map((id) => ({ _id: { toString: () => id } }))
        : [{ _id: { toString: () => "branch-worker" } }]),
    })) as unknown as typeof User.find);

    try {
      const base = { role: "admin", centerId: "ACME", companyCode: "ACME", branchId: "branch-a" };
      const first = await getAllowedOwnerIds({ ...base, uid: "admin-a" });
      const second = await getAllowedOwnerIds({ ...base, uid: "admin-b" });
      const createScope = await getCenterOwnerIds({ ...base, uid: "admin-a" });

      expect(first).toEqual(["branch-worker", "branch-a", "admin-a", "admin-b"]);
      expect(second).toEqual(first);
      expect(createScope).toEqual(["branch-worker", "branch-a", "admin-a", "admin-b"]);
      expect(find).toHaveBeenCalledWith({ companyCode: "ACME", role: "admin" });
      expect(find).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "branch-a" });
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("keeps a branch manager limited to users assigned to that branch", async () => {
    const find = vi.spyOn(User, "find").mockReturnValue({
      select: async () => [{ _id: { toString: () => "branch-worker" } }],
    } as never);
    try {
      expect(await getAllowedOwnerIds({ uid: "manager-a", role: "manager", centerId: "ACME", companyCode: "ACME", branchId: "branch-a" }))
        .toEqual(["branch-worker", "branch-a"]);
      expect(find).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
