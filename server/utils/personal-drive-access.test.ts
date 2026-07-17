import assert from "node:assert/strict";
import test from "node:test";
import { canAccessPersonalDriveTarget } from "./personal-drive-access";

test("allows a user to access their own Drive without a company code", () => {
  assert.equal(
    canAccessPersonalDriveTarget({
      callerId: "user-1",
      callerRole: "user",
      callerCompanyCode: "SYSTEM",
      targetUserId: "user-1",
      targetCompanyCode: undefined,
    }),
    true,
  );
});

test("allows an admin to access a target in the same company", () => {
  assert.equal(
    canAccessPersonalDriveTarget({
      callerId: "admin-1",
      callerRole: "admin",
      callerCompanyCode: "ACME",
      targetUserId: "user-1",
      targetCompanyCode: "ACME",
    }),
    true,
  );
});

test("denies an admin access to a target in another company", () => {
  assert.equal(
    canAccessPersonalDriveTarget({
      callerId: "admin-1",
      callerRole: "admin",
      callerCompanyCode: "ACME",
      targetUserId: "user-1",
      targetCompanyCode: "OTHER",
    }),
    false,
  );
});

test("allows a superadmin to access a target in another company", () => {
  assert.equal(
    canAccessPersonalDriveTarget({
      callerId: "root-1",
      callerRole: "superadmin",
      callerCompanyCode: "SYSTEM",
      targetUserId: "user-1",
      targetCompanyCode: "OTHER",
    }),
    true,
  );
});
