import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";

test("dashboard enables only the tenant modules selected by the company", () => {
  assert.deepEqual(resolveDashboardModuleAccess({ role: "admin", enabledModules: ["hr", "chat"] }), {
    hr: true,
    student: false,
    chat: true,
    resource: false,
  });
});

test("legacy tenants and superadmins retain access to every dashboard module", () => {
  assert.deepEqual(resolveDashboardModuleAccess({ role: "user", enabledModules: undefined }), {
    hr: true,
    student: true,
    chat: true,
    resource: true,
  });
  assert.deepEqual(resolveDashboardModuleAccess({ role: "superadmin", enabledModules: [] }), {
    hr: true,
    student: true,
    chat: true,
    resource: true,
  });
});
