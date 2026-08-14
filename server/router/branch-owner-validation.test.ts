import assert from "node:assert/strict";
import test from "node:test";
import { createBranchOwnerSchema } from "./auth.router";

test("branch owner validation preserves an ISO birth date string", () => {
  const input = { displayName: "Owner", email: "owner@acme.test", password: "secret1", birthDate: "1990-05-17" };
  const result = createBranchOwnerSchema.body.validate(input);
  assert.equal(result.error, undefined);
  assert.equal(result.value.birthDate, "1990-05-17");
});
