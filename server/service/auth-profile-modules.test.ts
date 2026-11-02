import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODULE_KEYS } from "../config/module-keys";
import { resolveProfileEnabledModules } from "./auth-profile-modules";

test("returns the company's enabled modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["hr", "chat"]), ["hr", "chat"]);
});

test("missing or empty company modules resolve to general modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(undefined), DEFAULT_MODULE_KEYS);
  assert.deepEqual(resolveProfileEnabledModules([]), DEFAULT_MODULE_KEYS);
});

test("invalid company module keys are removed", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "unknown"]), ["student"]);
});

test("labor metadata does not replace selected modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "hr"], "labor"), ["student", "hr"]);
});

test("education metadata preserves both enabled modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["worker", "student", "chat"], "education"), ["worker", "student", "chat"]);
});
