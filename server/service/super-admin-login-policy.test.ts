import assert from "node:assert/strict";
import test from "node:test";
import { requiresSuperAdminChallenge } from "./super-admin-login-policy";

test("requires a TOTP challenge only for the system superadmin role", () => {
  assert.equal(requiresSuperAdminChallenge("superadmin"), true);
  assert.equal(requiresSuperAdminChallenge("admin"), false);
  assert.equal(requiresSuperAdminChallenge("user"), false);
});
