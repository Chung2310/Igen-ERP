import { describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => new Map<any, string | string[]>());

vi.mock("../middleware/auth", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requirePermission: (permission: string | string[]) => {
      const guard = (_req: any, _res: any, next: any) => next();
      guards.set(guard, permission);
      return guard;
    },
  };
});

import { notificationRouter } from "./notification.router";
import { rolePermissionRouter } from "./role-permission.router";

function permissionOf(router: any, method: string, path: string) {
  const layer = router.stack.find((item: any) => (
    item.route?.path === path && item.route?.methods?.[method.toLowerCase()]
  ));
  return layer?.route.stack
    .map((handler: any) => guards.get(handler.handle))
    .find((permission: string | undefined) => permission !== undefined);
}

describe("notification and access administration permissions", () => {
  it("keeps a user's notification inbox self-service while restricting delivery to chat managers", () => {
    expect(permissionOf(notificationRouter, "POST", "/")).toBe("chat:manage");

    for (const [method, path] of [["GET", "/"], ["PATCH", "/read-all"], ["PATCH", "/:id/read"], ["DELETE", "/:id"]]) {
      expect(permissionOf(notificationRouter, method, path), `${method} ${path} must remain self-service`).toBeUndefined();
    }
  });

  it("uses canonical access permissions for tenant-scoped role configuration", () => {
    expect(permissionOf(rolePermissionRouter, "GET", "/")).toBe("access:read");
    expect(permissionOf(rolePermissionRouter, "GET", "/:role")).toBe("access:read");
    expect(permissionOf(rolePermissionRouter, "POST", "/")).toBe("access:manage");
    expect(permissionOf(rolePermissionRouter, "DELETE", "/:role")).toBe("access:manage");
  });
});
