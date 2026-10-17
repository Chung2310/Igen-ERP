import assert from "node:assert/strict";
import { it } from "vitest";
import { buildUserRosterFilter } from "./auth.controller";

it("scopes the shared user list by company and branch without hiding inactive accounts", () => {
  assert.deepEqual(buildUserRosterFilter("ACME", "branch-a"), {
    companyCode: "ACME",
    branchId: "branch-a",
  });
});

it("includes unassigned legacy users only when the selected branch is MAIN", () => {
  assert.deepEqual(buildUserRosterFilter("ACME", "main-id", true), {
    companyCode: "ACME",
    $or: [
      { branchId: "main-id" },
      { branchId: { $exists: false } },
      { branchId: null },
      { branchId: "" },
    ],
  });
});
