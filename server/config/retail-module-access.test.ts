import assert from "node:assert/strict";
import test from "node:test";
import { resolveModuleAccess } from "../middleware/require-module";
import { hasRetailCapability } from "../modules/retail/permissions";

test("retail is independent of business type but requires explicit enablement", () => {
  const user = { role: "admin", companyCode: "ACME" };

  assert.equal(resolveModuleAccess(user, "retail", undefined, true, "education"), false);
  assert.equal(resolveModuleAccess(user, "retail", [], true, "labor"), false);
  assert.equal(resolveModuleAccess(user, "retail", ["retail"], true, "education"), true);
  assert.equal(resolveModuleAccess(user, "retail", ["retail"], true, "labor"), true);
});

test("legacy module fallback still enables existing modules", () => {
  const user = { role: "admin", companyCode: "ACME" };

  assert.equal(resolveModuleAccess(user, "inventory", undefined, true, "education"), true);
  assert.equal(resolveModuleAccess(user, "hr", [], true, "labor"), true);
});

test("retail manager capability implies operate capability", () => {
  assert.equal(hasRetailCapability({ permissions: ["retail:manager"] }, "operate"), true);
  assert.equal(hasRetailCapability({ permissions: ["retail:operate"] }, "manager"), false);
  assert.equal(hasRetailCapability({ permissions: ["retail:operate"] }, "operate"), true);
});

test("admin and superadmin have retail manager capability", () => {
  assert.equal(hasRetailCapability({ role: "admin" }, "manager"), true);
  assert.equal(hasRetailCapability({ role: "superadmin" }, "manager"), true);
});
