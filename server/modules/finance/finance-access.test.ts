import assert from "node:assert/strict";
import { test } from "vitest";
import { MODULE_KEYS, DEFAULT_MODULE_KEYS } from "../../config/module-keys";
import { expandEffectivePermissions, PERMISSION_CODES } from "../../config/permission-catalog";
import { DEFAULT_ROLE_PERMISSIONS } from "../../middleware/auth";
import { financeScopeFromRequest, requireFinanceBranch } from "./contracts";
import { ASSET_MANAGE_PERMISSION, ASSET_READ_PERMISSION } from "./permissions";

test("finance module and receivable permissions are registered", () => {
  assert.ok(MODULE_KEYS.includes("finance" as any));
  assert.equal(DEFAULT_MODULE_KEYS.includes("finance" as any), false);
  for (const permission of ["finance-receivable:read", "finance-receivable:manage", "finance-receivable:manage"]) assert.ok(PERMISSION_CODES.includes(permission), `${permission} missing`);
});

test("finance module registers fixed-asset read and manage permissions", () => {
  assert.equal(ASSET_READ_PERMISSION, "asset:read");
  assert.equal(ASSET_MANAGE_PERMISSION, "asset:manage");
  for (const permission of [ASSET_READ_PERMISSION, ASSET_MANAGE_PERMISSION]) {
    assert.ok(PERMISSION_CODES.includes(permission), `${permission} missing`);
  }
  assert.ok(DEFAULT_ROLE_PERMISSIONS.admin.includes(ASSET_MANAGE_PERMISSION));
  assert.ok(expandEffectivePermissions([ASSET_MANAGE_PERMISSION]).has(ASSET_READ_PERMISSION));
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
