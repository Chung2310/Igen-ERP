import assert from "node:assert/strict";
import test from "node:test";
import { crudRouter } from "./crud.router";
import { studentManagementRouter } from "../modules/student-management/router";

function moduleKeysForRoute(router: any, path: string, method: string): string[] {
  const layer = router.stack.find((item: any) => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} must be registered`);
  return layer.route.stack.map((item: any) => item.handle.moduleKey).filter(Boolean);
}

test("student send-email route requires the Student module", () => {
  assert.deepEqual(moduleKeysForRoute(studentManagementRouter, "/send-email", "post"), ["student"]);
});
