import mongoose from "mongoose";
import { ValidationError } from "../../../errors/app-error";
import { AssignmentModel } from "../models/assignment.model";
import { Batch } from "../models/batch.model";
import { BatchEnrollment } from "../models/batch-enrollment.model";
import { BatchMiniTest } from "../models/batch-mini-test.model";
import { Exam } from "../models/exam.model";
import { ClassWaitlistEntry } from "../models/class-waitlist.model";
import { Course } from "../models/course.model";
import { LearningRoadmap } from "../models/learning-roadmap.model";
import { StudentProgressionDecision } from "../models/student-progression.model";
import { StudentQualityRecord } from "../models/student-quality.model";
import { Student } from "../models/student.model";
import { SubmissionModel } from "../models/submission.model";
import type { ILearningRoadmap, ILearningRoadmapStep, IProgressionPolicy } from "../interfaces/learning-roadmap.interface";
import type { ProgressionIntent } from "../interfaces/student-progression.interface";
import { resolveBatchTotalSessions, resolveQuota } from "./batch.service";

type OwnerScope = string | string[];
type Actor = { uid: string; branchId?: string };

const ACTIVE_ENROLLMENT_STATUSES = ["Đang học", "Chờ xếp lớp tiếp theo"] as const;

function ownerQuery(ownerId: OwnerScope): Record<string, unknown> {
  return ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function branchQuery(branchId?: string): Record<string, unknown> { return branchId ? { branchId } : {}; }
function idOf(value: unknown): string { return String(value); }

function evaluatePolicy(policy: IProgressionPolicy, input: { attendanceRate: number | null; assignmentRate: number | null; miniTestRate: number | null; examRate: number | null; }) {
  const checks: Array<{ label: string; passed: boolean }> = [];
  if (typeof policy.minAttendanceRate === "number") checks.push({ label: `Chuyên cần dưới ${policy.minAttendanceRate}%`, passed: input.attendanceRate !== null && input.attendanceRate >= policy.minAttendanceRate });
  if (typeof policy.minAssignmentRate === "number") checks.push({ label: `Hoàn thành bài tập dưới ${policy.minAssignmentRate}%`, passed: input.assignmentRate !== null && input.assignmentRate >= policy.minAssignmentRate });
  if (typeof policy.minMiniTestRate === "number") checks.push({ label: `Điểm mini test dưới ${policy.minMiniTestRate}%`, passed: input.miniTestRate !== null && input.miniTestRate >= policy.minMiniTestRate });
  if (typeof policy.minExamRate === "number") checks.push({ label: `Điểm thi dưới ${policy.minExamRate}%`, passed: input.examRate !== null && input.examRate >= policy.minExamRate });
  const eligible = checks.length === 0 || (policy.matchMode === "any" ? checks.some((item) => item.passed) : checks.every((item) => item.passed));
  return { eligible, reasons: checks.filter((item) => !item.passed).map((item) => item.label), checks };
}

export class LearningRoadmapService {
  static async listRoadmaps(ownerId: OwnerScope, branchId?: string) {
    return LearningRoadmap.find({ ...ownerQuery(ownerId), ...branchQuery(branchId) }).sort({ status: 1, name: 1 }).lean();
  }

  static async listRoadmapSteps(ownerId: OwnerScope, roadmapId: string, branchId?: string, courseId?: string) {
    const roadmap = await LearningRoadmap.findOne({
      _id: roadmapId,
      ...ownerQuery(ownerId),
      ...branchQuery(branchId),
      status: "active",
    }).lean();
    if (!roadmap) return null;

    const steps = (roadmap.steps || []).filter((step) => !courseId || String(step.courseId) === courseId);
    const courseIds = [...new Set(steps.map((step) => String(step.courseId)).filter(Boolean))];
    const courses = courseIds.length
      ? await Course.find({ _id: { $in: courseIds }, ...ownerQuery(ownerId), ...branchQuery(branchId) }).select("_id title code").lean()
      : [];
    const courseById = new Map(courses.map((course) => [String(course._id), course]));

    return steps.flatMap((step) => {
      const course = courseById.get(String(step.courseId));
      if (!course) return [];
      const courseTitle = String(course.title || course.code || "Khóa học");
      return [{
        stepId: String(step.id),
        name: `Chặng ${step.order}: ${courseTitle}`,
        code: String(course.code || ""),
        courseId: String(step.courseId),
        courseTitle,
        courseCode: String(course.code || ""),
        order: Number(step.order),
        minClassSize: Number(step.minClassSize || 0),
        maxClassSize: Number(step.maxClassSize || 0),
      }];
    });
  }

  static async createRoadmap(ownerId: string, branchId: string | undefined, data: Pick<ILearningRoadmap, "code" | "name" | "description" | "status" | "steps">, courseOwnerScope: OwnerScope = ownerId) {
    this.assertSteps(data.steps || []);
    await this.assertCoursesExist(data.steps || [], courseOwnerScope, branchId);
    return LearningRoadmap.create({ ...data, ownerId, branchId });
  }

  static async updateRoadmap(ownerId: OwnerScope, roadmapId: string, branchId: string | undefined, data: Partial<Pick<ILearningRoadmap, "code" | "name" | "description" | "status" | "steps">>) {
    if (data.steps) {
      this.assertSteps(data.steps);
      await this.assertCoursesExist(data.steps, ownerId, branchId);
    }
    const roadmap = await LearningRoadmap.findOne({ _id: roadmapId, ...ownerQuery(ownerId), ...branchQuery(branchId) });
    if (!roadmap) throw new Error("Không tìm thấy lộ trình.");
    if (data.steps && roadmap.steps.length > 0) {
      const linkedBatches = await Batch.find({ roadmapId, ...ownerQuery(ownerId), ...branchQuery(branchId) }).select("roadmapStepId courseId").lean();
      const incomingSteps = new Map(data.steps.map((step) => [step.id, step]));
      for (const batch of linkedBatches) {
        const currentStep = roadmap.steps.find((step) => step.id === batch.roadmapStepId) || roadmap.steps.find((step) => step.courseId === batch.courseId);
        const nextStep = currentStep ? incomingSteps.get(currentStep.id) : undefined;
        if (!currentStep || !nextStep || nextStep.courseId !== currentStep.courseId || nextStep.order !== currentStep.order) {
          throw new Error("Không thể đổi khóa học, thứ tự hoặc xóa chặng đã được dùng để mở lớp. Bạn vẫn có thể chỉnh điều kiện và sĩ số của chặng đó.");
        }
      }
      const used = await BatchEnrollment.exists({ ...ownerQuery(ownerId), roadmapId });
      if (used) {
        const knownStepIds = new Set(data.steps.map((step) => step.id));
        if (roadmap.steps.some((step) => !knownStepIds.has(step.id))) throw new Error("Không thể xóa mốc đã có đăng ký học. Hãy ngừng hoạt động lộ trình nếu cần.");
      }
    }
    Object.assign(roadmap, data);
    await roadmap.save();
    return roadmap;
  }

  static async getBatchProgression(ownerId: OwnerScope, batchId: string, roadmapId: string | undefined, branchId?: string) {
    const batch = await Batch.findOne({ _id: batchId, ...ownerQuery(ownerId), ...branchQuery(branchId) }).lean();
    if (!batch) throw new Error("Không tìm thấy lớp học.");
    const linkedRoadmapId = batch.roadmapId || "";
    if (linkedRoadmapId && roadmapId && roadmapId !== linkedRoadmapId) throw new Error("Lớp học đã được gắn với một lộ trình khác.");
    const roadmaps = await LearningRoadmap.find({
      ...ownerQuery(ownerId),
      ...branchQuery(branchId),
      ...(linkedRoadmapId ? { _id: linkedRoadmapId } : { "steps.courseId": batch.courseId, status: "active" }),
    }).lean();
    const roadmap = linkedRoadmapId ? roadmaps[0] : (roadmapId ? roadmaps.find((item) => idOf(item._id) === roadmapId) : (roadmaps.length === 1 ? roadmaps[0] : undefined));
    if (!roadmap) return { batch: { id: idOf(batch._id), code: batch.code, courseId: batch.courseId }, roadmaps: roadmaps.map(this.roadmapSummary), selectedRoadmapId: "", rows: [] };
    const sourceStep = batch.roadmapStepId ? roadmap.steps.find((step) => step.id === batch.roadmapStepId) : roadmap.steps.find((step) => step.courseId === batch.courseId);
    if (!sourceStep || sourceStep.courseId !== batch.courseId) throw new Error("Lộ trình không có chặng tương ứng với lớp này.");
    const targetStep = roadmap.steps.find((step) => step.order === sourceStep.order + 1);
    const studentIds = batch.learnerIds || [];
    const [students, enrollments, qualityRecords, assignments, miniTests, decisions, exams] = await Promise.all([
      Student.find({ _id: { $in: studentIds }, ...ownerQuery(ownerId), ...branchQuery(branchId) }).select("fullName phone").lean(),
      BatchEnrollment.find({ batchId, studentId: { $in: studentIds }, ...ownerQuery(ownerId), ...branchQuery(branchId) }).lean(),
      StudentQualityRecord.find({ batchId, studentId: { $in: studentIds }, ...ownerQuery(ownerId), ...branchQuery(branchId) }).lean(),
      AssignmentModel.find({ batchId, ...ownerQuery(ownerId), ...branchQuery(branchId) }).select("_id").lean(),
      BatchMiniTest.find({ batchId, ...ownerQuery(ownerId), ...branchQuery(branchId) }).lean(),
      StudentProgressionDecision.find({ sourceBatchId: batchId, roadmapId: idOf(roadmap._id), ...ownerQuery(ownerId), ...branchQuery(branchId) }).lean(),
      Exam.find({ batchId, ...ownerQuery(ownerId), ...branchQuery(branchId) }).lean(),
    ]);
    const assignmentIds = assignments.map((item) => idOf(item._id));
    const submissions = assignmentIds.length ? await SubmissionModel.find({ assignmentId: { $in: assignmentIds }, studentId: { $in: studentIds } }).select("studentId assignmentId").lean() : [];
    const studentMap = new Map(students.map((student) => [idOf(student._id), student]));
    const enrollmentMap = new Map(enrollments.map((item) => [item.studentId, item]));
    const qualityMap = new Map(qualityRecords.map((item) => [item.studentId, item]));
    const decisionMap = new Map(decisions.map((item) => [item.studentId, item]));
    const submittedMap = new Map<string, Set<string>>();
    for (const submission of submissions) { const current = submittedMap.get(submission.studentId) || new Set<string>(); current.add(submission.assignmentId); submittedMap.set(submission.studentId, current); }
    const rows = studentIds.map((studentId) => {
      const enrollment = enrollmentMap.get(studentId);
      const attendanceRate = enrollment && enrollment.allowedSessions > 0 ? Math.round((enrollment.attendedSessions / enrollment.allowedSessions) * 100) : null;
      const assignmentRate = assignmentIds.length ? Math.round(((submittedMap.get(studentId)?.size || 0) / assignmentIds.length) * 100) : null;
      const results = miniTests.flatMap((test) => (test.results || []).filter((result) => result.studentId === studentId && typeof result.score === "number").map((result) => ({ score: result.score as number, maxScore: test.maxScore })));
      const miniTestRate = results.length ? Math.round((results.reduce((sum, item) => sum + item.score, 0) / results.reduce((sum, item) => sum + item.maxScore, 0)) * 100) : null;
      const examScores = exams.flatMap((exam) => (exam.results || []).filter((result) => result.studentId === studentId && typeof result.score === "number").map((result) => ({ score: result.score as number, maxScore: exam.maxScore || 100 })));
      const examRate = examScores.length ? Math.round((examScores.reduce((sum, item) => sum + item.score, 0) / examScores.reduce((sum, item) => sum + item.maxScore, 0)) * 100) : null;
      const previous = decisionMap.get(studentId);
      const evaluated = evaluatePolicy(sourceStep.eligibilityPolicy, { attendanceRate, assignmentRate, miniTestRate, examRate });
      const effectiveEligible = previous?.overrideEligible ?? evaluated.eligible;
      return {
        studentId, studentName: studentMap.get(studentId)?.fullName || "Học viên không còn tồn tại", studentPhone: studentMap.get(studentId)?.phone || "",
        enrollmentId: enrollment ? idOf(enrollment._id) : "", enrollmentStatus: enrollment?.status || "", attendanceRate, assignmentRate, miniTestRate, examRate,
        teacherAssessment: qualityMap.get(studentId)?.teacherAssessment || "",
        eligible: effectiveEligible, eligibilityReasons: evaluated.reasons, intent: previous?.intent || "pending",
        teacherNote: previous?.teacherNote || "", overrideEligible: previous?.overrideEligible ?? null, overrideReason: previous?.overrideReason || "",
      };
    });
    return { batch: { id: idOf(batch._id), code: batch.code, courseId: batch.courseId }, roadmaps: roadmaps.map(this.roadmapSummary), selectedRoadmapId: idOf(roadmap._id), sourceStep, targetStep: targetStep || null, rows };
  }

  static async saveDecision(ownerId: OwnerScope, actor: Actor, input: { batchId: string; roadmapId: string; studentId: string; intent: ProgressionIntent; teacherNote?: string; overrideEligible?: boolean | null; overrideReason?: string; learningFormat?: string; preferredTimeSlot?: string; }) {
    const progress = await this.getBatchProgression(ownerId, input.batchId, input.roadmapId, actor.branchId);
    const row = progress.rows.find((item) => item.studentId === input.studentId);
    if (!row) throw new Error("Học viên không thuộc lớp này.");
    const roadmap = await LearningRoadmap.findOne({ _id: input.roadmapId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) });
    if (!roadmap) throw new Error("Không tìm thấy lộ trình.");
    const sourceBatch = await Batch.findOne({ _id: input.batchId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).select("ownerId").lean();
    if (!sourceBatch) throw new Error("Không tìm thấy lớp nguồn.");
    if (!progress.targetStep && input.intent === "continue") throw new Error("Đây là mốc cuối của lộ trình, không có lớp kế tiếp để chờ xếp.");
    const policyResult = evaluatePolicy(progress.sourceStep.eligibilityPolicy, { attendanceRate: row.attendanceRate, assignmentRate: row.assignmentRate, miniTestRate: row.miniTestRate, examRate: row.examRate });
    const effectiveEligible = input.overrideEligible ?? policyResult.eligible;
    if (input.overrideEligible !== null && input.overrideEligible !== undefined && !String(input.overrideReason || "").trim()) throw new Error("Cần ghi lý do khi duyệt ngoại lệ điều kiện lên lớp.");
    const decision = await StudentProgressionDecision.findOneAndUpdate(
      { ...ownerQuery(ownerId), ...branchQuery(actor.branchId), sourceBatchId: input.batchId, studentId: input.studentId, roadmapId: input.roadmapId },
      { $set: { sourceStepId: progress.sourceStep.id, targetStepId: progress.targetStep?.id || "", sourceEnrollmentId: row.enrollmentId, intent: input.intent, teacherNote: input.teacherNote || "", eligible: policyResult.eligible, eligibilityReasons: policyResult.reasons, eligibilitySnapshot: { attendanceRate: row.attendanceRate, assignmentRate: row.assignmentRate, miniTestRate: row.miniTestRate, evaluatedAt: new Date() }, overrideEligible: input.overrideEligible ?? null, overrideReason: input.overrideReason || "", overrideBy: input.overrideEligible === null || input.overrideEligible === undefined ? "" : actor.uid, overrideAt: input.overrideEligible === null || input.overrideEligible === undefined ? null : new Date() },
        $setOnInsert: { ownerId: sourceBatch.ownerId, branchId: actor.branchId } },
      { upsert: true, returnDocument: 'after' },
    );
    const shouldQueue = input.intent === "continue" && effectiveEligible && progress.targetStep;
    if (shouldQueue) {
      await ClassWaitlistEntry.findOneAndUpdate(
        { ...ownerQuery(ownerId), studentId: input.studentId, roadmapId: input.roadmapId, targetStepId: progress.targetStep!.id, status: "waiting" },
        { $set: { sourceBatchId: input.batchId, sourceEnrollmentId: row.enrollmentId, progressionDecisionId: idOf(decision._id), learningFormat: input.learningFormat || "", preferredTimeSlot: input.preferredTimeSlot || "" },
          $setOnInsert: { ownerId: decision.ownerId, branchId: actor.branchId, studentId: input.studentId, roadmapId: input.roadmapId, targetStepId: progress.targetStep!.id, queuedAt: new Date(), status: "waiting" } },
        { upsert: true, returnDocument: 'after' },
      );
      if (row.enrollmentId) await BatchEnrollment.updateOne({ _id: row.enrollmentId }, { $set: { status: "Chờ xếp lớp tiếp theo" }, $push: { history: { at: new Date(), action: "queued_for_next_step", actorId: actor.uid, note: roadmap.name } } });
    } else {
      await ClassWaitlistEntry.updateMany({ ...ownerQuery(ownerId), studentId: input.studentId, roadmapId: input.roadmapId, sourceBatchId: input.batchId, status: "waiting" }, { $set: { status: "cancelled" } });
    }
    return { decision, queued: Boolean(shouldQueue) };
  }

  static async promoteStudents(ownerId: OwnerScope, actor: Actor, input: { sourceBatchId: string; roadmapId: string; targetBatchId: string; studentIds: string[] }) {
    const studentIds = [...new Set(input.studentIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!studentIds.length) throw new ValidationError("VALIDATION_FAILED", "Hãy chọn ít nhất một học viên.");

    const session = await mongoose.startSession();
    try {
      let result: { sourceBatchId: string; targetBatchId: string; studentIds: string[] } | undefined;
      await session.withTransaction(async () => {
        const sourceBatch = await Batch.findOne({ _id: input.sourceBatchId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).session(session);
        if (!sourceBatch) throw new ValidationError("VALIDATION_FAILED", "Không tìm thấy lớp nguồn.");
        if (sourceBatch.status !== "Đã kết thúc") throw new ValidationError("VALIDATION_FAILED", "Chỉ có thể lên level trực tiếp sau khi lớp đã kết thúc.");
        const selectedRoadmapId = String(input.roadmapId || sourceBatch.roadmapId || "");
        if (!selectedRoadmapId) throw new ValidationError("VALIDATION_FAILED", "Hãy chọn lộ trình có level tiếp theo cho lớp này.");
        if (sourceBatch.roadmapId && sourceBatch.roadmapId !== selectedRoadmapId) throw new ValidationError("VALIDATION_FAILED", "Lớp học đã được gắn với một lộ trình khác.");
        if (studentIds.some((studentId) => !(sourceBatch.learnerIds || []).includes(studentId))) throw new ValidationError("VALIDATION_FAILED", "Có học viên không thuộc lớp nguồn.");

        const roadmap = await LearningRoadmap.findOne({ _id: selectedRoadmapId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId), status: "active" }).session(session);
        const sourceStep = sourceBatch.roadmapStepId
          ? roadmap?.steps.find((step) => step.id === sourceBatch.roadmapStepId)
          : roadmap?.steps.find((step) => step.courseId === sourceBatch.courseId);
        const targetStep = sourceStep && roadmap?.steps.find((step) => step.order === sourceStep.order + 1);
        if (!roadmap || !sourceStep || sourceStep.courseId !== sourceBatch.courseId) throw new ValidationError("VALIDATION_FAILED", "Không tìm thấy chặng lộ trình của lớp nguồn.");
        if (!targetStep) throw new ValidationError("VALIDATION_FAILED", "Lớp đang ở level cuối, không có level kế tiếp.");
        if (!sourceBatch.roadmapId || !sourceBatch.roadmapStepId) {
          sourceBatch.roadmapId = idOf(roadmap._id);
          sourceBatch.roadmapStepId = sourceStep.id;
          await sourceBatch.save({ session });
        }

        const targetBatch = await Batch.findOne({ _id: input.targetBatchId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).session(session);
        if (!targetBatch) throw new ValidationError("VALIDATION_FAILED", "Không tìm thấy lớp đích.");
        if (String(targetBatch.ownerId) !== String(sourceBatch.ownerId) || targetBatch.branchId !== sourceBatch.branchId) throw new ValidationError("VALIDATION_FAILED", "Lớp đích phải thuộc cùng đơn vị và chi nhánh với lớp nguồn.");
        if (targetBatch.status !== "Sắp khai giảng") throw new ValidationError("VALIDATION_FAILED", "Chỉ có thể chuyển học viên vào lớp đang sắp khai giảng.");
        if (targetBatch.courseId !== targetStep.courseId || targetBatch.roadmapId !== String(roadmap._id) || targetBatch.roadmapStepId !== targetStep.id) throw new ValidationError("VALIDATION_FAILED", "Lớp đích không thuộc đúng level tiếp theo của lộ trình.");

        const sourceEnrollments = await BatchEnrollment.find({ batchId: input.sourceBatchId, studentId: { $in: studentIds }, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).session(session);
        const enrollmentByStudent = new Map(sourceEnrollments.map((enrollment) => [enrollment.studentId, enrollment]));
        if (sourceEnrollments.length !== studentIds.length) throw new ValidationError("VALIDATION_FAILED", "Một hoặc nhiều học viên chưa có dữ liệu đăng ký lớp để chuyển.");
        const unavailable = sourceEnrollments.find((enrollment) => !["Đang học", "Chờ xếp lớp tiếp theo", "Hoàn thành khóa"].includes(enrollment.status));
        if (unavailable) throw new ValidationError("VALIDATION_FAILED", "Chỉ có thể chuyển học viên đang học, chờ lên lớp hoặc đã hoàn thành khóa.");

        const course = await Course.findOne({ _id: targetBatch.courseId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).session(session);
        const capacity = targetStep.maxClassSize || resolveQuota(targetBatch.quota, course?.maxLearners);
        if (capacity > 0 && targetBatch.learnerIds.length + studentIds.filter((studentId) => !targetBatch.learnerIds.includes(studentId)).length > capacity) {
          throw new ValidationError("VALIDATION_FAILED", `Lớp đích vượt sĩ số tối đa (${capacity} học viên).`);
        }
        if (studentIds.some((studentId) => targetBatch.learnerIds.includes(studentId))) throw new ValidationError("VALIDATION_FAILED", "Có học viên đã thuộc lớp đích.");
        const duplicateAtStep = await BatchEnrollment.exists({ ...ownerQuery(ownerId), ...branchQuery(actor.branchId), studentId: { $in: studentIds }, roadmapId: String(roadmap._id), roadmapStepId: targetStep.id, status: { $in: ACTIVE_ENROLLMENT_STATUSES } }).session(session);
        if (duplicateAtStep) throw new ValidationError("VALIDATION_FAILED", "Có học viên đã được xếp vào một lớp khác tại level này.");

        const now = new Date();
        const reason = "Chuyển level trực tiếp, không yêu cầu thi.";
        const decisions = new Map<string, string>();
        for (const studentId of studentIds) {
          const enrollment = enrollmentByStudent.get(studentId)!;
          const decision = await StudentProgressionDecision.findOneAndUpdate(
            { ...ownerQuery(ownerId), ...branchQuery(actor.branchId), sourceBatchId: input.sourceBatchId, studentId, roadmapId: String(roadmap._id) },
            { $set: { sourceStepId: sourceStep.id, targetStepId: targetStep.id, sourceEnrollmentId: idOf(enrollment._id), intent: "continue", teacherNote: reason, eligible: true, eligibilityReasons: [], eligibilitySnapshot: { directPromotion: true, promotedAt: now }, overrideEligible: true, overrideReason: reason, overrideBy: actor.uid, overrideAt: now }, $setOnInsert: { ownerId: sourceBatch.ownerId, branchId: actor.branchId } },
            { upsert: true, returnDocument: "after", session },
          );
          decisions.set(studentId, idOf(decision._id));
        }

        const enrollments = await BatchEnrollment.create(studentIds.map((studentId) => ({ ownerId: targetBatch.ownerId, branchId: targetBatch.branchId, batchId: input.targetBatchId, studentId, allowedSessions: 0, attendedSessions: 0, status: "Đang học", joinedAt: now, roadmapId: String(roadmap._id), roadmapStepId: targetStep.id, sourceEnrollmentId: idOf(enrollmentByStudent.get(studentId)!._id), enrollmentReason: "promotion", history: [{ at: now, action: "promoted", actorId: actor.uid, note: reason }] })), { session, ordered: true });
        const allowedSessions = await resolveBatchTotalSessions(targetBatch);
        await BatchEnrollment.updateMany({ _id: { $in: enrollments.map((enrollment) => enrollment._id) } }, { $set: { allowedSessions } }, { session });

        targetBatch.learnerIds.push(...studentIds);
        await targetBatch.save({ session });
        for (let index = 0; index < studentIds.length; index += 1) {
          const studentId = studentIds[index];
          const sourceEnrollment = enrollmentByStudent.get(studentId)!;
          sourceEnrollment.status = "Hoàn thành khóa";
          sourceEnrollment.history.push({ at: now, action: "promoted_to_next_batch", actorId: actor.uid, note: targetBatch.code });
          await sourceEnrollment.save({ session });
          await ClassWaitlistEntry.updateMany(
            { ...ownerQuery(ownerId), ...branchQuery(actor.branchId), studentId, roadmapId: String(roadmap._id), targetStepId: targetStep.id, sourceBatchId: input.sourceBatchId, status: "waiting" },
            { $set: { status: "assigned", assignedAt: now, assignedBatchId: input.targetBatchId, assignedEnrollmentId: idOf(enrollments[index]._id), progressionDecisionId: decisions.get(studentId) || "" } },
            { session },
          );
        }
        result = { sourceBatchId: input.sourceBatchId, targetBatchId: input.targetBatchId, studentIds };
      });
      return result!;
    } finally { await session.endSession(); }
  }

  static async listWaitlist(ownerId: OwnerScope, filters: { roadmapId?: string; targetStepId?: string; batchId?: string; search?: string; page?: string | number; limit?: string | number }, branchId?: string) {
    const query: Record<string, unknown> = { ...ownerQuery(ownerId), ...branchQuery(branchId), status: "waiting" };
    if (filters.roadmapId) query.roadmapId = filters.roadmapId;
    if (filters.targetStepId) query.targetStepId = filters.targetStepId;
    if (filters.batchId) query.sourceBatchId = filters.batchId;
    const page = Math.max(1, Number(filters.page) || 1); const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25));
    const entries = await ClassWaitlistEntry.find(query).sort({ queuedAt: 1 }).lean();
    const studentIds = [...new Set(entries.map((entry) => entry.studentId))];
    const sourceBatchIds = [...new Set(entries.map((entry) => entry.sourceBatchId))];
    const roadmapIds = [...new Set(entries.map((entry) => entry.roadmapId))];
    const [students, batches, roadmaps] = await Promise.all([Student.find({ _id: { $in: studentIds } }).select("fullName phone").lean(), Batch.find({ _id: { $in: sourceBatchIds } }).select("code courseId").lean(), LearningRoadmap.find({ _id: { $in: roadmapIds } }).lean()]);
    const studentMap = new Map(students.map((item) => [idOf(item._id), item])); const batchMap = new Map(batches.map((item) => [idOf(item._id), item])); const roadmapMap = new Map(roadmaps.map((item) => [idOf(item._id), item]));
    const rows = entries.map((entry) => { const student = studentMap.get(entry.studentId); const roadmap = roadmapMap.get(entry.roadmapId); const step = roadmap?.steps.find((item) => item.id === entry.targetStepId); return { id: idOf(entry._id), studentId: entry.studentId, studentName: student?.fullName || "Học viên không còn tồn tại", studentPhone: student?.phone || "", roadmapId: entry.roadmapId, roadmapName: roadmap?.name || "Lộ trình đã xóa", targetStepId: entry.targetStepId, targetCourseId: step?.courseId || "", sourceBatchId: entry.sourceBatchId, sourceBatchCode: batchMap.get(entry.sourceBatchId)?.code || "Lớp đã xóa", learningFormat: entry.learningFormat, preferredTimeSlot: entry.preferredTimeSlot, queuedAt: entry.queuedAt, waitingDays: Math.max(0, Math.floor((Date.now() - new Date(entry.queuedAt).getTime()) / 86400000)) }; }).filter((row) => !filters.search || `${row.studentName} ${row.studentPhone}`.toLowerCase().includes(filters.search!.toLowerCase()));
    return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, totalPages: Math.ceil(rows.length / limit) };
  }

  static async placeWaitlist(ownerId: OwnerScope, actor: Actor, batchId: string, entryIds: string[]) {
    if (!entryIds.length) throw new ValidationError("VALIDATION_FAILED", "Hãy chọn ít nhất một học viên.");
    const session = await mongoose.startSession();
    try {
      let result: { batchId: string; studentIds: string[] } | undefined;
      await session.withTransaction(async () => {
        const batch = await Batch.findOne({ _id: batchId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).session(session);
        if (!batch) throw new ValidationError("VALIDATION_FAILED", "Không tìm thấy lớp đích.");
        if (batch.status !== "Sắp khai giảng") throw new ValidationError("VALIDATION_FAILED", "Chỉ được xếp vào lớp chưa khai giảng.");
        const entries = await ClassWaitlistEntry.find({ _id: { $in: entryIds }, ...ownerQuery(ownerId), ...branchQuery(actor.branchId), status: "waiting" }).session(session);
        if (entries.length !== entryIds.length) throw new ValidationError("VALIDATION_FAILED", "Một hoặc nhiều học viên không còn trong danh sách chờ.");
        const roadmap = await LearningRoadmap.findOne({ _id: entries[0].roadmapId, ...ownerQuery(ownerId), ...branchQuery(actor.branchId) }).session(session);
        if (!roadmap || entries.some((entry) => entry.roadmapId !== idOf(roadmap._id) || entry.targetStepId !== entries[0].targetStepId)) throw new ValidationError("VALIDATION_FAILED", "Chỉ có thể xếp các học viên cùng một mốc lộ trình.");
        const targetStep = roadmap.steps.find((step) => step.id === entries[0].targetStepId);
        if (!targetStep || batch.courseId !== targetStep.courseId || batch.roadmapId !== idOf(roadmap._id) || batch.roadmapStepId !== targetStep.id) {
          throw new ValidationError("VALIDATION_FAILED", "Lớp đích không thuộc đúng lộ trình và mốc lộ trình kế tiếp.");
        }
        const course = await Course.findById(batch.courseId).session(session);
        const capacity = targetStep.maxClassSize || resolveQuota(batch.quota, course?.maxLearners);
        if (capacity > 0 && batch.learnerIds.length + entries.length > capacity) throw new ValidationError("VALIDATION_FAILED", `Lớp đích vượt sĩ số tối đa (${capacity} học viên).`);
        const studentIds = entries.map((entry) => entry.studentId);
        if (studentIds.some((studentId) => batch.learnerIds.includes(studentId))) throw new ValidationError("VALIDATION_FAILED", "Có học viên đã thuộc lớp đích.");
        const duplicate = await BatchEnrollment.exists({ ...ownerQuery(ownerId), studentId: { $in: studentIds }, roadmapId: idOf(roadmap._id), roadmapStepId: targetStep.id, status: { $in: ACTIVE_ENROLLMENT_STATUSES }, batchId: { $ne: batchId } }).session(session);
        if (duplicate) throw new ValidationError("VALIDATION_FAILED", "Có học viên đã được xếp vào một lớp khác tại cùng mốc lộ trình.");
        const now = new Date();
        // Mongoose yêu cầu ordered:true khi create nhiều document trong transaction.
        // Nếu một bản ghi không tạo được, transaction sẽ rollback toàn bộ lượt chuyển.
        const enrollments = await BatchEnrollment.create(entries.map((entry) => ({ ownerId: batch.ownerId, branchId: batch.branchId, batchId, studentId: entry.studentId, allowedSessions: 0, attendedSessions: 0, status: "Đang học", joinedAt: now, roadmapId: idOf(roadmap._id), roadmapStepId: targetStep.id, sourceEnrollmentId: entry.sourceEnrollmentId || "", enrollmentReason: "promotion", history: [{ at: now, action: "promoted", actorId: actor.uid }] })), { session, ordered: true });
        const allowedSessions = await resolveBatchTotalSessions(batch);
        await BatchEnrollment.updateMany({ _id: { $in: enrollments.map((enrollment) => enrollment._id) } }, { $set: { allowedSessions } }, { session });
        batch.learnerIds.push(...studentIds); await batch.save({ session });
        await ClassWaitlistEntry.updateMany({ _id: { $in: entries.map((entry) => entry._id) } }, { $set: { status: "assigned", assignedAt: now, assignedBatchId: batchId }, $setOnInsert: {} }, { session });
        for (let index = 0; index < entries.length; index += 1) await ClassWaitlistEntry.updateOne({ _id: entries[index]._id }, { $set: { assignedEnrollmentId: idOf(enrollments[index]._id) } }, { session });
        await BatchEnrollment.updateMany({ _id: { $in: entries.map((entry) => entry.sourceEnrollmentId).filter(Boolean) } }, { $set: { status: "Hoàn thành khóa" }, $push: { history: { at: now, action: "promoted_to_next_batch", actorId: actor.uid, note: batch.code } } }, { session });
        result = { batchId, studentIds };
      });
      return result!;
    } finally { await session.endSession(); }
  }

  private static roadmapSummary(roadmap: ILearningRoadmap) { return { id: idOf(roadmap._id), code: roadmap.code, name: roadmap.name, steps: roadmap.steps }; }

  private static assertSteps(steps: ILearningRoadmapStep[]) {
    if (!steps.length) throw new Error("Lộ trình cần có ít nhất một mốc.");
    const ids = new Set<string>(); const courses = new Set<string>(); const orders = new Set<number>();
    for (const step of steps) {
      if (!step.id || !step.courseId) throw new Error("Mỗi mốc cần có mã mốc và khóa học.");
      if (ids.has(step.id) || courses.has(step.courseId) || orders.has(step.order)) throw new Error("Mốc, khóa học và thứ tự trong một lộ trình không được trùng.");
      if (step.maxClassSize > 0 && step.minClassSize > step.maxClassSize) throw new Error("Sĩ số tối thiểu không thể lớn hơn sĩ số tối đa.");
      ids.add(step.id); courses.add(step.courseId); orders.add(step.order);
    }
  }

  private static async assertCoursesExist(steps: ILearningRoadmapStep[], ownerId: OwnerScope, branchId?: string) {
    const courseIds = [...new Set(steps.map((step) => step.courseId))];
    const courses = await Course.find({ _id: { $in: courseIds }, ...ownerQuery(ownerId), ...branchQuery(branchId) }).select("_id").lean();
    if (courses.length !== courseIds.length) throw new Error("Một hoặc nhiều khóa học trong lộ trình không tồn tại hoặc không thuộc đơn vị hiện tại.");
  }
}
