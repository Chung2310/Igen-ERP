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
  const smtp = source("server/router/company-email.router.ts");
  assert.match(customFields, /custom-field/);
  assert.doesNotMatch(customFields, /requireRoles/);
  assert.match(smtp, /company-smtp:manage/);
  assert.doesNotMatch(smtp, /adminOnly/);
});

// Ngoại lệ có chủ đích so với test trên: loại hình doanh nghiệp (entityPreset)
// là đặc quyền SuperAdmin, doanh nghiệp không được tự sửa.
test("entity preset is writable by superadmin only", () => {
  const settings = source("server/modules/student-management/routes/module-settings.routes.ts");
  assert.match(settings, /router\.patch\([\s\S]*requireRoles\("superadmin"\)/);
  // Đọc phải mở cho mọi tài khoản: nhãn thực thể được dùng khắp hệ thống
  assert.doesNotMatch(settings, /router\.get\("\/",\s*require/);
  assert.doesNotMatch(settings, /STUDENT_AREA_PERMISSIONS/);

  const router = source("server/modules/student-management/router.ts");
  assert.doesNotMatch(router, /areaRead\("student-settings"\)/);

  // Role admin không còn được cấp mặc định quyền sửa cấu hình này
  const auth = source("server/middleware/auth.ts");
  const adminBlock = auth.slice(auth.indexOf("admin: ["), auth.indexOf("branch_owner: ["));
  assert.doesNotMatch(adminBlock, /"student-settings:manage"/);
});
