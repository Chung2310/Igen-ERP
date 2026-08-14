import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION_CODES } from "./permission-catalog";

test("business modules have separate umbrella permissions", () => {
  for (const code of ["people:read", "people:manage", "people:read", "people:manage", "relationship:read", "relationship:manage", "relationship:read", "relationship:manage"]) assert.ok(PERMISSION_CODES.includes(code), `${code} missing`);
});
