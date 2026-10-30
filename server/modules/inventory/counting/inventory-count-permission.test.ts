import { inventoryCountController } from "./inventory-count.controller";
import * as countService from "./inventory-count.service";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../../../model/user.model";
import { RolePermissionModel } from "../../../model/role-permission.model";
import { inventoryCountRouter } from "./router";
import { expandEffectivePermissions, isPermissionCode } from "../../../config/permission-catalog";

afterEach(() => vi.restoreAllMocks());
describe("count approval route authorization", () => {
  it.each([["inventory:read", false], ["inventory-count-approval:manage", false], ["inventory:manage", true]])("checks recreation permission for %s", async (permission, allowed) => {
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [permission], accountType: "internal" }) }) } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => ({ permissions: [] }) } as any);
    const layer = (inventoryCountRouter as any).stack.find((entry: any) => entry.route?.path === "/:id/recreate");
    const next = vi.fn();
    const response: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await layer.route.stack[0].handle({ user: { id: "counter", companyCode: "TEST", role: "user" } }, response, next);
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(response.status).toHaveBeenCalledWith(403);
  });
  it.each([
    ["inventory:read", false], ["inventory:manage", false],
    ["inventory-count-approval:read", false], ["inventory-count-approval:manage", true],
  ])("checks real permission middleware for %s", async (permission, allowed) => {
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [permission], accountType: "internal" }) }) } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => ({ permissions: [] }) } as any);
    const layer = (inventoryCountRouter as any).stack.find((entry: any) => entry.route?.path === "/:id/approve");
    const next = vi.fn();
    const response: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await layer.route.stack[0].handle({ user: { id: "approver", companyCode: "TEST", role: "user" } }, response, next);
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(response.status).toHaveBeenCalledWith(403);
  });
  it("registers independent permissions without expanding inventory manage into approval", () => {
    expect(isPermissionCode("inventory-count-approval:manage")).toBe(true);
    expect(expandEffectivePermissions(["inventory:manage"]).has("inventory-count-approval:manage")).toBe(false);
  });
});

it.each([["inventory:read", false], ["inventory-count-approval:manage", false], ["inventory:manage", true]])("checks quantity reconciliation permission for %s", async (permission, allowed) => {
  vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [permission], accountType: "internal" }) }) } as any);
  vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => ({ permissions: [] }) } as any);
  const layer = (inventoryCountRouter as any).stack.find((entry: any) => entry.route?.path === "/:id/items/:itemId/reconcile");
  const next = vi.fn(), response: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await layer.route.stack[0].handle({ user: { id: "counter", companyCode: "TEST", role: "user" } }, response, next);
  expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
  if (!allowed) expect(response.status).toHaveBeenCalledWith(403);
});

it.each(["updateItem", "reconcileItem", "revokeItemRequest"] as const)("binds %s to authenticated scope and actor, not body claims", async action => {
  const operation = vi.spyOn(countService, action === "updateItem" ? "updateCountItem" : action === "reconcileItem" ? "reconcileCountItem" : "revokeCountItemRequest").mockResolvedValue({} as any);
  const body = { actorId: "forged", branchId: "forged", companyCode: "forged", requestId: "key" };
  const request: any = { user: { id: "counter", companyCode: " test ", branchId: "b" }, params: { id: "c", itemId: "i" }, body };
  const response: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await inventoryCountController[action](request, response);
  expect(operation).toHaveBeenCalledWith({ companyCode: "TEST", branchId: "b" }, "c", "i", body, { id: "counter", email: undefined });
});

it.each([["inventory:read", false], ["inventory-count-approval:manage", false], ["inventory:manage", true]])("checks count request revocation permission for %s", async (permission, allowed) => {
  vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [permission], accountType: "internal" }) }) } as any);
  vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => ({ permissions: [] }) } as any);
  const layer = (inventoryCountRouter as any).stack.find((entry: any) => entry.route?.path === "/:id/items/:itemId/revoke-request");
  const next = vi.fn(), response: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  await layer.route.stack[0].handle({ user: { id: "counter", companyCode: "TEST", role: "user" } }, response, next);
  expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
  if (!allowed) expect(response.status).toHaveBeenCalledWith(403);
});
