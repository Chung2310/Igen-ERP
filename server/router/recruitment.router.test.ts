import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { recruitmentRouter } from "./recruitment.router";

describe("recruitment router", () => {
  it("is mounted under the recruitment API path", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    expect(source).toContain('apiRouter.use("/recruitment", recruitmentRouter)');
  });

  it("applies auth, HR module, and one recruitment permission before routes", () => {
    const names = (recruitmentRouter as any).stack.slice(0, 3).map((layer: any) => layer.handle.name);
    expect(names[0]).toBe("requireAuth");
    expect(names[1]).toBe("moduleAccessGuard");
    expect(names[2]).toBe("recruitmentScopeGuard");
    expect((recruitmentRouter as any).stack.some((layer: any) => layer.route?.path === "/applicants/:applicantId/attachment")).toBe(true);
  });

  it("uses recruitment:read for GET routes and recruitment:manage for mutations", () => {
    const source = readFileSync(new URL("./recruitment.router.ts", import.meta.url), "utf8");
    const routes = (recruitmentRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
        middleware: layer.route.stack.map((entry: any) => entry.handle.name),
      }));

    for (const route of routes) {
      const expectedGuard = route.methods.every((method: string) => method === "get")
        ? "readPermissionGuard"
        : "managePermissionGuard";
      expect(route.middleware, `${route.methods.join(",").toUpperCase()} ${route.path}`).toContain(expectedGuard);
    }

    expect(source).toContain('requirePermission("recruitment:read")');
    expect(source).toContain('requirePermission("recruitment:manage")');
  });

  it("exposes one attachment endpoint for jobs and applicants", () => {
    const routes = (recruitmentRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    for (const path of ["/jobs/:jobId/attachment", "/applicants/:applicantId/attachment"]) {
      expect(routes).toContainEqual(expect.objectContaining({ path, methods: expect.objectContaining({ get: true }) }));
      expect(routes).toContainEqual(expect.objectContaining({ path, methods: expect.objectContaining({ post: true }) }));
    }
  });
  it("exposes public upload and cleanup routes", () => {
    const routes = (recruitmentRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    expect(routes).toContainEqual(expect.objectContaining({ path: "/files/public", methods: expect.objectContaining({ post: true }) }));
    expect(routes).toContainEqual(expect.objectContaining({ path: "/files/public", methods: expect.objectContaining({ delete: true }) }));
  });
});
