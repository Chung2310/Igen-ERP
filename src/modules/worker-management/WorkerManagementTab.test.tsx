import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("WorkerWorkspace boundaries", () => {
  it("reuses workflow pieces only through shared-management", () => {
    const source = fs.readFileSync(
      "src/modules/worker-management/WorkerWorkspace.tsx",
      "utf8",
    );
    expect(source).toContain("../shared-management/");
    expect(source).not.toContain("../student-management/");
  });
});
