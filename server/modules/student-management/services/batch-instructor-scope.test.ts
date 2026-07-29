import assert from "node:assert/strict";
import { it } from "vitest";
import { buildInstructorAssignmentQuery } from "./batch.service";

it("allows any active account role by scoping assignment to company and branch", () => {
  assert.deepEqual(
    buildInstructorAssignmentQuery({ uid: "admin", role: "admin", companyCode: "ACME", branchId: "branch-a" }, "user-1"),
    { _id: "user-1", companyCode: "ACME", branchId: "branch-a", isActive: true },
  );
});

it("rejects assignment when the actor has no branch scope", () => {
  assert.throws(
    () => buildInstructorAssignmentQuery({ uid: "admin", role: "admin", companyCode: "ACME" }, "user-1"),
    /chi nhánh/i,
  );
});