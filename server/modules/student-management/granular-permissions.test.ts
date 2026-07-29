import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { STUDENT_AREA_PERMISSIONS } from "./permissions";

const source = (file: string) => fs.readFileSync(file, "utf8");

test("operational policies combine umbrella and granular permissions", () => {
  assert.deepEqual(STUDENT_AREA_PERMISSIONS.course.read, ["student:read", "student:manage", "course:read", "course:manage"]);
  assert.deepEqual(STUDENT_AREA_PERMISSIONS.course.manage, ["student:manage", "course:manage"]);
  assert.deepEqual(STUDENT_AREA_PERMISSIONS["student-profile"].manage, ["student:manage", "student-profile:manage"]);
  assert.deepEqual(STUDENT_AREA_PERMISSIONS.assignment.read, ["student:read", "student:manage", "assignment:read", "assignment:manage"]);
});

test("configuration policies are independent from the umbrella", () => {
  assert.deepEqual(STUDENT_AREA_PERMISSIONS["custom-field"].manage, ["custom-field:manage"]);
  assert.deepEqual(STUDENT_AREA_PERMISSIONS["student-settings"].manage, ["student-settings:manage"]);
  assert.deepEqual(STUDENT_AREA_PERMISSIONS["company-smtp"].manage, ["company-smtp:manage"]);
});

test("configuration routes no longer hard-code role names", () => {
  const customFields = source("server/modules/student-management/routes/custom-field.routes.ts");
  const settings = source("server/modules/student-management/routes/module-settings.routes.ts");
  const smtp = source("server/router/company-email.router.ts");
  assert.match(customFields, /custom-field/);
  assert.doesNotMatch(customFields, /requireRoles/);
  assert.match(settings, /student-settings/);
  assert.doesNotMatch(settings, /requireRoles/);
  assert.match(smtp, /company-smtp:manage/);
  assert.doesNotMatch(smtp, /adminOnly/);
});
