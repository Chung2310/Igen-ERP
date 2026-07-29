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

test("ERP student and SMTP settings do not hard-code admin role", () => {
  const source = fs.readFileSync("src/components/settings/ErpConfigTab.tsx", "utf8");
  assert.match(source, /student-settings:manage/);
  assert.match(source, /company-smtp:manage/);
  assert.doesNotMatch(source, /activeTab === "companyModules" && userProfile\?\.role === "admin"/);
});
