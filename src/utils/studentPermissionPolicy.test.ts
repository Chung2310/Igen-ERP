import assert from "node:assert/strict";
import { test } from "vitest";
import { canManageStudentArea, canReadStudentArea } from "./studentPermissionPolicy";

test("student umbrella permissions preserve operational access", () => {
  assert.equal(canReadStudentArea(["student:read"], "course"), true);
  assert.equal(canReadStudentArea(["student:manage"], "payment"), true);
  assert.equal(canManageStudentArea(["student:manage"], "student-resource"), true);
});

test("retired granular permissions do not grant operational student access", () => {
  assert.equal(canReadStudentArea(["course:manage"], "course"), false);
  assert.equal(canManageStudentArea(["course:manage"], "course"), false);
  assert.equal(canReadStudentArea(["course:manage"], "batch"), false);
});

test("student umbrella manage does not grant configuration permissions", () => {
  assert.equal(canManageStudentArea(["student:manage"], "custom-field"), false);
  assert.equal(canManageStudentArea(["student:manage"], "student-settings"), false);
  assert.equal(canManageStudentArea(["student:manage"], "company-smtp"), false);
  assert.equal(canManageStudentArea(["company-smtp:manage"], "company-smtp"), true);
});
