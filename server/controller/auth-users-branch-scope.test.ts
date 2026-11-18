import assert from "node:assert/strict";
import { it } from "vitest";
import { buildUserRosterFilter, resolveUserCountScope } from "./auth.controller";

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

it("counts the entire company, including branch employees, when company scope is requested", () => {
  assert.deepEqual(resolveUserCountScope("branch-a", "branch-b", "company"), { branchId: "", scope: "company" });
  assert.deepEqual(buildUserRosterFilter("ACME"), { companyCode: "ACME" });
});

it("keeps count requests in the authenticated branch unless company scope is explicit", () => {
  assert.deepEqual(resolveUserCountScope("branch-a", "branch-b", "branch"), { branchId: "branch-a", scope: "branch" });
});
