import assert from "node:assert/strict";
import test from "node:test";
import { crudRouter } from "./crud.router";
import { studentManagementRouter } from "../modules/student-management/router";

function moduleKeysForRoute(router: any, path: string, method: string): string[] {
  const layer = router.stack.find((item: any) => item.route?.path === path && item.route.methods[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} must be registered`);
  return layer.route.stack.map((item: any) => item.handle.moduleKey).filter(Boolean);
}

test("all bespoke workflow participant routes require the HR module", () => {
  const routes = [
    ["/workflows/:id/participants", "post"],
    ["/workflows/:id/participants/:participantId/advance", "post"],
    ["/workflows/:id/participants/:participantId/tasks", "get"],
    ["/workflows/:id/participants/:participantId", "delete"],
  ] as const;

  for (const [path, method] of routes) {
    assert.deepEqual(moduleKeysForRoute(crudRouter, path, method), ["hr"]);
  }
});

test("student send-email route requires the Student module", () => {
  assert.deepEqual(moduleKeysForRoute(studentManagementRouter, "/send-email", "post"), ["student"]);
});
