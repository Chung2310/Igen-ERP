import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Student } from "../models/student.model";
import { Payment } from "../models/payment.model";
import { Batch } from "../models/batch.model";
import { Exam } from "../models/exam.model";
import { BatchMiniTest } from "../models/batch-mini-test.model";
import { BatchEnrollment } from "../models/batch-enrollment.model";
import { StudentBatchEnrollment } from "../models/student-batch-enrollment.model";
import { SubmissionModel } from "../models/submission.model";
import { StudentQualityRecord } from "../models/student-quality.model";
import { ClassWaitlistEntry } from "../models/class-waitlist.model";
import { StudentProgressionDecision } from "../models/student-progression.model";
import { StudentDeviceModel } from "../models/student-device.model";
import { StudentVerificationCodeModel } from "../models/student-verification-code.model";
import { StudentAttendanceAttemptModel } from "../models/student-attendance-attempt.model";
import { StudentFaceEnrollmentAuditModel } from "../models/student-face-enrollment-audit.model";
import { StudentService } from "./student.service";

const blockedId = "507f1f77bcf86cd799439011";
const deletableId = "507f1f77bcf86cd799439012";

afterEach(() => vi.restoreAllMocks());

function mockFind(model: any, records: any[]) {
  vi.spyOn(model, "find").mockReturnValue({ select: async () => records });
}

it("reports referenced records but does not block deletion because operational data is cleaned up", async () => {
  mockFind(Student, [
    { _id: { toString: () => blockedId }, fullName: "Đang học", paymentHistory: [], exams: [] },
    { _id: { toString: () => deletableId }, fullName: "Chưa sử dụng", paymentHistory: [], exams: [] },
  ]);
  mockFind(Payment, [{ studentId: blockedId }]);
  mockFind(Batch, [{ _id: "batch-a", code: "LH-001", name: "Lớp 1", learnerIds: [blockedId], attendanceSessions: [] }]);
  for (const model of [Exam, BatchMiniTest, BatchEnrollment, StudentBatchEnrollment, SubmissionModel, StudentQualityRecord, ClassWaitlistEntry, StudentProgressionDecision, StudentDeviceModel, StudentVerificationCodeModel, StudentAttendanceAttemptModel, StudentFaceEnrollmentAuditModel]) {
    mockFind(model, []);
  }
  const impact = await StudentService.getDeletionImpact("owner-a", [blockedId, deletableId]);
  assert.deepEqual(impact.blockedIds, []);
  assert.deepEqual(impact.deletableIds, [blockedId, deletableId]);
  assert.deepEqual(impact.items[0].reasons.map(reason => reason.label), ["phiếu thu/hóa đơn", "lớp học"]);
});
