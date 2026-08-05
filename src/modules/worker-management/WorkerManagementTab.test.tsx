import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("WorkerWorkspace boundaries", () => {
  it("keeps the workspace self-contained in worker-management", () => {
    const source = fs.readFileSync(
      "src/modules/worker-management/WorkerWorkspace.tsx",
      "utf8",
    );
    expect(source).not.toContain("../shared-management/");
    expect(source).not.toContain("../student-management/");
  });
});
