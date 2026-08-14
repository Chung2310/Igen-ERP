import { describe, expect, it } from "vitest";
import {
  scanPermissionRouteSource,
  type PermissionRouteDiagnostic,
} from "./permission-route-inventory";

describe("permission route inventory", () => {
  it("extracts mutation routes and their canonical permission guards", () => {
    const routes = scanPermissionRouteSource(
      `
        router.post("/items", requireAuth, requirePermission("inventory:manage"), handler);
        router.get("/items", requireAuth, requirePermission("inventory:read"), handler);
      `,
      "fixture.router.ts",
    );

    expect(routes).toEqual([
      expect.objectContaining({ method: "POST", path: "/items", permissionCodes: ["inventory:manage"] }),
      expect.objectContaining({ method: "GET", path: "/items", permissionCodes: ["inventory:read"] }),
    ]);
  });

  it("reports missing and unknown guards with source, method, and path", () => {
    const diagnostics: PermissionRouteDiagnostic[] = scanPermissionRouteSource(
      `
        router.post("/open", requireAuth, handler);
        router.patch("/bad", requireAuth, requirePermission("not-a-code"), handler);
      `,
      "fixture.router.ts",
    ).flatMap((route) => route.diagnostics);

    expect(diagnostics).toEqual([
      expect.objectContaining({ sourceFile: "fixture.router.ts", method: "POST", path: "/open", kind: "missing-permission" }),
      expect.objectContaining({ sourceFile: "fixture.router.ts", method: "PATCH", path: "/bad", kind: "unknown-permission" }),
    ]);
  });

  it("allows explicitly documented public webhook exceptions", () => {
    const [route] = scanPermissionRouteSource(
      `router.post("/webhooks/payos", handler);`,
      "payments.router.ts",
    );

    expect(route.diagnostics).toEqual([]);
  });
});
