import assert from "node:assert/strict";
import test from "node:test";
import { setRateLimitRedisClientForTesting } from "../../../infrastructure/rate-limit-redis";

setRateLimitRedisClientForTesting({
  eval: async () => [1, 60_000], decr: async () => 0, del: async () => 0,
  on: () => {}, disconnect: () => {}, quit: () => {},
} as any);

const { AssignmentService } = await import("./assignment.service");
const { AssignmentModel } = await import("../models/assignment.model");
const { SubmissionModel } = await import("../models/submission.model");
const { Batch } = await import("../models/batch.model");
const { Student } = await import("../models/student.model");

test("assignment operations apply the caller owner scope to every lookup", async (t) => {
  const ownerScope = ["tenant-a-admin", "tenant-a-teacher"];
  const expectedOwner = { $in: ownerScope };

  await t.test("cannot create an assignment under another tenant batch", async () => {
    let batchFilter: any;
    const original = (Batch as any).findOne;
    (Batch as any).findOne = async (filter: any) => { batchFilter = filter; return null; };
    try {
      await assert.rejects(
        AssignmentService.createAssignment({ batchId: "tenant-b-batch" }, "teacher-a", "tenant-a-admin", ownerScope)
      );
      assert.deepEqual(batchFilter, { _id: "tenant-b-batch", ownerId: expectedOwner });
    } finally { (Batch as any).findOne = original; }
  });

  await t.test("cannot list another tenant assignments", async () => {
    let filter: any;
    const original = (AssignmentModel as any).find;
    (AssignmentModel as any).find = (value: any) => {
      filter = value;
      return { sort: async () => [] };
    };
    try {
      await AssignmentService.getAssignments(ownerScope, "tenant-b-batch");
      assert.deepEqual(filter, { batchId: "tenant-b-batch", ownerId: expectedOwner });
    } finally { (AssignmentModel as any).find = original; }
  });

  await t.test("cannot read another tenant submissions", async () => {
    let assignmentFilter: any;
    let submissionRead = false;
    const originalAssignment = (AssignmentModel as any).findOne;
    const originalSubmission = (SubmissionModel as any).find;
    (AssignmentModel as any).findOne = async (filter: any) => { assignmentFilter = filter; return null; };
    (SubmissionModel as any).find = async () => { submissionRead = true; return []; };
    try {
      await assert.rejects(AssignmentService.getSubmissions(ownerScope, "tenant-b-assignment"));
      assert.deepEqual(assignmentFilter, { _id: "tenant-b-assignment", ownerId: expectedOwner });
      assert.equal(submissionRead, false);
    } finally {
      (AssignmentModel as any).findOne = originalAssignment;
      (SubmissionModel as any).find = originalSubmission;
    }
  });

  await t.test("cannot grade another tenant assignment", async () => {
    let assignmentFilter: any;
    let submissionWrite = false;
    const originalAssignment = (AssignmentModel as any).findOne;
    const originalUpdate = (SubmissionModel as any).findOneAndUpdate;
    (AssignmentModel as any).findOne = async (filter: any) => { assignmentFilter = filter; return null; };
    (SubmissionModel as any).findOneAndUpdate = async () => { submissionWrite = true; return null; };
    try {
      await assert.rejects(
        AssignmentService.gradeSubmission("tenant-b-assignment", "student-b", {}, "teacher-a", ownerScope)
      );
      assert.deepEqual(assignmentFilter, { _id: "tenant-b-assignment", ownerId: expectedOwner });
      assert.equal(submissionWrite, false);
    } finally {
      (AssignmentModel as any).findOne = originalAssignment;
      (SubmissionModel as any).findOneAndUpdate = originalUpdate;
    }
  });

  await t.test("a submission token cannot cross assignment, batch, or student tenant boundaries", async () => {
    let assignmentFilter: any;
    let batchFilter: any;
    let studentFilter: any;
    const originals = [(AssignmentModel as any).findOne, (Batch as any).findOne, (Student as any).findOne];
    (AssignmentModel as any).findOne = async (filter: any) => {
      assignmentFilter = filter;
      return { ownerId: "tenant-b-owner", dueDate: null };
    };
    (Batch as any).findOne = async (filter: any) => { batchFilter = filter; return null; };
    (Student as any).findOne = async (filter: any) => { studentFilter = filter; return null; };
    try {
      await assert.rejects(
        AssignmentService.submitProof({ assignmentId: "assignment-b", batchId: "batch-a", studentId: "student-a" }, {})
      );
      assert.deepEqual(assignmentFilter, { _id: "assignment-b", batchId: "batch-a" });
      assert.deepEqual(batchFilter, { _id: "batch-a", ownerId: "tenant-b-owner", learnerIds: "student-a" });
      assert.deepEqual(studentFilter, { _id: "student-a", ownerId: "tenant-b-owner" });
    } finally {
      (AssignmentModel as any).findOne = originals[0];
      (Batch as any).findOne = originals[1];
      (Student as any).findOne = originals[2];
    }
  });
});
