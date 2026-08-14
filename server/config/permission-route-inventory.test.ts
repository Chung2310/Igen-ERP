import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  permissionRouteDiagnostics,
  PUBLIC_ROUTE_EXCEPTIONS,
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

  it("resolves a local permission alias used as route middleware", () => {
    const [route] = scanPermissionRouteSource(`
      const RETAIL_MANAGE_PERMISSION = "retail:manage";
      const operate = requirePermission([RETAIL_MANAGE_PERMISSION]);
      router.post("/x", operate, handler);
    `, "fixture.router.ts");
    expect(route.permissionCodes).toEqual(["retail:manage"]);
    expect(route.diagnostics).toEqual([]);
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
      `webhookRouter.post("/payment", handler);`,
      "server/router/webhook.router.ts",
      {},
      { mounts: { webhookRouter: "/webhook" } },
    );

    expect(route.diagnostics).toEqual([]);
    expect(scanPermissionRouteSource(`webhookRouter.post("/payment", handler);`, "server/router/webhook.router.ts", {}, { mounts: { webhookRouter: "/private" } })[0].diagnostics).not.toEqual([]);
    expect(scanPermissionRouteSource(`router.post("/payment", handler);`, "server/modules/student-management/routes/webhook.routes.ts")[0].diagnostics).toEqual([]);
  });

  it("documents the signed Google Drive OAuth callback as a public protocol exception", () => {
    expect(PUBLIC_ROUTE_EXCEPTIONS).toContainEqual(expect.objectContaining({
      sourceFile: "server/router/google-drive.router.ts",
      router: "googleDriveRouter",
      mount: "/integrations/google-drive",
      method: "GET",
      path: "/callback",
    }));
  });

  it("does not treat a handler-body alias as route middleware", () => {
    const [route] = scanPermissionRouteSource(`router.post("/x", requireAuth, (req, res) => { const operate = requirePermission("retail:manage"); });`, "fixture.router.ts");
    expect(route.permissionCodes).toEqual([]);
  });

  it("inherits permission guards from router-level middleware and named wrappers", () => {
    const routes = scanPermissionRouteSource(`
      const read = requirePermission("chat:read");
      async function readGuard(req, res, next) { return read(req, res, next); }
      router.use(requireAuth, readGuard);
      router.post("/rooms", handler);
    `, "fixture.router.ts");
    expect(routes[0]).toMatchObject({ permissionCodes: ["chat:read"], diagnostics: [] });
  });

  it("records nested webhook router identity and resolved mount", () => {
    const [route] = scanPermissionRouteSource(`router.post("/payment", handler);`, "server/modules/student-management/routes/webhook.routes.ts");
    expect(route).toMatchObject({ router: "router", mount: "/webhook" });
  });

  it("scans the repository router inventory and keeps the current baseline explicit", () => {
    const routes = scanPermissionRouteInventory(process.cwd());
    const diagnostics = permissionRouteDiagnostics(process.cwd());
    expect(routes.length).toBeGreaterThan(0);
    expect(diagnostics.every((item) => item.sourceFile && item.method && item.path && item.kind)).toBe(true);
    // This is an audit contract: existing gaps remain visible until route-fix tasks remove them.
    const baselineIdentity = diagnostics.map(({ sourceFile, line, method, path, kind }) => ({ sourceFile, line, method, path, kind }));
    const fingerprint = createHash("sha256").update(JSON.stringify(baselineIdentity)).digest("hex");
    // 218 findings remain after reviewed router-level guards and wrappers are
    // resolved; each remaining mutation is tracked for a follow-up route fix.
    expect({ count: baselineIdentity.length, fingerprint }).toEqual({ count: 218, fingerprint: "e3cddd970738a3046ae9d74d2943bfafc763cafa03da6c31c86a7c96686d6ce3" });
  });

  it("does not report a false unknown permission for retail order routes", () => {
    const diagnostics = permissionRouteDiagnostics(process.cwd()).filter((item) => item.sourceFile.endsWith("server/modules/retail/routes/retail-order.routes.ts"));
    expect(diagnostics.filter((item) => item.kind === "unknown-permission")).toEqual([]);
  });
});
