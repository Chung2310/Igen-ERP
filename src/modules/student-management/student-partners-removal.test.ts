import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("student management no longer owns the partners navigation", () => {
  const source = fs.readFileSync(
    "src/modules/student-management/StudentManagementTab.tsx",
    "utf8",
  );
  assert.doesNotMatch(source, /doi-tac/);
  assert.doesNotMatch(source, /PartnersPage/);
  assert.doesNotMatch(source, /"ĐỐI TÁC"/);
});
