import assert from "node:assert/strict";
import { it } from "vitest";
import { buildInstructorOptions } from "./instructorRoster";

it("includes every active branch account regardless of role", () => {
  const options = buildInstructorOptions([
    { uid: "a", displayName: "Admin A", role: "admin", isActive: true },
    { uid: "m", displayName: "Manager M", role: "manager", isActive: true },
    { uid: "o", displayName: "Owner O", role: "branch_owner", isActive: true },
    { uid: "u", displayName: "User U", role: "user", isActive: true },
  ]);
  assert.deepEqual(options.map((option) => option.value), ["a", "m", "o", "u"]);
  assert.deepEqual(options.map((option) => option.label), [
    "Admin A (Quản trị viên)", "Manager M (Quản lý)", "Owner O (Chủ chi nhánh)", "User U (Nhân viên)",
  ]);
});

it("excludes inactive accounts", () => {
  const options = buildInstructorOptions([
    { uid: "active", displayName: "Active", role: "user", isActive: true },
    { uid: "inactive", displayName: "Inactive", role: "admin", isActive: false },
  ]);
  assert.deepEqual(options.map((option) => option.value), ["active"]);
});