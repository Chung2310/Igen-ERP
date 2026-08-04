import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { workerRoutes } from "./worker.routes";

describe("worker routes", () => {
  it("exposes worker list and mutations with worker-only permissions", () => {
    const methods = workerRoutes.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`)
      .sort();

    expect(methods).toEqual(["DELETE /:id", "GET /", "PATCH /:id", "POST /"]);

    const source = readFileSync(new URL("./worker.routes.ts", import.meta.url), "utf8");
    expect(source).toContain("requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION])");
    expect(source).toContain("requirePermission(WORKER_MANAGE_PERMISSION)");
    expect(source).not.toContain("student:");
  });

  it("derives the same company and branch scope in every worker controller action", () => {
    const source = readFileSync(new URL("../controllers/worker.controller.ts", import.meta.url), "utf8");
    expect(source.match(/workerScopeFromActor\(\(req as any\)\.user \|\| \{\}\)/g)).toHaveLength(4);
  });
});