import assert from "node:assert/strict";
import { test } from "vitest";
import { canManageStudentArea, canReadStudentArea } from "./studentPermissionPolicy";

test("student umbrella permissions preserve operational access", () => {
  assert.equal(canReadStudentArea(["people:read"], "course"), true);
  assert.equal(canReadStudentArea(["people:manage"], "payment"), true);
  assert.equal(canManageStudentArea(["people:manage"], "student-resource"), true);
});

test("retired granular permissions do not grant operational student access", () => {
  assert.equal(canReadStudentArea(["course:manage"], "course"), false);
  assert.equal(canManageStudentArea(["course:manage"], "course"), false);
  assert.equal(canReadStudentArea(["course:manage"], "batch"), false);
});

test("student umbrella manage does not grant configuration permissions", () => {
  assert.equal(canManageStudentArea(["people:manage"], "custom-field"), false);
  assert.equal(canManageStudentArea(["people:manage"], "student-settings"), false);
  assert.equal(canManageStudentArea(["people:manage"], "company-smtp"), false);
  assert.equal(canManageStudentArea(["settings:manage"], "company-smtp"), true);
});
