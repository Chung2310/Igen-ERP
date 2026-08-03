import assert from "node:assert/strict";
import test from "node:test";
import { requiresSuperAdminChallenge } from "./super-admin-login-policy";

test("does not require a TOTP challenge during login", () => {
  assert.equal(requiresSuperAdminChallenge("superadmin"), false);
  assert.equal(requiresSuperAdminChallenge("admin"), false);
  assert.equal(requiresSuperAdminChallenge("user"), false);
});
