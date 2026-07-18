import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./kanban.router.ts", import.meta.url), "utf8");

test("kanban mutation routes emit traceable audit events", () => {
  assert.match(source, /X-Correlation-Id/);
  assert.equal((source.match(/recordTaskMutation\(/g) || []).length, 3);
  assert.equal((source.match(/recordProjectMutation\(/g) || []).length, 2);
});
