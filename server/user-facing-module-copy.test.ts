import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const forbiddenCopy: Record<string, string[]> = {
  "src/pages/Toast.tsx": ["Module chưa được kích hoạt"],
  "src/pages/UserAdminTab.tsx": ["Vui lòng chọn ít nhất 1 module!"],
  "src/components/user-admin/CompanyModal.tsx": ["Module sử dụng *"],
  "src/pages/super-admin/tenants/TenantDetailPage.tsx": ["Lưu module", "Module đang bật", ">Module<"],
  "src/modules/student-management/components/Student/StudentDetailModal.tsx": ["cập nhật module"],
  "server/middleware/require-module.ts": ["Module chưa được kích hoạt"],
  "server/socket.ts": ["Module chưa được kích hoạt"],
  "server/router/permission.router.ts": ["Module quyền"],
};

test("user-facing copy uses Phân hệ instead of Module", () => {
  for (const [file, phrases] of Object.entries(forbiddenCopy)) {
    const source = readFileSync(file, "utf8");
    for (const phrase of phrases) assert.equal(source.includes(phrase), false, `${file}: ${phrase}`);
  }
});
