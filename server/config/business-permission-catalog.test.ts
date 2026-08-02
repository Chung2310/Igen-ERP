import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION_CODES } from "./permission-catalog";

test("business modules have separate umbrella permissions", () => {
  for (const code of ["student:read", "student:manage", "worker:read", "worker:manage", "customer:read", "customer:manage", "candidate:read", "candidate:manage"]) assert.ok(PERMISSION_CODES.includes(code), `${code} missing`);
});
