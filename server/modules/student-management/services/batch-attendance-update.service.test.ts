import assert from "node:assert/strict";
import { beforeEach, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findBatch: vi.fn(),
  findStudent: vi.fn(),
  findEnrollments: vi.fn(),
  assertAttendanceLimits: vi.fn(),
}));

vi.mock("../models/batch.model", () => ({ Batch: { findOne: mocks.findBatch } }));
vi.mock("../models/student.model", () => ({ Student: { findOne: mocks.findStudent } }));
vi.mock("../models/batch-enrollment.model", () => ({ BatchEnrollment: { find: mocks.findEnrollments } }));
vi.mock("./student-batch-enrollment.service", () => ({
  getPlannedSessionCount: () => 20,
  StudentBatchEnrollmentService: { assertAndSyncAttendanceLimits: mocks.assertAttendanceLimits },
}));

import { BatchService } from "./batch.service";

const batchId = "507f1f77bcf86cd799439201";
const studentId = "507f1f77bcf86cd799439202";
const otherStudentId = "507f1f77bcf86cd799439203";

function createBatchDocument(learnerIds: string[]) {
  return {
    _id: batchId,
    ownerId: "COMPANY",
    branchId: "BRANCH",
    code: "ENG-01",
    name: "Lớp tiếng Anh A",
    learnerIds,
    attendanceSessions: [
      { date: "2026-11-01", note: "Đã lưu ghi chú", records: [
        { studentId, status: "present" },
        { studentId: otherStudentId, status: "absent" },
      ] },
      { date: "2026-10-31", note: "Buổi khác", records: [{ studentId, status: "late" }] },
    ],
    set(key: string, value: unknown) { (this as any)[key] = value; },
    markModified: vi.fn(),
    save: vi.fn(async function (this: any) { return this; }),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findEnrollments.mockResolvedValue([]);
  mocks.assertAttendanceLimits.mockResolvedValue(undefined);
  mocks.findStudent.mockReturnValue({
    select: () => ({ lean: async () => ({ fullName: "Nguyễn Văn An" }) }),
  });
});

it("updates only the selected learner and preserves branch-scoped batch data", async () => {
  const batch = createBatchDocument([studentId, otherStudentId]);
  mocks.findBatch.mockResolvedValue(batch);

  const result = await BatchService.updateAttendanceRecord("COMPANY", batchId, "2026-11-01", studentId, "excused", "BRANCH");

  assert.deepEqual(mocks.findBatch.mock.calls[0][0], { _id: batchId, ownerId: "COMPANY", branchId: "BRANCH" });
  assert.deepEqual(mocks.findStudent.mock.calls[0][0], { _id: studentId, ownerId: "COMPANY", branchId: "BRANCH" });
  assert.equal(batch.attendanceSessions[0].note, "Đã lưu ghi chú");
  assert.deepEqual(batch.attendanceSessions[0].records, [
    { studentId, status: "excused" },
    { studentId: otherStudentId, status: "absent" },
  ]);
  assert.deepEqual(batch.attendanceSessions[1].records, [{ studentId, status: "late" }]);
  assert.equal(batch.markModified.mock.calls[0][0], "attendanceSessions");
  assert.equal(batch.save.mock.calls.length, 1);
  assert.equal(mocks.assertAttendanceLimits.mock.calls.length, 1);
  assert.deepEqual(result, {
    batchCode: "ENG-01", batchName: "Lớp tiếng Anh A", date: "2026-11-01", studentName: "Nguyễn Văn An", status: "excused",
  });
});

it("rejects an attendee who is not currently in the selected class", async () => {
  mocks.findBatch.mockResolvedValue(createBatchDocument([otherStudentId]));

  await assert.rejects(
    BatchService.updateAttendanceRecord("COMPANY", batchId, "2026-11-01", studentId, "present", "BRANCH"),
    /không còn thuộc lớp/i,
  );
  assert.equal(mocks.findStudent.mock.calls.length, 0);
  assert.equal(mocks.findEnrollments.mock.calls.length, 0);
});
