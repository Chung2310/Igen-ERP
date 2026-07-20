import assert from "node:assert/strict";
import test from "node:test";
import { resolveModuleAccess } from "./require-module";

test("superadmin always bypasses tenant module restrictions", () => {
  assert.equal(resolveModuleAccess({ role: "superadmin", companyCode: "SYSTEM" }, "hr", []), true);
});

test("a tenant user can access an enabled module", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "ACME" }, "hr", ["hr", "chat"]), true);
});

test("a tenant user cannot access a disabled module", () => {
  assert.equal(resolveModuleAccess({ role: "admin", companyCode: "ACME" }, "inventory", ["hr"]), false);
});

test("missing or empty module data remains backward compatible", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "OLD" }, "student", [], true), true);
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "OLD" }, "student", undefined, true), true);
});

test("tenant module access fails closed without a company code", () => {
  assert.equal(resolveModuleAccess({ role: "user" }, "student", ["student"], true), false);
});

test("tenant module access fails closed when the company record does not exist", () => {
  assert.equal(resolveModuleAccess({ role: "user", companyCode: "MISSING" }, "student", undefined, false), false);
});
