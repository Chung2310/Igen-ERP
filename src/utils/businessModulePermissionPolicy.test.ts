import assert from "node:assert/strict";
import { test } from "vitest";
import {
  canManageBusinessModule,
  canReadBusinessModule,
  type BusinessModuleKey,
} from "./businessModulePermissionPolicy";

const businessModules: BusinessModuleKey[] = ["student", "worker", "customer", "candidate"];

test("business module permissions allow read and manage for every module", () => {
  for (const module of businessModules) {
    assert.equal(canReadBusinessModule([`${module}:read`], module), true);
    assert.equal(canReadBusinessModule([`${module}:manage`], module), true);
    assert.equal(canManageBusinessModule([`${module}:manage`], module), true);
  }
});

test("business module wildcard permission allows read and manage", () => {
  for (const module of businessModules) {
    assert.equal(canReadBusinessModule(["*"], module), true);
    assert.equal(canManageBusinessModule(["*"], module), true);
  }
});

test("business module read permission does not grant manage access", () => {
  for (const module of businessModules) {
    assert.equal(canManageBusinessModule([`${module}:read`], module), false);
  }
});
