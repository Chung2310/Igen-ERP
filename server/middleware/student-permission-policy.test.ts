import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { PERMISSION_CATALOG } from "../config/permission-catalog";
import { DEFAULT_ROLE_PERMISSIONS, hasAnyPermission } from "./auth";

const EXPECTED_CODES = [
  "student-profile:read", "student-profile:manage",
  "course:read", "course:manage",
  "batch:read", "batch:manage",
  "exam:read", "exam:manage",
  "payment:read", "payment:manage",
  "student-notification:read", "student-notification:manage",
  "student-resource:read", "student-resource:manage",
  "assignment:read", "assignment:manage",
  "settings:manage", "settings:manage", "settings:manage",
];

test("catalog exposes every granular student permission with user-facing metadata", () => {
  const entries = new Map(PERMISSION_CATALOG.map((entry) => [entry.code, entry]));
  for (const code of EXPECTED_CODES) {
    const entry = entries.get(code);
    assert.ok(entry, `missing ${code}`);
    assert.ok(entry.label.trim(), `${code} needs a label`);
    assert.ok(entry.group.trim(), `${code} needs a group`);
    assert.ok(entry.description?.trim(), `${code} needs a description`);
    assert.equal(PERMISSION_CATALOG.filter((item) => item.code === code).length, 1);
  }
});

test("permission policy accepts wildcard or any matching permission", () => {
  assert.equal(hasAnyPermission(new Set(["*"]), ["course:manage"]), true);
  assert.equal(hasAnyPermission(new Set(["course:read"]), ["people:read", "course:read"]), true);
  assert.equal(hasAnyPermission(new Set(["batch:read"]), ["people:read", "course:read"]), false);
});

test("company admin has access to every enabled business module", () => {
  for (const permission of ["people:manage", "people:manage", "relationship:manage", "relationship:manage"]) {
    assert.equal(hasAnyPermission(new Set(DEFAULT_ROLE_PERMISSIONS.admin), [permission]), true);
  }
});

test("database seeding consumes the canonical permission catalog", () => {
  const source = fs.readFileSync("server/config/database.ts", "utf8");
  assert.match(source, /PERMISSION_CATALOG/);
});
