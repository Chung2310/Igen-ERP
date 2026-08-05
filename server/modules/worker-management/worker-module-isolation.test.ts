import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(file: string) {
  return fs.readFileSync(file, "utf8");
}

function workerSourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return workerSourceFiles(target);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)
      ? [target]
      : [];
  });
}

describe("worker backend module boundaries", () => {
  it("does not mount student routes under worker-management", () => {
    const source = read("server/modules/worker-management/router.ts");
    expect(source).not.toContain("studentManagementRouter");
    expect(source).not.toContain("../student-management/");
  });

  it("keeps worker production files free of student models and modules", () => {
    const forbiddenReferences = workerSourceFiles("server/modules/worker-management").filter((file) =>
      /student-management|StudentModel|BatchModel/.test(read(file)),
    );
    expect(forbiddenReferences).toEqual([]);
  });
});
