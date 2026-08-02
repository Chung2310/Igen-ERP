import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory()
      ? sourceFiles(target)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [target]
        : [];
  });
}

function importsModule(root: string, moduleName: string) {
  return sourceFiles(root).filter((file) => {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) return false;
    return fs.readFileSync(file, "utf8").includes(moduleName);
  });
}

describe("business module boundaries", () => {
  it("prevents worker implementation from importing student implementation", () => {
    expect(importsModule("src/modules/worker-management", "student-management")).toEqual([]);
    expect(importsModule("server/modules/worker-management", "student-management")).toEqual([]);
  });

  it("routes reuse through shared-management adapters", () => {
    const workspace = fs.readFileSync("src/modules/worker-management/WorkerWorkspace.tsx", "utf8");
    const router = fs.readFileSync("server/modules/worker-management/router.ts", "utf8");
    expect(workspace).toContain("../shared-management/");
    expect(router).toContain("../shared-management/router");
  });

  it("keeps independent worker extension points", () => {
    expect(fs.existsSync("server/modules/worker-management/routes/worker.routes.ts")).toBe(true);
    expect(fs.existsSync("server/modules/worker-management/services/worker.service.ts")).toBe(true);
    expect(fs.existsSync("src/modules/worker-management/api/workers.api.ts")).toBe(true);
  });
});
