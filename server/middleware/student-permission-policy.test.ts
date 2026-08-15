import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { PERMISSION_CATALOG } from "../config/permission-catalog";
import { DEFAULT_ROLE_PERMISSIONS, hasAnyPermission } from "./auth";

const EXPECTED_CODES = [
  "people:read", "people:manage",
  "people:read", "people:manage",
  "people:read", "people:manage",
  "people:read", "people:manage",
  "people:read", "people:manage",
  "people:read", "people:manage",
  "resource:read", "resource:manage",
  "people:read", "people:manage",
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
  assert.equal(hasAnyPermission(new Set(["*"]), ["people:manage"]), true);
  assert.equal(hasAnyPermission(new Set(["people:read"]), ["people:read", "people:read"]), true);
  assert.equal(hasAnyPermission(new Set(["people:read"]), ["people:manage"]), false);
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
