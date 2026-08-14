import assert from "node:assert/strict";
import test from "node:test";
import {
  PERMISSION_CATALOG,
  LEGACY_PERMISSION_MAP,
  normalizeStoredPermissions,
  expandEffectivePermissions,
} from "./permission-catalog";

test("catalog contains exactly fifteen read/manage pairs", () => {
  assert.equal(PERMISSION_CATALOG.length, 30);
  const groups = new Map<string, Set<string>>();
  for (const entry of PERMISSION_CATALOG) {
    const [area, action] = entry.code.split(":");
    const actions = groups.get(area) || new Set<string>();
    actions.add(action);
    groups.set(area, actions);
  }
  assert.equal(groups.size, 15);
  for (const actions of groups.values()) {
    assert.deepEqual([...actions].sort(), ["manage", "read"]);
  }
});

test("legacy grouped and sensitive permissions map to canonical permissions", () => {
  assert.equal(LEGACY_PERMISSION_MAP["student:manage"], "people:manage");
  assert.equal(LEGACY_PERMISSION_MAP["worker:read"], "people:read");
  assert.equal(LEGACY_PERMISSION_MAP["partner:manage"], "relationship:manage");
  assert.equal(LEGACY_PERMISSION_MAP["payroll:pay"], "payroll:manage");
  assert.equal(LEGACY_PERMISSION_MAP["receivable:adjust"], "finance:manage");
});

test("normalization maps, minimizes, and controls wildcard", () => {
  assert.deepEqual(normalizeStoredPermissions(["student:read", "student:manage"]), ["people:manage"]);
  assert.deepEqual(normalizeStoredPermissions(["*", "hr:read"]), ["hr:read"]);
  assert.deepEqual(normalizeStoredPermissions(["*"], { allowWildcard: true }), ["*"]);
  assert.deepEqual(normalizeStoredPermissions(["unknown:manage"]), []);
});

test("manage expands to read at runtime", () => {
  assert.deepEqual([...expandEffectivePermissions(["hr:manage"])].sort(), ["hr:manage", "hr:read"]);
});
