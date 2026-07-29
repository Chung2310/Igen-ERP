import assert from "node:assert/strict";
import { it } from "vitest";
import { buildStudentListEndpoint, canUseUnassignedStudentScope } from "./studentListScope";

it("uses the branch-scoped endpoint in normal mode", () => {
  assert.equal(buildStudentListEndpoint("branch", "owner-1"), "/students?ownerFilter=owner-1");
});

it("uses the dedicated endpoint for unassigned records", () => {
  assert.equal(buildStudentListEndpoint("unassigned"), "/students/unassigned");
});

it("allows only admins to select the unassigned-record scope", () => {
  assert.equal(canUseUnassignedStudentScope("admin"), true);
  assert.equal(canUseUnassignedStudentScope("manager"), false);
  assert.equal(canUseUnassignedStudentScope("branch_owner"), false);
  assert.equal(canUseUnassignedStudentScope("user"), false);
});