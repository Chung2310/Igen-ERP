import assert from "node:assert/strict";
import { expect, test } from "vitest";
import { getRoleTitle, sortPermissionsForRoleEditor } from "./rolePresentation";

test("system roles have clear Vietnamese titles without changing slugs", () => {
  assert.equal(getRoleTitle("superadmin"), "Quản trị viên cấp cao");
  assert.equal(getRoleTitle("admin"), "Quản trị viên doanh nghiệp");
  assert.equal(getRoleTitle("branch_owner"), "Chủ chi nhánh");
  assert.equal(getRoleTitle("manager"), "Quản lý");
  assert.equal(getRoleTitle("user"), "Nhân viên");
  assert.equal(getRoleTitle("staff"), "Nhân viên");
  assert.equal(getRoleTitle("teacher"), "Giảng viên");
  assert.equal(getRoleTitle("accountant"), "Kế toán");
  assert.equal(getRoleTitle("manager", "Trưởng trung tâm"), "Trưởng trung tâm");
});

test("role editor orders read before manage within each business area", () => {
  const sorted = sortPermissionsForRoleEditor([
    { code: "people:manage", group: "Đào tạo" },
    { code: "people:read", group: "Tài chính học viên" },
    { code: "people:read", group: "Đào tạo" },
  ]);
  expect(sorted.map((item) => item.code)).toEqual(["people:read", "people:manage", "people:read"]);
});
