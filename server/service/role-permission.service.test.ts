import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), save: vi.fn() }));
vi.mock("../model/role-permission.model", () => ({
  RolePermissionModel: Object.assign(function RolePermissionModel(this: any, value: any) {
    Object.assign(this, value);
    this.save = mocks.save;
  }, { findOne: mocks.findOne }),
}));

import { rolePermissionService } from "./role-permission.service";

describe("role permission persistence", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns compact stored and expanded effective permissions", async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.save.mockImplementation(async function (this: any) { return this; });

    const result = await rolePermissionService.saveRolePermission({
      companyCode: " acme ",
      role: "manager",
      permissions: ["hr:read", "hr:manage", "payroll-payment:read"],
      level: 3,
      displayName: "Quản lý",
    });

    expect(result.stored).toEqual(["hr:manage", "payroll-payment:read"]);
    expect(result.effective).toEqual(["hr:manage", "hr:read", "payroll-payment:read"]);
    expect(result.rolePermission).toMatchObject({ companyCode: "ACME", role: "manager" });
  });

  it("rejects invalid permission codes before querying storage", async () => {
    await expect(rolePermissionService.saveRolePermission({
      companyCode: "ACME",
      role: "manager",
      permissions: ["payroll:pay"],
      level: 3,
    })).rejects.toMatchObject({ invalidCodes: ["payroll:pay"] });
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("rejects a missing company scope with a stable validation error", async () => {
    await expect(rolePermissionService.saveRolePermission({
      role: "manager",
      permissions: [],
      level: 3,
    })).rejects.toMatchObject({ code: "ROLE_COMPANY_REQUIRED" });
  });
});
