import { Exam } from "../models/exam.model";
import { Student } from "../models/student.model";
import { Batch } from "../models/batch.model";
import { BatchEnrollment } from "../models/batch-enrollment.model";
import { IExam } from "../interfaces/exam.interface";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import { listScheduledSessionDates, todayInVietnam } from "../utils/session-count.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";
import { customFieldResourceService } from "./custom-field-resource.service";

const MOTORBIKE_LICENSE_PREFIXES = ['A1', 'A2', 'A3', 'A4'];
const CAR_LICENSE_PREFIXES = ['B1', 'B2', 'C', 'D', 'E', 'F', 'FB', 'FC', 'FD', 'FE'];

function normalizeRank(value?: string | null) {
  return String(value || '').trim().toUpperCase();
}

function getDrivingExamBucket(rank?: string | null): 'motorbike' | 'car' | null {
  const normalized = normalizeRank(rank);
  if (!normalized) return null;
  if (MOTORBIKE_LICENSE_PREFIXES.some(prefix => normalized.startsWith(prefix))) return 'motorbike';
  if (CAR_LICENSE_PREFIXES.some(prefix => normalized.startsWith(prefix))) return 'car';
  return null;
}

/** Lịch thi có thể được lập trước khi lớp kết thúc; chỉ khóa lớp đã đóng/hủy. */
function assertBatchReadyForExam(batch: { status: string }) {
  if (batch.status === "Đã hủy" || batch.status === "Đã kết thúc") throw new Error("Lớp này đã đóng hoặc bị hủy, không thể tạo lịch thi mới.");
  if (batch.status !== "Đang học") throw new Error("Chỉ lớp đang học mới có thể lập lịch thi.");
}

function isExamResultComplete(result: { score?: number; outcome?: string }) {
  return typeof result.score === "number" || result.outcome === "Đậu" || result.outcome === "Trượt";
}

function examDateToIso(value?: string) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split("/");
  if (parts.length === 3 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1]) && /^\d{4}$/.test(parts[2])) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return "";
}

/** Cho phép thi sớm tối đa 15% số buổi theo lịch của lớp. */
function assertExamDateIsEligible(batch: { startDate: string; endDate: string; daysOfWeek?: number[] }, value?: string) {
  const examDate = examDateToIso(value);
  if (!examDate) return;
  const sessionDates = listScheduledSessionDates(batch.startDate, batch.endDate, batch.daysOfWeek || []);
  if (!sessionDates.length) return;
  const earliestIndex = Math.max(0, Math.ceil(sessionDates.length * 0.85) - 1);
  const earliestDate = sessionDates[earliestIndex];
  if (examDate < earliestDate) {
    throw new Error(`Lịch thi chỉ được sớm tối đa 15% tiến độ lớp, từ ngày ${earliestDate.split("-").reverse().join("/")}.`);
  }
}

/** Chỉ chấm khi tới ngày thi, lớp đã hết buổi và toàn bộ buổi đã chốt điểm danh. */
async function assertExamReadyToGrade(exam: Pick<IExam, "batchId" | "tentativeDate" | "officialDate">, ownerId: string | string[], branchId?: string) {
  if (!exam.batchId) return;
  const ownerFilter = ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
  const batch = await Batch.findOne({ _id: exam.batchId, ...ownerFilter, ...(branchId ? { branchId } : {}) });
  if (!batch) throw new Error("Không tìm thấy lớp học của kỳ thi.");
  if (batch.status === "Đã hủy") throw new Error("Lớp đã hủy, không thể chấm kết quả thi.");

  const today = todayInVietnam();
  const examDate = examDateToIso(exam.officialDate || exam.tentativeDate);
  if (examDate && today < examDate) throw new Error("Chưa đến ngày thi, chưa thể nhập kết quả.");

  const scheduledDates = listScheduledSessionDates(batch.startDate, batch.endDate, batch.daysOfWeek || []);
  const confirmedDates = new Set((batch.attendanceSessions || [])
    .filter((session) => scheduledDates.includes(session.date) && session.records.length > 0)
    .map((session) => session.date));
  const requiredSessions = Math.ceil(scheduledDates.length * 0.85);
  if (confirmedDates.size < requiredSessions) throw new Error(`Cần chốt ít nhất ${requiredSessions}/${scheduledDates.length} buổi học (85%) trước khi nhập kết quả thi.`);
}

/** Tự đóng lớp sau khi toàn bộ kỳ thi của lớp đã có kết quả. */
async function closeBatchAfterExamIfReady(ownerId: string | string[], batchId: string, branchId?: string) {
  const ownerFilter = ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
  const batch = await Batch.findOne({ _id: batchId, ...ownerFilter, ...(branchId ? { branchId } : {}) });
  if (!batch || batch.status !== "Đang học") return false;

  const exams = await Exam.find({ ownerId: batch.ownerId, branchId: batch.branchId, batchId: String(batch._id), status: { $ne: "Đã hủy" } })
    .select("results")
    .lean();
  if (!exams.length || exams.some((item) => !(item.results || []).length || (item.results || []).some((result) => !isExamResultComplete(result)))) return false;

  const updated = await Batch.findOneAndUpdate(
    { _id: batch._id, status: "Đang học" },
    { $set: { status: "Đã kết thúc", completedAt: new Date(), cancelledAt: null } },
    { returnDocument: 'after' },
  );
  if (updated) logger.info(`[Exam] Batch closed automatically after exam completion: batchId=${batch._id}`);
  return Boolean(updated);
}

/** Kết quả trượt chỉ tạo yêu cầu chờ xếp học lại; không tự gán lớp hay lệ phí. */
async function queueRetakeAfterFailedExam(ownerId: string | string[], branchId: string | undefined, batchId: string, studentId: string, examId: string) {
  if (!batchId) return;
  const ownerFilter = ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
  const enrollment = await BatchEnrollment.findOne({ ...ownerFilter, ...(branchId ? { branchId } : {}), batchId, studentId });
  if (!enrollment || enrollment.status === "Chờ xếp học lại" || enrollment.status === "Học lại") return;
  const fromStatus = enrollment.status;
  enrollment.status = "Chờ xếp học lại" as any;
  enrollment.history.push({ at: new Date(), action: "exam_failed", fromStatus, toStatus: "Chờ xếp học lại" as any, note: `Trượt kỳ thi ${examId}` });
  await enrollment.save();
}

function isStudentEligibleForExamRank(
  businessType: string,
  examRank?: string | null,
  studentRank?: string | null
) {
  const normalizedExamRank = normalizeRank(examRank);
  if (!normalizedExamRank) return true;

  if (businessType !== 'driving') {
    return true;
  }

  const examBucket = getDrivingExamBucket(normalizedExamRank);
  const studentBucket = getDrivingExamBucket(studentRank);

  if (!examBucket) {
    return normalizeRank(studentRank) === normalizedExamRank;
  }

  return examBucket === studentBucket;
}

interface ExamFilters {
  page?: number | string;
  limit?: number | string;
  status?: string;
  rank?: string;
  /** superadmin only: scope data to a specific center (admin uid) */
  ownerFilter?: string;
}

interface ExamCreateData {
  [key: string]: unknown;
}

interface ExamUpdateData {
  [key: string]: unknown;
}

interface ImportResultItem {
  phone: string;
  overallResult: "Đậu" | "Trượt" | "Chưa có";
  theory?: number;
  practice?: number;
  simulation?: number;
  fullName?: string;
}

interface ValidImportPreview {
  phone: string;
  fullName: string;
  rank?: string;
  overallResult: string;
  theory?: number;
  practice?: number;
  simulation?: number;
}

interface InvalidImportPreview {
  phone: string;
  fullName: string;
  reason: string;
}

export class ExamService {
  static customFieldWrites = customFieldWriteService;

  static async createExam(ownerId: string, data: ExamCreateData, context: CustomFieldWriteContext): Promise<IExam> {
    logger.info(`[Exam] Creating exam for ownerId=${ownerId}, data=${JSON.stringify(data)}`);
    const writeData = await this.customFieldWrites.prepareCreate(context, data);
    const batchId = String(writeData.batchId || "");
    if (!batchId) throw new Error("Hãy chọn lớp học cho lịch thi.");
    const batch = await Batch.findOne({ _id: batchId, ownerId, branchId: writeData.branchId });
    if (!batch) throw new Error("Không tìm thấy lớp học của lịch thi.");
    assertBatchReadyForExam(batch);
    assertExamDateIsEligible(batch, String(writeData.tentativeDate || ""));
    const maxScore = Number(writeData.maxScore || 100);
    const passScore = writeData.passScore === undefined ? Math.ceil(maxScore / 2) : Number(writeData.passScore);
    if (!Number.isFinite(passScore) || passScore < 0 || passScore > maxScore) throw new Error("Ngưỡng đạt phải nằm trong khoảng 0 đến thang điểm.");
    const exam = new Exam({ ...writeData, maxScore, passScore, ownerId, studentCount: batch.learnerIds.length, results: batch.learnerIds.map((studentId) => ({ studentId, outcome: "Chưa có" })) });
    const savedExam = await exam.save();
    await customFieldResourceService.finalizeEntity(context, savedExam);
    logger.info(`[Exam] Exam created successfully: id=${savedExam._id}, name=${savedExam.name}`);
    return savedExam;
  }

  static async gradeResults(ownerId: string | string[], examId: string, results: Array<{ studentId: string; score: number; note?: string }>, actorId: string, branchId?: string) {
    const query: Record<string, unknown> = { _id: examId };
    if (ownerId !== "ALL") query.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    if (branchId) query.branchId = branchId;
    const exam = await Exam.findOne(query);
    if (!exam) throw new Error("Không tìm thấy lịch thi.");
    await assertExamReadyToGrade(exam, ownerId, branchId);
    const allowedStudents = new Set((exam.results || []).map((item) => item.studentId));
    const maxScore = Number(exam.maxScore || 100);
    const passScore = Number.isFinite(Number(exam.passScore)) ? Number(exam.passScore) : Math.ceil(maxScore / 2);
    if (passScore > maxScore) throw new Error("Ngưỡng đạt không được lớn hơn thang điểm.");
    if (exam.passScore == null) exam.passScore = passScore;
    const invalid = results.find((item) => !allowedStudents.has(item.studentId) || item.score < 0 || item.score > maxScore);
    if (invalid) throw new Error("Điểm hoặc học viên không hợp lệ cho lịch thi này.");
    const now = new Date();
    for (const input of results) {
      const item = exam.results?.find((result) => result.studentId === input.studentId);
      if (item) {
        item.score = input.score;
        item.outcome = input.score >= passScore ? "Đậu" : "Trượt";
        item.note = input.note || "";
        item.gradedBy = actorId;
        item.gradedAt = now;
      }
    }
    const complete = (exam.results || []).every((item) => typeof item.score === "number");
    exam.status = complete ? "Đã hoàn thành" : exam.status;
    exam.passCount = (exam.results || []).filter((item) => item.outcome === "Đậu").length;
    exam.failCount = (exam.results || []).filter((item) => item.outcome === "Trượt").length;
    await exam.save();
    if (complete && exam.batchId) await closeBatchAfterExamIfReady(ownerId, String(exam.batchId), branchId);
    await Promise.all(results.map((input) => Student.updateOne(
      { _id: input.studentId },
      { $pull: { exams: { id: String(exam._id) } } }
    ).then(() => Student.updateOne(
      { _id: input.studentId },
      { $push: { exams: { id: String(exam._id), name: exam.name, date: exam.officialDate || exam.tentativeDate, type: "Tốt nghiệp", status: "Đã thi", batchId: exam.batchId || "", result: { theory: input.score, practice: 0, simulation: 0, overall: input.score >= passScore ? "Đậu" : "Trượt" } } } }
    ))));
    const passedStudentIds = (exam.results || []).filter((item) => item.outcome === "Đậu").map((item) => item.studentId);
    const failedStudentIds = (exam.results || []).filter((item) => item.outcome === "Trượt").map((item) => item.studentId);
    if (exam.batchId && passedStudentIds.length) {
      const batch = await Batch.findOne({ _id: exam.batchId }).select("courseId").lean();
      if (batch?.courseId) await Student.updateMany(
        { _id: { $in: passedStudentIds } },
        { $addToSet: { completedCourseIds: batch.courseId } },
      );
    }
    if (exam.batchId) {
      await Promise.all(failedStudentIds.map((studentId) => queueRetakeAfterFailedExam(ownerId, branchId, exam.batchId!, studentId, String(exam._id))));
    }
    return exam;
  }

  static async getExams(ownerId: string | string[], filters: ExamFilters, branchId?: string) {
    logger.info(`[Exam] Fetching exams for ownerId=${ownerId} with filters: ${JSON.stringify(filters)}`);
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    // superadmin scope override: if ownerFilter provided, resolve to that center's userIds
    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = {};
    if (resolvedOwnerId !== "ALL") {
      query.ownerId = Array.isArray(resolvedOwnerId) ? { $in: resolvedOwnerId } : resolvedOwnerId;
    }
    if (branchId) query.branchId = branchId;
    if (filters.status) query.status = filters.status;
    if (filters.rank) query.rank = filters.rank;

    const total = await Exam.countDocuments(query);
    const exams = await Exam.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    logger.info(`[Exam] Fetched ${exams.length} exams (total=${total}) for ownerId=${ownerId}`);
    return {
      exams,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getExamById(ownerId: string | string[], id: string, branchId?: string): Promise<IExam | null> {
    logger.info(`[Exam] Fetching exam detail: id=${id}, ownerId=${ownerId}`);
    const query: Record<string, unknown> = { _id: id };
    if (ownerId !== "ALL") {
      query.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) query.branchId = branchId;
    return await Exam.findOne(query);
  }

  static async updateExam(
    ownerId: string | string[],
    id: string,
    data: ExamUpdateData,
    context: CustomFieldWriteContext,
    branchId?: string,
  ): Promise<IExam | null> {
    logger.info(`[Exam] Updating exam: id=${id}, ownerId=${ownerId}`);
    const query: Record<string, unknown> = { _id: id };
    if (ownerId !== "ALL") {
      query.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) query.branchId = branchId;
    const existingExam = await Exam.findOne(query);
    if (!existingExam) return null;
    const expectedVersion = expectedVersionOf(data);
    const targetContext = context.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(existingExam.ownerId) } : context;
    const writeData = await this.customFieldWrites.prepareUpdate(targetContext, existingExam, data);
    const nextBatchId = String(writeData.batchId || existingExam.batchId || "");
    if (nextBatchId) {
      const batch = await Batch.findOne({ _id: nextBatchId, ...(ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId }), ...(branchId ? { branchId } : {}) });
      if (!batch) throw new Error("Không tìm thấy lớp học của lịch thi.");
      assertExamDateIsEligible(batch, String(writeData.tentativeDate || existingExam.tentativeDate || ""));
    }
    const nextMaxScore = writeData.maxScore === undefined ? Number(existingExam.maxScore || 100) : Number(writeData.maxScore);
    const nextPassScore = writeData.passScore === undefined ? Number(existingExam.passScore ?? Math.ceil(nextMaxScore / 2)) : Number(writeData.passScore);
    if (!Number.isFinite(nextPassScore) || nextPassScore < 0 || nextPassScore > nextMaxScore) throw new Error("Ngưỡng đạt phải nằm trong khoảng 0 đến thang điểm.");
    writeData.passScore = nextPassScore;
    const updatedExam = await Exam.findOneAndUpdate(
      { ...query, ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
      { $set: writeData, $inc: { __v: 1 } },
      { returnDocument: 'after', runValidators: true }
    );
    if (updatedExam) {
      await customFieldResourceService.finalizeEntity(targetContext, updatedExam);
      logger.info(`[Exam] Exam updated successfully: id=${id}`);
    } else throw new CustomFieldWriteConflictError();
    return updatedExam;
  }

  static async deleteExam(ownerId: string | string[], id: string, branchId?: string): Promise<IExam | null> {
    logger.info(`[Exam] Deleting exam: id=${id}, ownerId=${ownerId}`);
    const query: Record<string, unknown> = { _id: id };
    if (ownerId !== "ALL") {
      query.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) query.branchId = branchId;
    const deletedExam = await Exam.findOneAndDelete(query);
    if (deletedExam) {
      logger.info(`[Exam] Exam deleted successfully: id=${id}`);
    } else {
      logger.warn(`[Exam] Exam delete failed/not found: id=${id}, ownerId=${ownerId}`);
    }
    return deletedExam;
  }

  static async assignStudents(ownerId: string | string[], examId: string, studentIds: string[], branchId?: string): Promise<{ success: boolean }> {
    logger.info(`[Exam] Assigning ${studentIds.length} students to examId=${examId}, ownerId=${ownerId}`);
    const examQuery: Record<string, unknown> = { _id: examId };
    if (ownerId !== "ALL") {
      examQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) examQuery.branchId = branchId;
    const exam = await Exam.findOne(examQuery);
    if (!exam) {
      logger.warn(`[Exam] Assign students failed - Exam not found: id=${examId}, ownerId=${ownerId}`);
      throw new Error("Kỳ thi không tồn tại.");
    }

    const studentQuery: Record<string, unknown> = { _id: { $in: studentIds } };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) studentQuery.branchId = branchId;

    // Update students (assign to exam and add to history)
    const updateResult = await Student.updateMany(
      studentQuery,
      {
        $set: {
          examId: exam._id.toString(),
          examName: exam.name,
          examDate: exam.tentativeDate,
          status: ["Đang thi"],
        },
        $push: {
          exams: {
            id: exam._id.toString(),
            name: exam.name,
            date: exam.tentativeDate,
            type: "Sát hạch",
            status: "Sắp thi",
            result: { theory: 0, practice: 0, simulation: 0, overall: "Chưa có" }
          }
        }
      }
    );
    logger.info(`[Exam] Assigned students updated database: matchedCount=${updateResult.matchedCount}, modifiedCount=${updateResult.modifiedCount}`);

    // Update exam student count
    exam.studentCount += studentIds.length;
    await exam.save();
    logger.info(`[Exam] Updated studentCount for examId=${examId} to: ${exam.studentCount}`);

    return { success: true };
  }

  static async unassignStudent(
    ownerId: string | string[],
    examId: string,
    studentId: string,
    branchId?: string
  ): Promise<{ success: boolean }> {
    logger.info(`[Exam] Unassigning studentId=${studentId} from examId=${examId}, ownerId=${ownerId}`);

    // Check if the exam exists
    const examQuery: Record<string, unknown> = { _id: examId };
    if (ownerId !== "ALL") {
      examQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) examQuery.branchId = branchId;
    const exam = await Exam.findOne(examQuery);
    if (!exam) {
      logger.warn(`[Exam] Unassign student failed - Exam not found: id=${examId}, ownerId=${ownerId}`);
      throw new Error("Kỳ thi không tồn tại.");
    }

    // Find student who matches the studentId and ownerId and has active examId = examId
    const studentQuery: Record<string, unknown> = { _id: studentId, examId };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) studentQuery.branchId = branchId;
    const student = await Student.findOne(studentQuery);
    if (!student) {
      logger.warn(`[Exam] Unassign student failed - Student not found or not assigned: studentId=${studentId}, examId=${examId}`);
      throw new Error("Học viên không thuộc kỳ thi này hoặc không tồn tại.");
    }

    // Update student: clear active exam info, change status to "Đang học", and pull from exams list
    await Student.updateOne(
      { _id: studentId },
      {
        $set: {
          examId: "",
          examName: "",
          examDate: "",
          status: ["Đang học"],
        },
        $pull: {
          exams: { id: examId }
        }
      }
    );

    // Recalculate exam student count and pass/fail count
    const studentCount = await Student.countDocuments({ examId });
    const passCount = await Student.countDocuments({
      examId,
      exams: {
        $elemMatch: {
          id: examId,
          "result.overall": "Đậu"
        }
      }
    });
    const failCount = await Student.countDocuments({
      examId,
      exams: {
        $elemMatch: {
          id: examId,
          "result.overall": "Trượt"
        }
      }
    });

    exam.studentCount = studentCount;
    exam.passCount = passCount;
    exam.failCount = failCount;
    await exam.save();

    logger.info(`[Exam] Unassigned student successfully. Updated exam stats: studentCount=${studentCount}, passCount=${passCount}, failCount=${failCount}`);
    return { success: true };
  }

  static async updateStudentResult(
    ownerId: string | string[],
    examId: string,
    studentId: string,
    overallResult: "Đậu" | "Trượt" | "Chưa có",
    branchId?: string
  ): Promise<{ success: boolean }> {
    logger.info(`[Exam] Updating student result: studentId=${studentId}, examId=${examId}, overallResult=${overallResult}`);

    // Check if the exam exists
    const examQuery: Record<string, unknown> = { _id: examId };
    if (ownerId !== "ALL") {
      examQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) examQuery.branchId = branchId;
    const exam = await Exam.findOne(examQuery);
    if (!exam) {
      logger.warn(`[Exam] Update student result failed - Exam not found: id=${examId}, ownerId=${ownerId}`);
      throw new Error("Kỳ thi không tồn tại.");
    }
    await assertExamReadyToGrade(exam, ownerId, branchId);

    // Kỳ thi theo lớp lưu người dự thi ở exam.results; kỳ thi cũ có thể lưu ở student.examId.
    const studentQuery: Record<string, unknown> = { _id: studentId };
    if (ownerId !== "ALL") {
      studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) studentQuery.branchId = branchId;
    const student = await Student.findOne(studentQuery);
    const belongsToExam = Boolean(
      student && (
        (exam.results || []).some((result) => String(result.studentId) === String(studentId))
        || student.examId === examId
        || student.exams?.some((item) => item.id === examId)
      )
    );
    if (!student || !belongsToExam) {
      logger.warn(`[Exam] Update student result failed - Student not found or not assigned: studentId=${studentId}, examId=${examId}`);
      throw new Error("Học viên không thuộc kỳ thi này hoặc không tồn tại.");
    }

    const examStatus: "Sắp thi" | "Đã thi" = overallResult === "Chưa có" ? "Sắp thi" : "Đã thi";
    const batch = exam.batchId ? await Batch.findOne({ _id: exam.batchId }).select("courseId").lean() : null;
    const courseCompletion = overallResult === "Đậu" && batch?.courseId ? { $addToSet: { completedCourseIds: batch.courseId } } : {};

    const hasExamEntry = student.exams?.some((item) => item.id === examId);
    const examDate = exam.officialDate || exam.tentativeDate;
    if (hasExamEntry) {
      await Student.updateOne(
        { _id: studentId, "exams.id": examId },
        {
          $set: {
            examId,
            examName: exam.name,
            examDate,
            "exams.$.status": examStatus,
            "exams.$.result.overall": overallResult,
          },
          ...courseCompletion,
        }
      );
    } else {
      await Student.updateOne(
        { _id: studentId },
        {
          $set: { examId, examName: exam.name, examDate },
          ...courseCompletion,
          $push: {
            exams: {
              id: String(exam._id), name: exam.name, date: examDate, type: "Tốt nghiệp", status: examStatus,
              batchId: exam.batchId || "", result: { theory: 0, practice: 0, simulation: 0, overall: overallResult },
            },
          },
        }
      );
    }

    if (overallResult === "Trượt" && exam.batchId) {
      await queueRetakeAfterFailedExam(ownerId, branchId, exam.batchId, studentId, String(exam._id));
    }

    // Recalculate exam stats
    const passCount = await Student.countDocuments({
      examId,
      exams: {
        $elemMatch: {
          id: examId,
          "result.overall": "Đậu"
        }
      }
    });
    const failCount = await Student.countDocuments({
      examId,
      exams: {
        $elemMatch: {
          id: examId,
          "result.overall": "Trượt"
        }
      }
    });

    const examResult = exam.results?.find((result) => String(result.studentId) === String(studentId));
    if (examResult) examResult.outcome = overallResult;
    const complete = Boolean(exam.results?.length) && (exam.results || []).every((result) => isExamResultComplete(result));
    if (complete) exam.status = "Đã hoàn thành";
    exam.passCount = passCount;
    exam.failCount = failCount;
    await exam.save();
    if (complete && exam.batchId) await closeBatchAfterExamIfReady(ownerId, String(exam.batchId), branchId);

    logger.info(`[Exam] Updated student result successfully. Exam stats: passCount=${passCount}, failCount=${failCount}`);
    return { success: true };
  }

  static async importResults(
    ownerId: string | string[],
    examId: string,
    results: ImportResultItem[],
    preview: boolean = false,
    branchId?: string
  ): Promise<{
    success: boolean;
    successCount?: number;
    failedCount?: number;
    errors?: string[];
    valid?: ValidImportPreview[];
    invalid?: InvalidImportPreview[];
  }> {
    logger.info(`[Exam] Importing ${results.length} results for examId=${examId}, ownerId=${ownerId}, preview=${preview}`);

    // Check if the exam exists
    const examQuery: Record<string, unknown> = { _id: examId };
    if (ownerId !== "ALL") {
      examQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
    }
    if (branchId) examQuery.branchId = branchId;
    const exam = await Exam.findOne(examQuery);
    if (!exam) {
      logger.warn(`[Exam] Import results failed - Exam not found: id=${examId}, ownerId=${ownerId}`);
      throw new Error("Kỳ thi không tồn tại.");
    }
    if (!preview) await assertExamReadyToGrade(exam, ownerId, branchId);
    const batchCourseId = exam.batchId ? (await Batch.findOne({ _id: exam.batchId }).select("courseId").lean())?.courseId || "" : "";

    const businessType = "general";

    const validList: ValidImportPreview[] = [];
    const invalidList: InvalidImportPreview[] = [];

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Loop through results and process each student
    for (const item of results) {
      try {
        const { phone, overallResult, theory = 0, practice = 0, simulation = 0 } = item;

        const cleanPhone = phone.trim().replace(/[\s.-]/g, '');
        const phoneVariants = [cleanPhone];
        if (/^[1-9]\d{8}$/.test(cleanPhone)) {
          phoneVariants.push('0' + cleanPhone);
        } else if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
          phoneVariants.push(cleanPhone.slice(1));
        }
        if (cleanPhone.startsWith('84') && cleanPhone.length === 11) {
          const raw = '0' + cleanPhone.slice(2);
          phoneVariants.push(raw);
          phoneVariants.push(cleanPhone.slice(2));
        }
        if (cleanPhone.startsWith('+84')) {
          const raw = '0' + cleanPhone.slice(3);
          phoneVariants.push(raw);
          phoneVariants.push(cleanPhone.slice(3));
        }

        // Find the student by phone and ownerId (independent of examId to support auto-assignment)
        const studentQuery: Record<string, unknown> = { phone: { $in: phoneVariants } };
        if (ownerId !== "ALL") {
          studentQuery.ownerId = Array.isArray(ownerId) ? { $in: ownerId } : ownerId;
        }
        if (branchId) studentQuery.branchId = branchId;

        const student = await Student.findOne(studentQuery);
        if (!student) {
          const reason = `SĐT không tồn tại trên hệ thống.`;
          invalidList.push({ phone, fullName: item.fullName || 'Chưa rõ', reason });
          errors.push(`Học viên có SĐT ${phone} không tồn tại trên hệ thống.`);
          failedCount++;
          continue;
        }

        // 1. Check tuition completion (Must be fully paid)
        const totalFee = parseInt(String(student.fee || "0").replace(/\D/g, ""), 10) || 0;
        const paidAmount = student.paidAmount || 0;
        const isFullyPaid = paidAmount >= totalFee;
        if (!isFullyPaid) {
          const reason = `Chưa hoàn thành học phí (Đã đóng: ${paidAmount.toLocaleString('vi-VN')}đ / Học phí: ${totalFee.toLocaleString('vi-VN')}đ).`;
          invalidList.push({ phone, fullName: student.fullName, reason });
          errors.push(`Học viên ${student.fullName} (SĐT ${phone}) ${reason}`);
          failedCount++;
          continue;
        }

        // 2. Check Rank suitability
        const eligibleRank = isStudentEligibleForExamRank(businessType, exam.rank, student.rank);
        if (!eligibleRank) {
          const reason = `Hạng bằng (${student.rank || "N/A"}) không phù hợp với đợt thi hạng ${exam.rank || "N/A"}.`;
          invalidList.push({ phone, fullName: student.fullName, reason });
          errors.push(`Học viên ${student.fullName} (SĐT ${phone}) ${reason}`);
          failedCount++;
          continue;
        }

        // 3. Check if student is assigned to another exam
        if (student.examId && student.examId !== examId) {
          const reason = `Đang tham gia đợt thi khác (${student.examName || "Chưa rõ tên"}).`;
          invalidList.push({ phone, fullName: student.fullName, reason });
          errors.push(`Học viên ${student.fullName} (SĐT ${phone}) ${reason}`);
          failedCount++;
          continue;
        }

        if (preview) {
          validList.push({
            phone,
            fullName: student.fullName,
            rank: student.rank,
            overallResult,
            theory,
            practice,
            simulation
          });
          continue;
        }

        const examResult = exam.results?.find((result) => String(result.studentId) === String(student._id));
        if (examResult) examResult.outcome = overallResult;
        const examStatus: "Sắp thi" | "Đã thi" = overallResult === "Chưa có" ? "Sắp thi" : "Đã thi";
        const courseCompletion = overallResult === "Đậu" && batchCourseId ? { $addToSet: { completedCourseIds: batchCourseId } } : {};

        // Check if student already has this exam entry in history
        const hasExamEntry = student.exams?.some((e) => e.id === examId);

        if (hasExamEntry) {
          await Student.updateOne(
            { _id: student._id, "exams.id": examId },
            {
              $set: {
                examId: exam._id.toString(),
                examName: exam.name,
                examDate: exam.tentativeDate,
                "exams.$.status": examStatus,
                "exams.$.result.theory": theory,
                "exams.$.result.practice": practice,
                "exams.$.result.simulation": simulation,
                "exams.$.result.overall": overallResult,
              },
              ...courseCompletion,
            }
          );
        } else {
          await Student.updateOne(
            { _id: student._id },
            {
              $set: {
                examId: exam._id.toString(),
                examName: exam.name,
                examDate: exam.tentativeDate,
              },
              ...courseCompletion,
              $push: {
                exams: {
                  id: exam._id.toString(),
                  name: exam.name,
                  date: exam.tentativeDate,
                  type: "Sát hạch",
                  status: examStatus,
                  result: {
                    theory,
                    practice,
                    simulation,
                    overall: overallResult
                  }
                }
              }
            }
          );
        }

        if (overallResult === "Trượt" && exam.batchId) {
          await queueRetakeAfterFailedExam(ownerId, branchId, exam.batchId, String(student._id), String(exam._id));
        }

        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        errors.push(`Lỗi xử lý SĐT ${item.phone}: ${msg}`);
        failedCount++;
      }
    }

    if (preview) {
      return {
        success: true,
        valid: validList,
        invalid: invalidList
      };
    }

    // Recalculate stats for the exam
    const studentCount = await Student.countDocuments({ examId });
    const passCount = await Student.countDocuments({
      examId,
      exams: {
        $elemMatch: {
          id: examId,
          "result.overall": "Đậu"
        }
      }
    });
    const failCount = await Student.countDocuments({
      examId,
      exams: {
        $elemMatch: {
          id: examId,
          "result.overall": "Trượt"
        }
      }
    });

    exam.studentCount = studentCount;
    exam.passCount = passCount;
    exam.failCount = failCount;
    const complete = Boolean(exam.results?.length) && (exam.results || []).every((result) => isExamResultComplete(result));
    if (complete) exam.status = "Đã hoàn thành";
    await exam.save();
    if (complete && exam.batchId) await closeBatchAfterExamIfReady(ownerId, String(exam.batchId), branchId);

    logger.info(`[Exam] Finished importing results. Success: ${successCount}, Failed: ${failedCount}, studentCount=${studentCount}, passCount=${passCount}, failCount=${failCount}`);

    return {
      success: true,
      successCount,
      failedCount,
      errors
    };
  }
}
