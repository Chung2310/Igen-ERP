import assert from "node:assert/strict";
import test from "node:test";
import { crudRouter } from "./crud.router";
import { studentManagementRouter } from "../modules/student-management/router";
import { workerManagementRouter } from "../modules/worker-management/router";
import { resolveModuleAccess } from "../middleware/require-module";

function moduleKeysForRoute(router: any, path: string, method: string): string[] {
  const layer = router.stack.find((item: any) => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} must be registered`);
  return layer.route.stack.map((item: any) => item.handle.moduleKey).filter(Boolean);
}

test("student send-email route requires the Student module", () => {
  assert.deepEqual(moduleKeysForRoute(studentManagementRouter, "/send-email", "post"), ["student"]);
});

test("labor tenants can access Worker but not Student", () => {
  const user = { role: "admin", companyCode: "ACME" };
  assert.equal(resolveModuleAccess(user, "student", ["student", "worker"], true, "labor"), false);
  assert.equal(resolveModuleAccess(user, "worker", ["student", "worker"], true, "labor"), true);
});

test("worker workflow exposes the legacy send-email route behind Worker module", () => {
  assert.deepEqual(moduleKeysForRoute(workerManagementRouter, "/send-email", "post"), ["worker"]);
});
