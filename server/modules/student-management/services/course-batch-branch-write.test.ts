import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "vitest";

it("scopes course code uniqueness to the branch being created", () => {
  const source = readFileSync(new URL("./course.service.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /Course\.findOne\(\{\s*ownerId,\s*branchId:\s*writeData\.branchId,\s*code:/,
  );
});

it("scopes batch code and referenced courses to the authenticated branch", () => {
  const source = readFileSync(new URL("./batch.service.ts", import.meta.url), "utf8");
  assert.match(source, /Batch\.findOne\(\{\s*ownerId,\s*branchId:\s*actor\.branchId,\s*code:/);
  assert.match(source, /Course\.findOne\(\{\s*_id:\s*writeData\.courseId,\s*ownerId,\s*branchId:\s*actor\.branchId\s*\}\)/);
  assert.match(
    source,
    /Batch\.findOne\(\{\s*ownerId:\s*batch\.ownerId,\s*branchId:\s*batch\.branchId,\s*code:/,
  );
  assert.match(
    source,
    /Course\.findOne\(\{\s*_id:\s*writeData\.courseId,\s*ownerId:\s*batch\.ownerId,\s*branchId:\s*batch\.branchId\s*\}\)/,
  );
});
