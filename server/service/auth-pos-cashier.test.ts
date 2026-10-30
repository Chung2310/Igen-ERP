import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { getEffectivePermissions } from "../middleware/auth";
import { emitToUserSession } from "../socket";
import { authService } from "./auth.service";
import { createUserAccessManagementService } from "../super-admin/user-access-management.service";

vi.mock("../socket", () => ({ emitToUserSession: vi.fn() }));

const branchId = "507f1f77bcf86cd799439011";
const createInput = { displayName: "Cashier", email: "cashier@example.test", password: "password", role: "pos_cashier", companyCode: "ACME" };
const makeUser = (role = "pos_cashier") => ({ _id: "cashier-1", role, companyCode: "ACME", branchId, activeSessionId: "old-session", save: vi.fn(async () => undefined) });

describe("POS cashier access and assignment", () => {
  beforeEach(() => {
    vi.spyOn(UserModel, "findOne").mockResolvedValue(null);
    vi.spyOn(BranchModel, "findOne").mockReturnValue({ lean: async () => ({ _id: branchId }), select: () => ({ lean: async () => ({ _id: branchId }) }) } as any);
  });

  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("grants only POS permissions through the canonical role fallback", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [] }) }) } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => null } as any);
    const permissions = await getEffectivePermissions("cashier-1", "pos_cashier", "ACME");
    expect([...permissions].sort()).toEqual(["pos:manage", "pos:read"]);
  });

  it("keeps the mandatory POS permission when a company role record omits it", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [] }) }) } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => ({ permissions: ["customer:read"] }) } as any);
    const permissions = await getEffectivePermissions("cashier-1", "pos_cashier", "ACME");
    expect(permissions.has("pos:manage")).toBe(true);
    expect(permissions.has("pos:read")).toBe(true);
    expect(permissions.has("customer:read")).toBe(true);
    expect(permissions.has("retail:manage")).toBe(false);
  });

  it("rejects creation without an assigned branch", async () => {
    const save = vi.spyOn(UserModel.prototype, "save");
    await expect(authService.registerUserForCompany(createInput, "ACME", "superadmin")).rejects.toThrow(/chi nhánh/);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects an inactive branch or one belonging to another company", async () => {
    vi.mocked(BranchModel.findOne).mockReturnValue({ lean: async () => null } as any);
    await expect(authService.registerUserForCompany({ ...createInput, branchId }, "ACME", "superadmin")).rejects.toThrow(/Chi nhánh/);
    expect(BranchModel.findOne).toHaveBeenCalledWith({ _id: branchId, companyCode: "ACME", isActive: true });
  });

  it("creates a cashier in a valid company branch", async () => {
    vi.spyOn(UserModel.prototype, "save").mockImplementation(async function (this: any) { return this; } as any);
    const user = await authService.registerUserForCompany({ ...createInput, branchId }, "ACME", "superadmin");
    expect(user.role).toBe("pos_cashier");
    expect(user.branchId).toBe(branchId);
    expect(user.jobTitle).toBe("Nhân viên bán hàng POS");
  });

  it("prevents clearing the branch of an existing cashier", async () => {
    vi.spyOn(UserModel, "findById").mockResolvedValue(makeUser() as any);
    const write = vi.spyOn(UserModel, "findByIdAndUpdate");
    await expect(authService.updateUser("cashier-1", { branchId: null }, "ACME", "superadmin")).rejects.toThrow(/chi nhánh/);
    expect(write).not.toHaveBeenCalled();
  });

  it("invalidates the old session and notifies it after a role change", async () => {
    const user = makeUser("user");
    vi.spyOn(UserModel, "findById").mockResolvedValue(user as any);
    const write = vi.spyOn(UserModel, "findByIdAndUpdate").mockReturnValue({ select: async () => ({ ...user, role: "pos_cashier" }) } as any);
    await authService.updateUser("cashier-1", { role: "pos_cashier" }, "ACME", "superadmin");
    expect(write).toHaveBeenCalledWith("cashier-1", { $set: { role: "pos_cashier", activeSessionId: "" } }, { returnDocument: "after" });
    expect(emitToUserSession).toHaveBeenCalledWith("old-session", "auth:session-replaced", expect.objectContaining({ code: "SESSION_REPLACED" }));
  });

  it("enforces the branch requirement for bulk edits too", async () => {
    vi.spyOn(UserModel, "findById").mockResolvedValue(makeUser() as any);
    const write = vi.spyOn(UserModel, "findByIdAndUpdate");
    await expect(authService.bulkUpdateUsers([{ id: "cashier-1", branchId: null }], "ACME", "superadmin")).rejects.toThrow(/chi nhánh/);
    expect(write).not.toHaveBeenCalled();
  });

  it("invalidates a cashier session when its role changes through bulk edits", async () => {
    vi.spyOn(UserModel, "findById").mockResolvedValue(makeUser("user") as any);
    const write = vi.spyOn(UserModel, "findByIdAndUpdate").mockResolvedValue(null);
    await authService.bulkUpdateUsers([{ id: "cashier-1", role: "pos_cashier" }], "ACME", "superadmin");
    expect(write).toHaveBeenCalledWith("cashier-1", { $set: { role: "pos_cashier", activeSessionId: "" } });
    expect(emitToUserSession).toHaveBeenCalledWith("old-session", "auth:session-replaced", expect.any(Object));
  });

  it("enforces branch assignment in Super Admin role changes", async () => {
    const user = { ...makeUser("user"), branchId: "" };
    const service = createUserAccessManagementService({ users: { find: async () => user }, audit: async () => undefined });
    await expect(service.assignRole({ tenantId: "ACME", userId: user._id, role: "pos_cashier" })).rejects.toThrow(/active company branch/);
    expect(user.save).not.toHaveBeenCalled();
  });

  it("ends the previous session on a Super Admin role assignment", async () => {
    const user = makeUser("user");
    const service = createUserAccessManagementService({ users: { find: async () => user }, audit: async () => undefined });
    await service.assignRole({ tenantId: "ACME", userId: user._id, role: "pos_cashier" });
    expect(user.role).toBe("pos_cashier");
    expect(user.activeSessionId).toBe("");
    expect(emitToUserSession).toHaveBeenCalledWith("old-session", "auth:session-replaced", expect.any(Object));
  });
});
