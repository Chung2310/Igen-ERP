import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfileEnabledModules } from "./auth-profile-modules";

test("returns the company's enabled modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(["hr", "chat"]), ["hr", "chat"]);
});

test("missing or empty company modules resolve to general modules", () => {
  assert.deepEqual(resolveProfileEnabledModules(undefined), ["hr", "inventory", "resource", "chat"]);
  assert.deepEqual(resolveProfileEnabledModules([]), ["hr", "inventory", "resource", "chat"]);
});

test("invalid company module keys are removed", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "unknown"]), []);
});

test("labor profile hides student and forces worker", () => {
  assert.deepEqual(resolveProfileEnabledModules(["student", "hr"], "labor"), ["worker", "hr"]);
});

test("education profile hides worker and keeps student", () => {
  assert.deepEqual(resolveProfileEnabledModules(["worker", "student", "chat"], "education"), ["student", "chat"]);
});
