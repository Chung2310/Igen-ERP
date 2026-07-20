import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_KEYS } from "../config/module-keys";
import { resolveProfileEnabledModules } from "./auth-profile-modules";

test("returns the company's enabled modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["hr", "chat"]), ["hr", "chat"]);
});

test("missing or empty company modules enable every module for backward compatibility", () => {
  assert.deepEqual(resolveProfileEnabledModules(undefined), [...MODULE_KEYS]);
  assert.deepEqual(resolveProfileEnabledModules([]), [...MODULE_KEYS]);
});

test("invalid company module keys are removed", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "unknown"]), ["student"]);
});
