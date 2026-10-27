import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../../model/user.model";
import { RolePermissionModel } from "../../model/role-permission.model";
import { customerRouter } from "./router";

describe("POS customer permissions", () => {
  beforeEach(() => {
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [] }) }) } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => null } as any);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["get", "/search", true], ["post", "/", true], ["get", "/:id/billing-profiles", true], ["post", "/:id/billing-profiles", true],
    ["get", "/", false], ["patch", "/:id", false], ["post", "/:id/deactivate", false],
    ["patch", "/settings", false],
  ])("checks %s %s for a cashier", async (method, path, allowed) => {
    const route: any = customerRouter.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
    expect(route).toBeDefined();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await route.route.stack[0].handle({ user: { id: "cashier-1", role: "pos_cashier", companyCode: "ACME" } }, res, next);
    if (allowed) expect(next).toHaveBeenCalledOnce();
    else { expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(403); }
  });
});
