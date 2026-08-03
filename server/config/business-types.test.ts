import assert from "node:assert/strict";
import test from "node:test";
import { filterModulesForBusinessType, getRequiredBusinessModule, resolveBusinessType } from "./business-types";

test("legacy entity presets resolve to business types", () => {
  assert.equal(resolveBusinessType(undefined, "student"), "education");
  assert.equal(resolveBusinessType(undefined, "worker"), "labor");
  assert.equal(resolveBusinessType(undefined, "customer"), "service");
  assert.equal(resolveBusinessType(undefined, "candidate"), "recruitment");
});

test("business type filters incompatible business modules", () => {
  assert.deepEqual(filterModulesForBusinessType(["student", "worker", "hr", "chat"], "labor"), ["worker", "hr", "chat"]);
  assert.deepEqual(filterModulesForBusinessType(["student", "worker", "resource"], "education"), ["student", "resource"]);
});

test("required business module is forced into filtered module list", () => {
  assert.deepEqual(filterModulesForBusinessType(["hr"], "labor"), ["worker", "hr"]);
  assert.equal(getRequiredBusinessModule("general"), null);
});
