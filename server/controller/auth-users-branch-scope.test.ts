import assert from "node:assert/strict";
import { it } from "vitest";
import { buildUserRosterFilter } from "./auth.controller";

it("scopes the roster to active users in the selected company and branch", () => {
  assert.deepEqual(buildUserRosterFilter("ACME", "branch-a"), {
    companyCode: "ACME",
    branchId: "branch-a",
    isActive: true,
  });
});