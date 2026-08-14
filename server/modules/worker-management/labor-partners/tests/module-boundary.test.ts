import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(root, entry.name)) : [path.join(root, entry.name)]);
}

describe("labor partners module boundary", () => {
  it("does not import student partner implementation", () => {
    const root = path.join(process.cwd(), "server/modules/worker-management/labor-partners");
    for (const file of files(root).filter((item) => item.endsWith(".ts") && !item.endsWith(".test.ts"))) {
      expect(fs.readFileSync(file, "utf8")).not.toContain("student-management/pages/Partners");
    }
  });
});
