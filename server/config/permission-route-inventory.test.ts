import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  permissionRouteDiagnostics,
  scanPermissionRouteInventory,
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
      `router.post("/payment", handler);`,
      "server/router/webhook.router.ts",
    );

    expect(route.diagnostics).toEqual([]);
    expect(scanPermissionRouteSource(`router.post("/webhooks/payos", handler);`, "server/router/webhook.router.ts")[0].diagnostics).not.toEqual([]);
  });

  it("scans the repository router inventory and keeps the current baseline explicit", () => {
    const routes = scanPermissionRouteInventory(process.cwd());
    const diagnostics = permissionRouteDiagnostics(process.cwd());
    expect(routes.length).toBeGreaterThan(0);
    expect(diagnostics.every((item) => item.sourceFile && item.method && item.path && item.kind)).toBe(true);
    // This is an audit contract: existing gaps remain visible until route-fix tasks remove them.
    const baselineIdentity = diagnostics.map(({ sourceFile, line, method, path, kind }) => ({ sourceFile, line, method, path, kind }));
    const fingerprint = createHash("sha256").update(JSON.stringify(baselineIdentity)).digest("hex");
    expect({ count: baselineIdentity.length, fingerprint }).toEqual({ count: 367, fingerprint: "3713f2579d9c1df57bbc211582c4e3c427a4b2f3ee0e3d3205d889d30b8a21e3" });
  });
});
