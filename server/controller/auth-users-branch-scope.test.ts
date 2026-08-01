import assert from "node:assert/strict";
import { it } from "vitest";
import { buildUserRosterFilter } from "./auth.controller";

it("scopes the shared user list by company and branch without hiding inactive accounts", () => {
  assert.deepEqual(buildUserRosterFilter("ACME", "branch-a"), {
    companyCode: "ACME",
    branchId: "branch-a",
  });
});