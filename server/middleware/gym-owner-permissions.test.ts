import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyModel } from "../model/company.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { UserModel } from "../model/user.model";
import { getEffectivePermissions } from "./auth";

describe("Gym owner permissions", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockRecords(ownerEmail: string, modules: string[], userEmail = "owner@example.test") {
    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: () => ({ lean: async () => ({ role: "admin", companyCode: "ACME", email: userEmail, permissions: [] }) }),
    } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => ({ permissions: [] }) } as any);
    vi.spyOn(CompanyModel, "findOne").mockReturnValue({
      select: () => ({ lean: async () => ({ ownerEmail, enabledModules: modules }) }),
    } as any);
  }

  it("opens Gym administration for the company creator when Gym is enabled", async () => {
    mockRecords("OWNER@example.test", ["gym"]);
    const permissions = await getEffectivePermissions("owner-id", "admin", "ACME");
    expect(permissions.has("gym-admin:manage")).toBe(true);
    expect(permissions.has("gym-admin:read")).toBe(true);
  });

  it("removes automatic Gym administration when the module is disabled", async () => {
    mockRecords("owner@example.test", []);
    const permissions = await getEffectivePermissions("owner-id", "admin", "ACME");
    expect(permissions.has("gym-admin:manage")).toBe(false);
  });

  it("does not grant another company admin the owner's Gym access", async () => {
    mockRecords("owner@example.test", ["gym"], "other@example.test");
    const permissions = await getEffectivePermissions("other-id", "admin", "ACME");
    expect(permissions.has("gym-admin:manage")).toBe(false);
  });
});
