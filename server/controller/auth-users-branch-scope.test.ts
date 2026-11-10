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

it("combines a roster search with branch isolation without overwriting either condition", () => {
  assert.deepEqual(buildUserRosterFilter("ACME", "main-id", true, "Chung + test"), {
    companyCode: "ACME",
    $or: [
      { branchId: "main-id" },
      { branchId: { $exists: false } },
      { branchId: null },
      { branchId: "" },
    ],
    $and: [{ $or: [
      { displayName: { $regex: "Chung \\+ test", $options: "i" } },
      { email: { $regex: "Chung \\+ test", $options: "i" } },
      { phone: { $regex: "Chung \\+ test", $options: "i" } },
    ] }],
  });
});
