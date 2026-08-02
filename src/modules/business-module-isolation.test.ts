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

function crossModuleImports(root: string, forbiddenModule: string) {
  return sourceFiles(root).filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    return new RegExp(
      `(?:from\\s+|import\\s*\\()["'][^"']*${forbiddenModule}`,
    ).test(source);
  });
}

describe("business module source isolation", () => {
  it("prevents frontend Student and Worker from importing each other", () => {
    expect(
      crossModuleImports("src/modules/worker-management", "student-management"),
    ).toEqual([]);
    expect(
      crossModuleImports("src/modules/student-management", "worker-management"),
    ).toEqual([]);
  });

  it("prevents backend Student and Worker from importing each other", () => {
    expect(
      crossModuleImports(
        "server/modules/worker-management",
        "student-management",
      ),
    ).toEqual([]);
    expect(
      crossModuleImports(
        "server/modules/student-management",
        "worker-management",
      ),
    ).toEqual([]);
  });

  it("keeps independent module guards, API namespaces, and Mongoose model names", () => {
    const workerRouter = fs.readFileSync(
      "server/modules/worker-management/router.ts",
      "utf8",
    );
    const apiRouter = fs.readFileSync("server/router/index.ts", "utf8");
    const workerModels = sourceFiles("server/modules/worker-management/models")
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    expect(workerRouter).toContain('requireModule("worker")');
    expect(workerRouter).not.toContain('requireModule("student")');
    expect(apiRouter).toContain('apiRouter.use("/worker-management"');
    expect(workerModels).toContain('"WorkerProfile"');
    expect(workerModels).toContain('"WorkerCourse"');
    expect(workerModels).toContain('"WorkerBatch"');
  });

  it("shares project infrastructure instead of duplicating DB, Cloudinary, and logger implementations", () => {
    for (const moduleName of ["student-management", "worker-management"]) {
      const configRoot = `server/modules/${moduleName}/config`;
      expect(fs.readFileSync(`${configRoot}/db.ts`, "utf8")).toContain(
        "../../../config/database",
      );
      expect(fs.readFileSync(`${configRoot}/cloudinary.ts`, "utf8")).toContain(
        "../../../config/cloudinary",
      );
      expect(fs.readFileSync(`${configRoot}/logger.ts`, "utf8")).toContain(
        "../../../config/logger",
      );
    }
  });
});
