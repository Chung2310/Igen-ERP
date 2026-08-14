import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyticsRouter } from "./analytics.router";

describe("analytics router", () => {
  const routeMiddlewareNames = (path: string) => {
    const layer = analyticsRouter.stack.find((entry: any) => entry.route?.path === path);
    return layer?.route.stack.map((entry: any) => entry.handle.name);
  };

  it("keeps authentication at router level", () => {
    const middleware = analyticsRouter.stack.filter((layer: any) => !layer.route).map((layer: any) => layer.handle);
    expect(middleware).toHaveLength(1);
    expect(middleware[0].name).toBe("requireAuth");
  });

  it("requires dashboard:read for every reporting endpoint", () => {
    for (const path of ["/meta", "/revenue", "/receivables", "/expenses", "/operating-expenses", "/pnl", "/export"]) {
      expect(routeMiddlewareNames(path), `missing dashboard read guard on ${path}`).toContain("readPermissionGuard");
    }
  });

  it("requires dashboard:manage for operating-expense mutations", () => {
    for (const path of ["/operating-expenses", "/operating-expenses/:id"]) {
      expect(routeMiddlewareNames(path), `missing dashboard manage guard on ${path}`).toContain("managePermissionGuard");
    }
  });

  it("uses the canonical dashboard permissions and keeps controller queries company-scoped", () => {
    const routerSource = readFileSync(new URL("./analytics.router.ts", import.meta.url), "utf8");
    const controllerSource = readFileSync(new URL("../controller/analytics.controller.ts", import.meta.url), "utf8");

    expect(routerSource).toContain('requirePermission("dashboard:read")');
    expect(routerSource).toContain('requirePermission("dashboard:manage")');
    expect(controllerSource).toMatch(/companyCode: req\.user\.companyCode/);
  });

  it("registers the reporting endpoints", () => {
    const paths = analyticsRouter.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);
    for (const path of ["/meta", "/revenue", "/receivables", "/expenses", "/pnl", "/export"]) {
      expect(paths, `missing analytics endpoint ${path}`).toContain(path);
    }
  });
});
