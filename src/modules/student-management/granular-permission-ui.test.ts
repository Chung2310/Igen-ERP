import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getAllowedStudentTabSlugs } from "./studentTabPermissions";

test("umbrella read keeps all operational tabs visible", () => {
  const tabs = getAllowedStudentTabSlugs(["student:read"], "student");
  assert.deepEqual(tabs, ["tong-quan", "khoa-hoc", "lop-hoc", "hoc-vien", "hoc-phi", "lich-thi", "tai-nguyen", "thong-bao"]);
});

test("granular permissions expose only matching tabs", () => {
  assert.deepEqual(getAllowedStudentTabSlugs(["course:read"], "student"), ["khoa-hoc"]);
  assert.deepEqual(getAllowedStudentTabSlugs(["batch:manage"], "worker"), ["khoa-hoc"]);
  assert.deepEqual(getAllowedStudentTabSlugs(["payment:read", "exam:manage"], "student"), ["hoc-phi", "lich-thi"]);
});

test("SMTP settings do not hard-code admin role", () => {
  const source = fs.readFileSync("src/components/settings/ErpConfigTab.tsx", "utf8");
  assert.match(source, /company-smtp:manage/);
  assert.doesNotMatch(source, /activeTab === "companyModules" && userProfile\?\.role === "admin"/);
});

// Loại hình doanh nghiệp là đặc quyền SuperAdmin: phía doanh nghiệp chỉ hiển thị
// chỉ-đọc, nên section này gác theo role chứ không theo quyền student-settings:manage.
test("entity preset section is read-only for companies", () => {
  const tab = fs.readFileSync("src/components/settings/ErpConfigTab.tsx", "utf8");
  assert.match(tab, /canViewStudentSettings/);
  assert.doesNotMatch(tab, /student-settings:manage/);

  const section = fs.readFileSync("src/components/settings/StudentManagementErpSettings.tsx", "utf8");
  assert.doesNotMatch(section, /updateModuleSettings/);
  assert.match(section, /Chỉ SuperAdmin/);
});
