import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_KEYS, DEFAULT_MODULE_KEYS } from "../../config/module-keys";
import { PERMISSION_CODES } from "../../config/permission-catalog";
import { financeScopeFromRequest, requireFinanceBranch } from "./contracts";

test("finance module and receivable permissions are registered", () => {
  assert.ok(MODULE_KEYS.includes("finance" as any));
  assert.equal(DEFAULT_MODULE_KEYS.includes("finance" as any), false);
  for (const permission of ["finance:read", "finance:manage", "finance:manage"]) assert.ok(PERMISSION_CODES.includes(permission), `${permission} missing`);
});

test("normal finance users derive scope from actor and cannot override it", () => {
  assert.deepEqual(financeScopeFromRequest({ role: "user", companyCode: " acme ", branchId: " B1 " }, { companyCode: "ACME", branchId: "B1" }), { companyCode: "ACME", branchId: "B1" });
  assert.throws(() => financeScopeFromRequest({ role: "user", companyCode: "ACME", branchId: "B1" }, { companyCode: "OTHER" }), (error: any) => error.status === 403);
  assert.throws(() => financeScopeFromRequest({ role: "user", companyCode: "ACME", branchId: "B1" }, { branchId: "B2" }), (error: any) => error.status === 403);
});

test("superadmin finance scope must be explicit and branch operations require branch", () => {
  assert.throws(() => financeScopeFromRequest({ role: "superadmin" }, {}), (error: any) => error.status === 400);
  assert.deepEqual(financeScopeFromRequest({ role: "superadmin" }, { companyCode: " acme ", branchId: "B1" }), { companyCode: "ACME", branchId: "B1" });
  assert.throws(() => requireFinanceBranch({ companyCode: "ACME" }), /chi nhánh/i);
});
