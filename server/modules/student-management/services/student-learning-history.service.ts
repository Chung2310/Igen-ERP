import { AssignmentModel } from "../models/assignment.model";
import { Batch } from "../models/batch.model";
import { BatchMiniTest } from "../models/batch-mini-test.model";
import { Course } from "../models/course.model";
import { Student } from "../models/student.model";
import { StudentBatchEnrollment } from "../models/student-batch-enrollment.model";
import { StudentQualityRecord } from "../models/student-quality.model";
import { SubmissionModel } from "../models/submission.model";

type OwnerScope = string | string[];

const ownerQuery = (ownerId: OwnerScope) => ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
const branchQuery = (branchId?: string) => branchId ? { branchId } : {};
const held = (date: string) => Boolean(date) && date <= new Date().toISOString().slice(0, 10);
const toRate = (done: number, total: number) => total ? Math.round((done / total) * 1000) / 10 : null;

export class StudentLearningHistoryService {
  static async getHistory(ownerId: OwnerScope, studentId: string, branchId?: string) {
    const scope = { ...ownerQuery(ownerId), ...branchQuery(branchId) };
    const student = await Student.findOne({ _id: studentId, ...scope }).lean();
    if (!student) throw new Error("Không tìm thấy học viên.");
    const completedCourseIds = student.completedCourseIds || [];

    const [enrollments, learnerBatches] = await Promise.all([
      StudentBatchEnrollment.find({ ...scope, studentId }).lean(),
      Batch.find({ ...scope, learnerIds: studentId }).lean(),
    ]);
    const batchIds = new Set([...enrollments.map((item) => item.batchId), ...learnerBatches.map((item) => String(item._id))]);
    if (!batchIds.size) {
      const completedCourses = completedCourseIds.length ? await Course.find({ _id: { $in: completedCourseIds }, ...scope }).select("title code").lean() : [];
      return { studentId, summary: { totalClasses: 0, totalCourses: 0, totalAttendedSessions: 0, totalMiniTests: 0, totalExams: (student.exams || []).length }, entries: [], unassignedExams: student.exams || [], completedCourses: completedCourses.map((course) => ({ id: String(course._id), title: course.title, code: course.code })) };
    }

    const batches = await Batch.find({ ...scope, _id: { $in: [...batchIds] } }).lean();
    const validBatchIds = batches.map((batch) => String(batch._id));
    const courseIds = [...new Set([...batches.map((batch) => batch.courseId), ...completedCourseIds].filter(Boolean))];
    const [courses, assignments, miniTests, qualityRecords] = await Promise.all([
      Course.find({ _id: { $in: courseIds }, ...scope }).lean(),
      AssignmentModel.find({ batchId: { $in: validBatchIds }, ...scope }).lean(),
      BatchMiniTest.find({ batchId: { $in: validBatchIds }, ...scope }).lean(),
      StudentQualityRecord.find({ studentId, batchId: { $in: validBatchIds }, ...scope }).lean(),
    ]);
    const assignmentIds = assignments.map((item) => String(item._id));
    const submissions = assignmentIds.length ? await SubmissionModel.find({ studentId, assignmentId: { $in: assignmentIds } }).lean() : [];
    const enrollmentMap = new Map(enrollments.map((item) => [item.batchId, item]));
    const courseMap = new Map(courses.map((item) => [String(item._id), item]));
    const completedCourses = completedCourseIds.map((courseId) => ({ id: courseId, title: courseMap.get(courseId)?.title || "Khóa học đã xóa", code: courseMap.get(courseId)?.code || "" }));
    const qualityMap = new Map(qualityRecords.map((item) => [item.batchId, item]));
    const assignmentsByBatch = new Map<string, typeof assignments>();
    const testsByBatch = new Map<string, typeof miniTests>();
    const submissionMap = new Map(submissions.map((item) => [item.assignmentId, item]));
    for (const assignment of assignments) { const list = assignmentsByBatch.get(assignment.batchId) || []; list.push(assignment); assignmentsByBatch.set(assignment.batchId, list); }
    for (const test of miniTests) { const list = testsByBatch.get(test.batchId) || []; list.push(test); testsByBatch.set(test.batchId, list); }

    const exams = (student.exams || []) as Array<any>;
    const entries = batches.map((batch) => {
      const batchId = String(batch._id);
      const enrollment = enrollmentMap.get(batchId);
      const sessions = (batch.attendanceSessions || []).filter((session) => held(session.date));
      const attended = sessions.filter((session) => session.records.some((record) => record.studentId === studentId && (record.status === "present" || record.status === "late"))).length;
      const assignmentItems = (assignmentsByBatch.get(batchId) || []).map((assignment) => {
        const submission = submissionMap.get(String(assignment._id));
        return { id: String(assignment._id), title: assignment.title, dueDate: assignment.dueDate || null, status: submission?.status || "not_submitted", score: submission?.score ?? null, feedback: submission?.feedback || "" };
      });
      const testItems = (testsByBatch.get(batchId) || []).map((test) => {
        const result = test.results.find((item) => item.studentId === studentId);
        return { id: String(test._id), title: test.title, date: test.date, maxScore: test.maxScore, score: result?.score ?? null, note: result?.note || "" };
      }).sort((left, right) => right.date.localeCompare(left.date));
      const classExams = exams.filter((exam) => exam.batchId === batchId).sort((left, right) => String(right.date).localeCompare(String(left.date)));
      const completedAssignments = assignmentItems.filter((item) => item.status !== "not_submitted").length;
      const quality = qualityMap.get(batchId);
      return {
        id: batchId, batchCode: batch.code, courseId: batch.courseId, courseTitle: courseMap.get(batch.courseId)?.title || "Khóa học đã xóa", instructorName: batch.instructorText || "",
        status: enrollment?.status || (batch.status === "Đã kết thúc" ? "completed" : "active"), batchStatus: batch.status,
        enrolledAt: enrollment?.enrolledAt || batch.createdAt || null, leftAt: enrollment?.leftAt || null,
        attendance: { attended, total: sessions.length, rate: toRate(attended, sessions.length) },
        assignments: { completed: completedAssignments, total: assignmentItems.length, rate: toRate(completedAssignments, assignmentItems.length), items: assignmentItems },
        miniTests: testItems, exams: classExams, attitudeNote: quality?.attitudeNote || "", teacherAssessment: quality?.teacherAssessment || "",
      };
    }).sort((left, right) => new Date(right.enrolledAt || 0).getTime() - new Date(left.enrolledAt || 0).getTime());
    const assignedExamIds = new Set(entries.flatMap((entry) => entry.exams.map((exam) => exam.id)));
    return {
      studentId,
      summary: { totalClasses: entries.length, totalCourses: new Set(entries.map((entry) => entry.courseId)).size, totalAttendedSessions: entries.reduce((total, entry) => total + entry.attendance.attended, 0), totalMiniTests: entries.reduce((total, entry) => total + entry.miniTests.filter((item) => item.score !== null).length, 0), totalExams: exams.length },
      entries,
      unassignedExams: exams.filter((exam) => !assignedExamIds.has(exam.id)),
      completedCourses,
    };
  }
}
