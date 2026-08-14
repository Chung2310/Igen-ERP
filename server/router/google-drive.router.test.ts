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

import { googleDriveRouter } from "./google-drive.router";

const permissionOf = (method: string, path: string) => {
  const layer = (googleDriveRouter as any).stack.find((item: any) => (
    item.route?.path === path && item.route?.methods?.[method.toLowerCase()]
  ));
  if (!layer) return undefined;
  return layer.route.stack
    .map((handler: any) => guards.get(handler.handle))
    .find((permission: string | undefined) => permission !== undefined);
};

describe("Google Drive route permissions", () => {
  it.each([
    ["GET", "/resources"],
    ["GET", "/resources/group/:roomId"],
  ])("allows resource readers to call %s %s", (method, path) => {
    expect(permissionOf(method, path)).toBe("resource:read");
  });

  it.each([
    ["GET", "/auth-url"],
    ["POST", "/disconnect"],
    ["POST", "/upload"],
    ["POST", "/upload/group/:roomId"],
    ["POST", "/create-file"],
    ["PUT", "/groups/:roomId/permissions"],
    ["DELETE", "/resources/:id"],
    ["POST", "/resources/move"],
    ["PATCH", "/resources/:id/rename"],
  ])("requires resource management for %s %s", (method, path) => {
    expect(permissionOf(method, path)).toBe("resource:manage");
  });

  it("does not expose a protected Drive route without a permission guard", () => {
    const unguarded = (googleDriveRouter as any).stack
      .filter((item: any) => item.route?.path !== "/callback")
      .filter((item: any) => !item.route.stack.some((handler: any) => guards.has(handler.handle)))
      .map((item: any) => item.route.path);

    expect(unguarded).toEqual([]);
  });
});
