import assert from "node:assert/strict";
import test from "node:test";
import { filterModulesForBusinessType, getRequiredBusinessModule, resolveBusinessType, BUSINESS_TYPES } from "./business-types";

test("only exposes education and labor as selectable business types", () => {
  assert.deepEqual(BUSINESS_TYPES, ["education", "labor"]);
});

test("falls compatibility-only business types and legacy presets back to education", () => {
  assert.equal(resolveBusinessType("service"), "education");
  assert.equal(resolveBusinessType("recruitment"), "education");
  assert.equal(resolveBusinessType("general"), "education");
  assert.equal(resolveBusinessType(undefined, "customer"), "education");
  assert.equal(resolveBusinessType(undefined, "candidate"), "education");
  assert.equal(resolveBusinessType(undefined, "student"), "education");
  assert.equal(resolveBusinessType(undefined, "worker"), "labor");
});

test("allows student, worker, customer, and candidate to be configured freely", () => {
  assert.deepEqual(filterModulesForBusinessType(["student", "worker", "hr", "chat"], "education"), ["student", "worker", "hr", "chat"]);
  assert.deepEqual(filterModulesForBusinessType(["student", "worker", "hr", "chat"], "labor"), ["student", "worker", "hr", "chat"]);
});

