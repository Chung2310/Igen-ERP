import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

const files = ["./useBatches.ts", "./useCourses.ts", "./useExams.ts", "./useResources.ts", "../pages/Notifications/NotificationsPage.tsx"];

describe("student-management branch-aware loaders", () => {
  for (const file of files) {
    it(`${file} invalidates its loader when the active branch changes`, () => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      assert.match(source, /import\s*\{\s*useBranch\s*\}/);
      assert.match(source, /const\s*\{\s*activeBranchId\s*\}\s*=\s*useBranch\(\)/);
      assert.match(source, /\[[^\]]*activeBranchId[^\]]*\]/s);
    });
  }
});
