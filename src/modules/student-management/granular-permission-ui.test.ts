import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getAllowedStudentTabSlugs } from "./studentTabPermissions";

test("umbrella read keeps all operational tabs visible", () => {
  const tabs = getAllowedStudentTabSlugs(["people:read"], "student");
  assert.deepEqual(tabs, ["tong-quan", "khoa-hoc", "lop-hoc", "chat-luong-hoc-vien", "lo-trinh-va-cho-lop", "bao-luu-hoc-lai", "hoc-vien", "hoc-phi", "lich-thi", "phong-hoc", "tai-nguyen", "thong-bao"]);
});

test("umbrella manage keeps all operational tabs visible", () => {
  const tabs = getAllowedStudentTabSlugs(["people:manage"], "student");
  assert.deepEqual(tabs, ["tong-quan", "khoa-hoc", "lop-hoc", "chat-luong-hoc-vien", "lo-trinh-va-cho-lop", "bao-luu-hoc-lai", "hoc-vien", "hoc-phi", "lich-thi", "phong-hoc", "tai-nguyen", "thong-bao"]);
});

test("worker preset hides student-only tabs", () => {
  assert.deepEqual(getAllowedStudentTabSlugs(["people:read"], "worker"), ["tong-quan", "khoa-hoc", "bao-luu-hoc-lai", "hoc-vien", "thong-bao"]);
});

// Mã quyền chi tiết theo khu vực đã bị gộp vào student:read/student:manage — giữ lại
// một mã cũ cũng không còn mở được tab nào.
test("retired granular permissions no longer grant access", () => {
  assert.deepEqual(getAllowedStudentTabSlugs(["course:read"], "student"), []);
  assert.deepEqual(getAllowedStudentTabSlugs(["payment:read", "exam:manage"], "student"), []);
  assert.deepEqual(
    getAllowedStudentTabSlugs(["people:read", "people:manage"], "student", "teacher"),
    ["khoa-hoc", "lop-hoc", "chat-luong-hoc-vien", "hoc-vien", "lich-thi", "tai-nguyen", "thong-bao"],
  );
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
