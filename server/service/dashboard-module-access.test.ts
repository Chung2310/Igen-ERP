import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardModuleAccess } from "./dashboard-module-access";

test("dashboard enables only the tenant modules selected by the company", () => {
  assert.deepEqual(resolveDashboardModuleAccess({ role: "admin", enabledModules: ["hr", "chat"] }), {
    hr: true,
    student: false,
    chat: true,
    resource: false,
    inventory: false,
    timekeeping: true,
  });
});

test("legacy tenants and superadmins retain access to every dashboard module", () => {
  assert.deepEqual(resolveDashboardModuleAccess({ role: "user", enabledModules: undefined }), {
    hr: true,
    student: true,
    chat: true,
    resource: true,
    inventory: true,
    timekeeping: true,
  });
  assert.deepEqual(resolveDashboardModuleAccess({ role: "superadmin", enabledModules: [] }), {
    hr: true,
    student: true,
    chat: true,
    resource: true,
    inventory: true,
    timekeeping: true,
  });
});

test("timekeeping dashboard data needs its own read permission", () => {
  assert.equal(resolveDashboardModuleAccess({
    role: "admin",
    enabledModules: ["hr"],
    permissions: new Set(["hr:read"]),
  }).timekeeping, false);
  assert.equal(resolveDashboardModuleAccess({
    role: "admin",
    enabledModules: ["hr"],
    permissions: new Set(["hr:read", "timekeeping:read"]),
  }).timekeeping, true);
});
