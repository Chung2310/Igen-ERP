import assert from "node:assert/strict";
import test from "node:test";
import { resolveBusinessModuleKey } from "../modules/student-management/router";
import { workerRoutes } from "../modules/worker-management/routes/worker.routes";
import { resolveModuleAccess } from "../middleware/require-module";
import fs from "node:fs";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS } from "../config/module-keys";

test("customer is a default tenant module", () => {
  assert.ok(MODULE_KEYS.includes("customer" as any));
  assert.ok(DEFAULT_MODULE_KEYS.includes("customer" as any));
});

test("shared workflow resolves an independent guard from its mount path", () => {
  assert.equal(resolveBusinessModuleKey("/api/v1/student-management/send-email"), "student");
  assert.equal(resolveBusinessModuleKey("/api/v1/worker-management/send-email"), "worker");
  assert.equal(resolveBusinessModuleKey("/api/v1/worker-management/attendance/worker"), "worker");
});

test("labor tenants can access Worker but not Student", () => {
  const user = { role: "admin", companyCode: "ACME" };
  assert.equal(resolveModuleAccess(user, "student", ["student", "worker"], true, "labor"), false);
  assert.equal(resolveModuleAccess(user, "worker", ["student", "worker"], true, "labor"), true);
});

test("worker CRUD routes are registered", () => {
  for (const [path, method] of [["/", "get"], ["/", "post"], ["/:id", "patch"], ["/:id", "delete"]] as const) {
    assert.ok(workerRoutes.stack.some((item: any) => item.route?.path === path && item.route.methods[method]), `${method.toUpperCase()} ${path} must be registered`);
  }
});

test("retail router is mounted once behind authentication and the retail module guard", () => {
  const source = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(source, /apiRouter\.use\("\/", requireAuth as any, requireModule\("retail"\), retailRouter\)/);
});


