import { StudentBatchEnrollment } from "../models/student-batch-enrollment.model";
import { BatchEnrollment } from "../models/batch-enrollment.model";

type AttendanceBatch = {
  ownerId: string;
  branchId?: string;
  _id: unknown;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  attendanceSessions: Array<{
    records: Array<{ studentId: string; status: "present" | "absent" | "excused" | "late" }>;
  }>;
};

export function getPlannedSessionCount(batch: Pick<AttendanceBatch, "startDate" | "endDate" | "daysOfWeek">): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(batch.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(batch.endDate)) return 0;
  const days = new Set(batch.daysOfWeek || []);
  if (days.size === 0) return 0;
  const cursor = new Date(`${batch.startDate}T00:00:00Z`);
  const end = new Date(`${batch.endDate}T00:00:00Z`);
  let count = 0;
  for (let index = 0; cursor <= end && index < 400; index += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (days.has(cursor.getUTCDay())) count += 1;
  }
  return count;
}

export class AttendanceSessionLimitError extends Error {
  constructor(studentId: string, allowedSessions: number) {
    super(`Học viên đã đủ số buổi được phép (${allowedSessions} buổi), không thể điểm danh thêm.`);
    this.name = "AttendanceSessionLimitError";
  }
}

export class StudentBatchEnrollmentService {
  static async activate(input: {
    ownerId: string;
    branchId?: string;
    batchId: string;
    studentId: string;
    actorId?: string;
    allowedSessions?: number;
  }) {
    const actorId = input.actorId || "system";
    // BatchEnrollment is the canonical enrollment record. Keep the older
    // StudentBatchEnrollment record in sync while legacy consumers are moved.
    await BatchEnrollment.findOneAndUpdate(
      {
        ownerId: input.ownerId,
        branchId: input.branchId,
        batchId: input.batchId,
        studentId: input.studentId,
      },
      {
        $set: { status: "Đang học", leftAt: null },
        $setOnInsert: {
          joinedAt: new Date(),
          allowedSessions: input.allowedSessions || 0,
          attendedSessions: 0,
          history: [{ at: new Date(), action: "enrolled", actorId }],
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
    return StudentBatchEnrollment.findOneAndUpdate(
      {
        ownerId: input.ownerId,
        branchId: input.branchId,
        batchId: input.batchId,
        studentId: input.studentId,
      },
      {
        $set: { status: "active", updatedBy: actorId },
        $unset: { leftAt: 1 },
        $setOnInsert: {
          enrolledAt: new Date(),
          createdBy: actorId,
          allowedSessions: input.allowedSessions || 0,
          attendedSessions: 0,
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
  }

  static async remove(input: {
    ownerId: string;
    branchId?: string;
    batchId: string;
    studentId: string;
    actorId?: string;
  }) {
    await BatchEnrollment.findOneAndUpdate(
      { ownerId: input.ownerId, branchId: input.branchId, batchId: input.batchId, studentId: input.studentId },
      {
        $set: { status: "Không còn nhu cầu học", leftAt: new Date() },
        $push: { history: { at: new Date(), action: "removed", actorId: input.actorId || "system" } },
      },
      { returnDocument: 'after' },
    );
    return StudentBatchEnrollment.findOneAndUpdate(
      {
        ownerId: input.ownerId,
        branchId: input.branchId,
        batchId: input.batchId,
        studentId: input.studentId,
      },
      { $set: { status: "removed", leftAt: new Date(), updatedBy: input.actorId || "system" } },
      { returnDocument: 'after' },
    );
  }

  static async assertAndSyncAttendanceLimits(batch: AttendanceBatch) {
    const attendanceByStudent = new Map<string, number>();
    for (const session of batch.attendanceSessions || []) {
      for (const record of session.records || []) {
        if (record.status !== "present" && record.status !== "late") continue;
        attendanceByStudent.set(record.studentId, (attendanceByStudent.get(record.studentId) || 0) + 1);
      }
    }
    if (attendanceByStudent.size === 0) return;

    const studentIds = [...attendanceByStudent.keys()];
    const enrollments = await StudentBatchEnrollment.find({
      ownerId: batch.ownerId,
      branchId: batch.branchId,
      batchId: String(batch._id),
      studentId: { $in: studentIds },
    });
    const enrollmentByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment]));
    const defaultAllowedSessions = getPlannedSessionCount(batch);

    const updates: Array<{ enrollment: (typeof enrollments)[number]; attendedSessions: number }> = [];
    for (const studentId of studentIds) {
      const attendedSessions = attendanceByStudent.get(studentId) || 0;
      const enrollment = enrollmentByStudent.get(studentId);
      const allowedSessions = enrollment?.allowedSessions || defaultAllowedSessions;
      if (allowedSessions > 0 && attendedSessions > allowedSessions) {
        throw new AttendanceSessionLimitError(studentId, allowedSessions);
      }
      if (enrollment && enrollment.attendedSessions !== attendedSessions) updates.push({ enrollment, attendedSessions });
    }
    for (const { enrollment, attendedSessions } of updates) {
      enrollment.attendedSessions = attendedSessions;
      await enrollment.save();
    }
  }
}
