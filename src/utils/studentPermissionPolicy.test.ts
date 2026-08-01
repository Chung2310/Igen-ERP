import assert from "node:assert/strict";
import test from "node:test";
import { canManageStudentArea, canReadStudentArea } from "./studentPermissionPolicy";

test("umbrella permissions preserve operational access", () => {
  assert.equal(canReadStudentArea(["student:read"], "course"), true);
  assert.equal(canReadStudentArea(["student:manage"], "payment"), true);
  assert.equal(canManageStudentArea(["student:manage"], "student-resource"), true);
});

test("granular manage implies read only for the same area", () => {
  assert.equal(canReadStudentArea(["course:manage"], "course"), true);
  assert.equal(canManageStudentArea(["course:manage"], "course"), true);
  assert.equal(canReadStudentArea(["course:manage"], "batch"), false);
});

test("student umbrella manage does not grant configuration permissions", () => {
  assert.equal(canManageStudentArea(["student:manage"], "custom-field"), false);
  assert.equal(canManageStudentArea(["student:manage"], "student-settings"), false);
  assert.equal(canManageStudentArea(["student:manage"], "company-smtp"), false);
  assert.equal(canManageStudentArea(["company-smtp:manage"], "company-smtp"), true);
});
