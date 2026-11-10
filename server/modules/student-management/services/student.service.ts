import { Types } from "mongoose";
import { logger } from "../config/logger";
import { IStudent, StudentStatus } from "../interfaces/student.interface";
import { Student, slugify } from "../models/student.model";
import { Payment } from "../models/payment.model";
import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
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
import { BatchService } from "./batch.service";
import { BranchModel } from "../../../model/branch.model";
import { resolveOwnerFilter } from "../utils/auth.util";
import { parsePaymentDate } from "../utils/payment-date.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";
import { customFieldResourceService } from "./custom-field-resource.service";

interface StudentFilters {
  page?: number | string;
  limit?: number | string;
  status?: string;
  rank?: string;
  search?: string;
  /** superadmin only: scope data to a specific center (admin uid) */
  ownerFilter?: string;
}

interface StudentCreateData {
  phone: string;
  [key: string]: unknown;
}

interface StudentUpdateData {
  [key: string]: unknown;
}

interface BulkStudentInput {
  sourceRow?: number;
  fullName?: string;
  phone?: string;
  rank?: string;
  birthday?: string;
  idCard?: string;
  email?: string;
  referral?: string;
  address?: string;
  registrationDate?: string;
  enrollmentDate?: string;
  fee?: string;
  feeProvided?: boolean;
  status?: string;
  paidAmount?: string | number;
  batchCode?: string;
}

export interface BulkStudentValidationError {
  index: number;
  row: number;
  name: string;
  phone: string;
  reason: string;
}

export interface StudentDeletionImpactItem {
  studentId: string;
  name: string;
  reasons: Array<{ key: string; label: string; count: number; details?: string[] }>;
}

export interface StudentDeletionImpact {
  items: StudentDeletionImpactItem[];
  deletableIds: string[];
  blockedIds: string[];
}

function normalizeIdCard(idCard: string): string {
  return String(idCard || "").replace(/\D/g, "");
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function normalizeBatchCode(code: unknown): string {
  return String(code || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN");
}

function isValidImportPhone(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(phone);
}

function isValidImportEmail(email: string): boolean {
  return /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email);
}

function parseImportAmount(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return 0;
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;

  const normalized = String(value)
    .trim()
    .replace(/(?:vnđ|vnd|₫|đ)/gi, "")
    .replace(/\s/g, "");
  if (!/^\d+$/.test(normalized) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(normalized)) return null;

  const amount = Number(normalized.replace(/[.,]/g, ""));
  return Number.isSafeInteger(amount) ? amount : null;
}

async function loadBulkImportBatches(ownerId: string | string[], branchId: string | undefined, studentsData: BulkStudentInput[]) {
  if (!studentsData.some((student) => normalizeBatchCode(student.batchCode))) return new Map();

  const ownerQuery = buildOwnerScopeQuery(ownerId);
  const batches = await Batch.find({ ...ownerQuery, ...buildBranchScopeQuery(branchId) })
    .select("code ownerId branchId startDate status daysOfWeek learnerIds quota courseId roadmapId");
  const courseIds = [...new Set(batches.map((batch) => String(batch.courseId)).filter(Boolean))];
  const courseQuery: Record<string, unknown> = { _id: { $in: courseIds }, ...ownerQuery };
  if (branchId) {
    // Batch creation allows a branch to use a course owned by the center with
    // no branch assignment, so include those courses when resolving capacity.
    courseQuery.$or = [{ branchId }, { branchId: null }, { branchId: "" }];
  }
  const courses = courseIds.length
    ? await Course.find(courseQuery).select("_id maxLearners").lean()
    : [];
  const coursesById = new Map(courses.map((course) => [String(course._id), course]));

  return new Map(batches.map((batch) => {
    const course = coursesById.get(String(batch.courseId));
    const quota = Number(batch.quota) > 0 ? Number(batch.quota) : Number(course?.maxLearners || 0);
    return [normalizeBatchCode(batch.code), { batch, quota }] as const;
  }));
}

function normalizeFee(fee: unknown): string {
  const raw = String(fee || "").trim();
  return raw || "0";
}

function buildOwnerScopeQuery(ownerId: string | string[]) {
  if (ownerId === "ALL") {
    return {};
  }

  return {
    ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId,
  };
}

export function buildBranchScopeQuery(branchId?: string) {
  return branchId ? { branchId } : {};
}
export function buildUnassignedBranchScopeQuery() {
  return {
    $or: [
      { branchId: { $exists: false } },
      { branchId: null },
      { branchId: "" },
    ],
  };
}

export function buildAssignableBranchQuery(branchId: string, companyCode: string) {
  return { _id: branchId, companyCode: companyCode.toUpperCase(), isActive: true };
}

async function ensureUniqueFieldsInScope(
  ownerScope: string | string[],
  data: StudentUpdateData,
  branchId?: string,
  excludeId?: string
) {
  const checks: Array<{ field: "email" | "phone"; value: string; message: string }> = [
    {
      field: "email",
      value: normalizeEmail(String(data.email || "")),
      message: "Email này đã tồn tại trong trung tâm hiện tại. Vui lòng kiểm tra lại!",
    },
    {
      field: "phone",
      value: normalizePhone(String(data.phone || "")),
      message: "Số điện thoại này đã tồn tại trong trung tâm hiện tại. Vui lòng kiểm tra lại!",
    },
  ];

  for (const check of checks) {
    if (!check.value) {
      continue;
    }

    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(ownerScope),
      ...buildBranchScopeQuery(branchId),
      [check.field]: check.value,
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Student.findOne(query).select("_id");
    if (existing) {
      throw new Error(check.message);
    }
  }
}

export class StudentService {
  static customFieldWrites = customFieldWriteService;

  static async createStudent(
    ownerId: string,
    ownerScope: string | string[],
    data: StudentCreateData,
    context?: CustomFieldWriteContext,
    creator?: { uid: string; name?: string },
  ): Promise<IStudent> {
    logger.info(`[Student] Creating student for ownerId=${ownerId}, phone=${data.phone}`);

    const writeData = context
      ? await this.customFieldWrites.prepareCreate(context, data)
      : data;

    const normalizedPayload = {
      ...writeData,
      email: typeof writeData.email === "string" ? normalizeEmail(writeData.email) : writeData.email,
      phone: normalizePhone(String(writeData.phone ?? "")),
      idCard: typeof writeData.idCard === "string" ? normalizeIdCard(writeData.idCard) : writeData.idCard,
      fee: normalizeFee(writeData.fee),
      tuitionWaived: false,
      courseId: typeof writeData.courseId === "string" ? writeData.courseId.trim() : writeData.courseId,
    };

    const branchId = typeof writeData.branchId === "string" ? writeData.branchId : undefined;
    await ensureUniqueFieldsInScope(ownerScope, normalizedPayload, branchId);

    const student = new Student({
      ...normalizedPayload,
      ownerId,
      // Gán sau payload để client không giả mạo được người thêm qua body
      createdBy: creator?.uid || "",
      createdByName: creator?.name || "",
    });
    const savedStudent = await student.save();
    if (context) await customFieldResourceService.finalizeEntity(context, savedStudent);
    logger.info(`[Student] Student created successfully: id=${savedStudent._id}, phone=${savedStudent.phone}`);
    return savedStudent;
  }

  static async getStudents(ownerId: string | string[], filters: StudentFilters, branchId?: string) {
    logger.info(`[Student] Fetching students list for ownerId=${ownerId} with filters: ${JSON.stringify(filters)}`);
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    // superadmin scope override: if ownerFilter provided, resolve to that center's userIds
    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(resolvedOwnerId),
      ...buildBranchScopeQuery(branchId),
    };

    if (filters.status) {
      if (typeof filters.status === "string" && filters.status.includes(",")) {
        query.status = { $in: filters.status.split(",") };
      } else {
        query.status = filters.status;
      }
    }
    if (filters.rank) query.rank = filters.rank;
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      query.$or = [{ fullName: searchRegex }, { phone: searchRegex }];
    }

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    logger.info(`[Student] Fetched ${students.length} students (total=${total}) for ownerId=${ownerId}`);
    return {
      students,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getUnassignedStudents(ownerId: string | string[], filters: StudentFilters) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(ownerId),
      ...buildUnassignedBranchScopeQuery(),
    };
    if (filters.status) query.status = filters.status;
    if (filters.rank) query.rank = filters.rank;
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      query.$and = [{ $or: [{ fullName: searchRegex }, { phone: searchRegex }] }];
    }
    const total = await Student.countDocuments(query);
    const students = await Student.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit);
    return { students, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async assignUnassignedStudentBranch(
    ownerId: string | string[],
    studentId: string,
    branchId: string,
    companyCode: string,
  ): Promise<IStudent | null> {
    const branch = await BranchModel.findOne(buildAssignableBranchQuery(branchId, companyCode)).select("_id").lean();
    if (!branch) return null;
    return Student.findOneAndUpdate(
      { _id: studentId, ...buildOwnerScopeQuery(ownerId), ...buildUnassignedBranchScopeQuery() },
      { $set: { branchId: String(branch._id) }, $inc: { __v: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
  }
  static async getStudentById(ownerId: string | string[], id: string, branchId?: string): Promise<IStudent | null> {
    logger.info(`[Student] Fetching student detail: id=${id}, ownerId=${ownerId}`);
    const query: Record<string, unknown> = {
      _id: id,
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    return await Student.findOne(query);
  }

  static async updateStudent(
    ownerId: string | string[],
    ownerScope: string | string[],
    id: string,
    data: StudentUpdateData,
    context: CustomFieldWriteContext,
    branchId?: string,
  ): Promise<IStudent | null> {
    logger.info(`[Student] Updating student: id=${id}, ownerId=${ownerId}`);

    const query: Record<string, unknown> = {
      _id: id,
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const existingStudent = await Student.findOne(query);
    if (!existingStudent) return null;

    const expectedVersion = expectedVersionOf(data);
    const targetContext = context.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(existingStudent.ownerId) } : context;
    const writeData = await this.customFieldWrites.prepareUpdate(targetContext, existingStudent, data);

    if (writeData.fullName) {
      writeData.slug = slugify(String(writeData.fullName));
    }
    if (typeof writeData.idCard === "string") {
      writeData.idCard = normalizeIdCard(writeData.idCard);
    }
    if (typeof writeData.email === "string") {
      writeData.email = normalizeEmail(writeData.email);
    }
    if (typeof writeData.phone === "string") {
      writeData.phone = normalizePhone(writeData.phone);
    }
    if (typeof writeData.fee !== "undefined") {
      writeData.fee = normalizeFee(writeData.fee);
      // A manually edited fee is no longer the explicit free-tuition marker from Excel.
      writeData.tuitionWaived = false;
    }
    if (typeof writeData.courseId === "string") {
      writeData.courseId = writeData.courseId.trim();
    }

    await ensureUniqueFieldsInScope(ownerScope, writeData, branchId, id);

    if (writeData.paymentHistory && Array.isArray(writeData.paymentHistory)) {
      const history = writeData.paymentHistory as Record<string, unknown>[];
      writeData.paidAmount = history.reduce((sum: number, item) => sum + (Number(item?.amount) || 0), 0);
    }

    const updatedStudent = await Student.findOneAndUpdate(
      { ...query, ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
      { $set: writeData, $inc: { __v: 1 } },
      { returnDocument: 'after', runValidators: true }
    );
    if (!updatedStudent) throw new CustomFieldWriteConflictError();
    await customFieldResourceService.finalizeEntity(targetContext, updatedStudent);

    if (writeData.paymentHistory && Array.isArray(writeData.paymentHistory)) {
      try {
        const oldHistory = existingStudent.paymentHistory || [];
        const newHistory = writeData.paymentHistory as Record<string, unknown>[];
        const studentOwnerId = existingStudent.ownerId;

        for (const oldItem of oldHistory) {
          const stillExists = newHistory.some((newItem) => String(newItem.id) === String(oldItem.id));
          if (!stillExists) {
            await Payment.deleteOne({ _id: oldItem.id, ownerId: studentOwnerId });
          }
        }

        for (const newItem of newHistory) {
          const oldItem = oldHistory.find((item) => String(item.id) === String(newItem.id));
          if (!oldItem) continue;
          const amountChanged = Number(newItem.amount) !== Number(oldItem.amount);
          const dateChanged = String(newItem.date) !== String(oldItem.date);
          const noteChanged = String(newItem.note || "") !== String(oldItem.note || "");
          if (amountChanged || dateChanged || noteChanged) {
            await Payment.updateOne(
              { _id: newItem.id as string, ownerId: studentOwnerId },
              { $set: {
                amount: Number(newItem.amount),
                date: newItem.date,
                paidOn: parsePaymentDate(newItem.date),
                note: newItem.note,
              } },
            );
          }
        }
      } catch (err) {
        logger.error(`[Student] Failed to sync paymentHistory changes with Payment collection: %o`, err);
      }
    }

    logger.info(`[Student] Student updated successfully: id=${id}`);
    return updatedStudent;
  }

  static async deleteStudent(ownerId: string | string[], id: string, branchId?: string): Promise<IStudent | null> {
    logger.info(`[Student] Deleting student: id=${id}, ownerId=${ownerId}`);
    const query: Record<string, unknown> = {
      _id: id,
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const student = await Student.findOne(query);
    if (!student) {
      logger.warn(`[Student] Student delete failed/not found: id=${id}, ownerId=${ownerId}`);
      return null;
    }

    await this.removeOperationalStudentData(ownerId, id, branchId);
    const deletedStudent = await Student.findOneAndDelete(query);
    logger.info(`[Student] Student deleted successfully: id=${id}; payment receipts retained`);
    return deletedStudent;
  }

  /** Remove operational records while retaining Payment receipts for financial reconciliation. */
  private static async removeOperationalStudentData(ownerId: string | string[], studentId: string, branchId?: string) {
    const scope = { ...buildOwnerScopeQuery(ownerId), ...buildBranchScopeQuery(branchId) };
    const studentScope = { studentId, ...scope };

    await Promise.all([
      Batch.updateMany({ ...scope, learnerIds: studentId }, { $pull: { learnerIds: studentId } }),
      Batch.updateMany({ ...scope, "attendanceSessions.records.studentId": studentId }, { $pull: { "attendanceSessions.$[].records": { studentId } } }),
      BatchMiniTest.updateMany({ ...scope, "results.studentId": studentId }, { $pull: { results: { studentId } } }),
      BatchEnrollment.deleteMany(studentScope),
      StudentBatchEnrollment.deleteMany(studentScope),
      StudentQualityRecord.deleteMany(studentScope),
      ClassWaitlistEntry.deleteMany(studentScope),
      StudentProgressionDecision.deleteMany(studentScope),
      StudentDeviceModel.deleteMany(studentScope),
      StudentVerificationCodeModel.deleteMany(studentScope),
      StudentAttendanceAttemptModel.deleteMany(studentScope),
      StudentFaceEnrollmentAuditModel.deleteMany(studentScope),
      // Submission has no tenant fields; student ids are globally unique.
      SubmissionModel.deleteMany({ studentId }),
    ]);

    const exams = await Exam.find({ ...scope, "results.studentId": studentId });
    await Promise.all(exams.map(async (exam) => {
      exam.results = exam.results.filter((result) => result.studentId !== studentId);
      exam.studentCount = exam.results.length;
      exam.passCount = exam.results.filter((result) => result.outcome === "Đậu").length;
      exam.failCount = exam.results.filter((result) => result.outcome === "Trượt").length;
      await exam.save();
    }));
  }

  static async getDeletionImpact(ownerId: string | string[], ids: string[], branchId?: string): Promise<StudentDeletionImpact> {
    const validIds = ids.filter(id => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return { items: [], deletableIds: [], blockedIds: [] };

    const query: Record<string, unknown> = {
      _id: { $in: validIds },
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const students = await Student.find(query).select("_id fullName paymentHistory exams");
    const resolvedIds = students.map(student => student._id.toString());
    if (resolvedIds.length === 0) return { items: [], deletableIds: [], blockedIds: [] };

    const [payments, batches, exams, miniTests, enrollments, canonicalEnrollments, submissions, qualityRecords, waitlistEntries, progressionDecisions, devices, verificationCodes, attendanceAttempts, faceAudits] = await Promise.all([
      Payment.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      Batch.find({ $or: [{ learnerIds: { $in: resolvedIds } }, { "attendanceSessions.records.studentId": { $in: resolvedIds } }] }).select("code name learnerIds attendanceSessions.records.studentId"),
      Exam.find({ "results.studentId": { $in: resolvedIds } }).select("name results.studentId"),
      BatchMiniTest.find({ "results.studentId": { $in: resolvedIds } }).select("title results.studentId"),
      BatchEnrollment.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentBatchEnrollment.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      SubmissionModel.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentQualityRecord.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      ClassWaitlistEntry.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentProgressionDecision.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentDeviceModel.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentVerificationCodeModel.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentAttendanceAttemptModel.find({ studentId: { $in: resolvedIds } }).select("studentId"),
      StudentFaceEnrollmentAuditModel.find({ studentId: { $in: resolvedIds } }).select("studentId"),
    ]);

    const items: StudentDeletionImpactItem[] = students.map(student => ({ studentId: student._id.toString(), name: student.fullName, reasons: [] }));
    const byId = new Map(items.map(item => [item.studentId, item]));
    const add = (studentId: string, key: string, label: string, detail?: string) => {
      const item = byId.get(studentId);
      if (!item) return;
      let reason = item.reasons.find(entry => entry.key === key);
      if (!reason) {
        reason = { key, label, count: 0, details: detail ? [] : undefined };
        item.reasons.push(reason);
      }
      reason.count++;
      if (detail && reason.details && !reason.details.includes(detail)) reason.details.push(detail);
    };
    const addDirect = (records: Array<{ studentId?: unknown }>, key: string, label: string) => {
      records.forEach(record => add(String(record.studentId || ""), key, label));
    };

    students.forEach(student => {
      const id = student._id.toString();
      (student.paymentHistory || []).forEach(() => add(id, "payment-history", "lịch sử thanh toán"));
      (student.exams || []).forEach(() => add(id, "student-exams", "lịch sử kỳ thi"));
    });
    addDirect(payments as Array<{ studentId?: unknown }>, "payments", "phiếu thu/hóa đơn");
    addDirect(enrollments as Array<{ studentId?: unknown }>, "enrollments", "đăng ký và lịch sử lớp");
    addDirect(canonicalEnrollments as Array<{ studentId?: unknown }>, "canonical-enrollments", "sổ buổi học");
    addDirect(submissions as Array<{ studentId?: unknown }>, "submissions", "bài nộp");
    addDirect(qualityRecords as Array<{ studentId?: unknown }>, "quality", "đánh giá chất lượng");
    addDirect(waitlistEntries as Array<{ studentId?: unknown }>, "waitlist", "danh sách chờ lớp");
    addDirect(progressionDecisions as Array<{ studentId?: unknown }>, "progression", "lộ trình học tập");
    addDirect(devices as Array<{ studentId?: unknown }>, "devices", "thiết bị đăng nhập");
    addDirect(verificationCodes as Array<{ studentId?: unknown }>, "verification", "mã xác thực điểm danh");
    addDirect(attendanceAttempts as Array<{ studentId?: unknown }>, "attendance-attempts", "lịch sử điểm danh");
    addDirect(faceAudits as Array<{ studentId?: unknown }>, "face-audits", "lịch sử nhận diện khuôn mặt");

    batches.forEach(batch => {
      const detail = batch.code || batch.name || String(batch._id);
      resolvedIds.forEach(studentId => {
        if ((batch.learnerIds || []).includes(studentId)) add(studentId, "classes", "lớp học", detail);
        const attendanceCount = (batch.attendanceSessions || []).filter(session => (session.records || []).some(record => record.studentId === studentId)).length;
        for (let index = 0; index < attendanceCount; index++) add(studentId, "attendance", "buổi điểm danh", detail);
      });
    });
    exams.forEach(exam => (exam.results || []).forEach(result => {
      if (resolvedIds.includes(result.studentId)) add(result.studentId, "exam-results", "kết quả thi", exam.name);
    }));
    miniTests.forEach(test => (test.results || []).forEach(result => {
      if (resolvedIds.includes(result.studentId)) add(result.studentId, "mini-tests", "bài kiểm tra", test.title);
    }));

    // Related operational data is cleaned up on deletion. Payment receipts are retained,
    // so references must inform the UI but must not block deleting the student.
    return { items, deletableIds: resolvedIds, blockedIds: [] };
  }

  static async bulkDeleteStudents(ownerId: string | string[], ids: string[], branchId?: string): Promise<{ deletedCount: number; deletedIds: string[]; blocked: StudentDeletionImpactItem[] }> {
    const impact = await this.getDeletionImpact(ownerId, ids, branchId);
    const deletedIds: string[] = [];
    for (const id of impact.deletableIds) {
      const deleted = await this.deleteStudent(ownerId, id, branchId);
      if (deleted) deletedIds.push(id);
    }
    return { deletedCount: deletedIds.length, deletedIds, blocked: [] };
  }

  static async bulkCreateStudents(creatorId: string, ownerId: string | string[], studentsData: BulkStudentInput[], targetOwnerId?: string, branchId?: string, creatorName?: string) {
    logger.info(`[Student] Bulk importing ${studentsData.length} students: creatorId=${creatorId}, ownerId=${ownerId}, targetOwnerId=${targetOwnerId}`);

    if (branchId && !targetOwnerId) {
      throw new Error("Không thể xác định chủ sở hữu thuộc chi nhánh đã chọn.");
    }

    const businessType: string = "general";

    let importedCount = 0;
    let skippedCount = 0;
    const errors: { row: number; name: string; phone: string; reason: string }[] = [];
    const validStudents: Partial<IStudent>[] = [];
    const acceptedInputs: BulkStudentInput[] = [];
    const tuitionUpdates: Array<{ id: string; phone: string; fee: string; tuitionWaived: boolean }> = [];
    const importedPayments: Array<{
      _id: Types.ObjectId;
      studentId: string;
      studentName: string;
      amount: number;
      method: "Chuyển khoản";
      date: string;
      paidOn?: Date;
      note: string;
      ownerId: string;
      branchId?: string;
    }> = [];

    const seenPhonesInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();
    const plannedBatchAdds = new Map<string, number>();

    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const existingStudents = await Student.find(query).select("_id phone email paidAmount");
    const existingPhones = new Set(existingStudents.map((s) => normalizePhone(s.phone)));
    const existingEmails = new Set(existingStudents.map((s) => normalizeEmail(s.email || "")).filter(Boolean));
    const existingStudentsByPhone = new Map(existingStudents.map((student) => [normalizePhone(student.phone), student]));

    const batchesByCode = await loadBulkImportBatches(ownerId, branchId, studentsData);

    for (let i = 0; i < studentsData.length; i++) {
      const rowNum = Number.isInteger(studentsData[i]?.sourceRow) && Number(studentsData[i]?.sourceRow) > 0
        ? Number(studentsData[i].sourceRow)
        : i + 1;
      const data = studentsData[i];
      const fullName = String(data.fullName || "").trim();
      const phone = normalizePhone(String(data.phone || ""));
      const rank = String(data.rank || "").trim().toUpperCase();
      const batchCode = normalizeBatchCode(data.batchCode);

      const birthday = String(data.birthday || "").trim();
      const idCard = normalizeIdCard(String(data.idCard || ""));
      const email = normalizeEmail(String(data.email || ""));
      const referral = String(data.referral || "").trim();
      const address = String(data.address || "").trim();
      const fee = String(data.fee || "0").trim();
      const registrationDate = String(data.registrationDate || new Date().toLocaleDateString("vi-VN")).trim();
      const enrollmentDate = String(data.enrollmentDate || "").trim();
      const defaultStatus = businessType === "driving" ? "Chờ KSK" : "Đang học";
      const status = String(data.status || defaultStatus).trim();

      const feeNum = parseImportAmount(fee);
      const paidAmount = parseImportAmount(data.paidAmount);
      const existingStudent = existingStudentsByPhone.get(phone);
      const isTuitionUpdate = Boolean(data.feeProvided && existingStudent);
      const rowErrors: string[] = [];

      if (!fullName) rowErrors.push("Họ và tên không được để trống.");
      if (!phone) rowErrors.push("Số điện thoại không được để trống.");
      else if (!isValidImportPhone(phone)) rowErrors.push("Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09).");
      else if (seenPhonesInBatch.has(phone)) rowErrors.push("Số điện thoại bị trùng lặp trong file import.");
      else if (existingPhones.has(phone) && !isTuitionUpdate) rowErrors.push("Số điện thoại đã tồn tại trong trung tâm hiện tại. Chỉ cập nhật học phí khi file có cột học phí và số điện thoại khớp.");

      if (!email && !isTuitionUpdate) rowErrors.push("Email không được để trống.");
      else if (email && !isValidImportEmail(email) && !isTuitionUpdate) rowErrors.push("Định dạng email không hợp lệ.");
      else if (email && seenEmailsInBatch.has(email) && !isTuitionUpdate) rowErrors.push("Email bị trùng lặp trong file import.");
      else if (email && existingEmails.has(email) && !isTuitionUpdate) rowErrors.push("Email đã tồn tại trong trung tâm hiện tại.");

      const importBatch = batchCode ? batchesByCode.get(batchCode) : undefined;
      if (!isTuitionUpdate && batchCode && !importBatch) {
        rowErrors.push(`Mã lớp "${String(data.batchCode || "").trim()}" không tồn tại trong chi nhánh hiện tại.`);
      }
      if (feeNum === null) rowErrors.push("Học phí phải là số nguyên không âm.");
      if (paidAmount === null) rowErrors.push("Số tiền đã đóng phải là số nguyên không âm.");
      if (isTuitionUpdate && feeNum !== null && feeNum < Number(existingStudent?.paidAmount || 0)) {
        rowErrors.push("Học phí mới không được thấp hơn số tiền học viên đã đóng.");
      }
      if (feeNum !== null && paidAmount !== null && paidAmount > feeNum) {
        rowErrors.push("Số tiền đã đóng không được vượt quá học phí.");
      }
      if (!isTuitionUpdate && importBatch && importBatch.quota > 0) {
        const plannedAdds = plannedBatchAdds.get(batchCode) || 0;
        if (importBatch.batch.learnerIds.length + plannedAdds >= importBatch.quota) {
          rowErrors.push(`Lớp đã đạt sĩ số tối đa (${importBatch.quota} học viên).`);
        }
      }

      if (rowErrors.length > 0) {
        for (const reason of rowErrors) errors.push({ row: rowNum, name: fullName, phone, reason });
        skippedCount++;
        continue;
      }

      const safeFee = feeNum ?? 0;
      const importedPaidAmount = paidAmount ?? 0;
      seenPhonesInBatch.add(phone);
      if (email && !isTuitionUpdate) seenEmailsInBatch.add(email);
      if (isTuitionUpdate && existingStudent) {
        tuitionUpdates.push({
          id: String(existingStudent._id),
          phone,
          fee: safeFee.toLocaleString("vi-VN"),
          tuitionWaived: safeFee === 0,
        });
        continue;
      }
      if (batchCode) plannedBatchAdds.set(batchCode, (plannedBatchAdds.get(batchCode) || 0) + 1);
      const studentId = new Types.ObjectId();
      const paymentId = importedPaidAmount > 0 ? new Types.ObjectId() : null;

      const paymentHistory: NonNullable<IStudent["paymentHistory"]> = [];
      if (paymentId) {
        paymentHistory.push({
          id: paymentId.toString(),
          amount: importedPaidAmount,
          date: registrationDate,
          method: "Chuyển khoản",
          note: "Nhập từ file Excel",
          recipient: "Hệ thống",
        });
        importedPayments.push({
          _id: paymentId,
          studentId: studentId.toString(),
          studentName: fullName,
          amount: importedPaidAmount,
          method: "Chuyển khoản",
          date: registrationDate,
          paidOn: parsePaymentDate(registrationDate) ?? undefined,
          note: "Nhập từ file Excel",
          ownerId: targetOwnerId || creatorId,
          branchId,
        });
      }

      validStudents.push({
        _id: studentId,
        fullName,
        slug: slugify(fullName),
        phone,
        email,
        referral,
        birthday,
        idCard,
        rank,
        registrationDate,
        enrollmentDate,
        fee: fee || safeFee.toLocaleString("vi-VN"),
        tuitionWaived: data.feeProvided === true && safeFee === 0,
        paidAmount: importedPaidAmount,
        paymentHistory,
        address,
        status: [status as StudentStatus],
        ownerId: targetOwnerId || creatorId,
        createdBy: creatorId,
        createdByName: creatorName || "",
        branchId,
      });
      acceptedInputs.push(data);

      existingPhones.add(phone);
    }

    if (validStudents.length > 0) {
      const results = await Student.insertMany(validStudents);
      if (importedPayments.length > 0) await Payment.insertMany(importedPayments);
      importedCount = results.length;
      logger.info(`[Student] Bulk import complete: imported ${importedCount} students, updated tuition for ${tuitionUpdates.length}, skipped ${skippedCount} rows`);

      // Link students to their respective batches/classes if batchCode is provided
      for (let j = 0; j < results.length; j++) {
        const savedStudent = results[j];
        const matchingInput = acceptedInputs[j];
        if (matchingInput?.batchCode) {
          const code = normalizeBatchCode(matchingInput.batchCode);
          if (code) {
            const importBatch = batchesByCode.get(code);
            if (importBatch) {
              const studentIdStr = savedStudent._id.toString();
              await BatchService.addLearner(
                ownerId,
                String(importBatch.batch._id),
                studentIdStr,
                "general",
                branchId,
                creatorId,
              );
              const importedEnrollmentDate = String(matchingInput.enrollmentDate || "").trim();
              if (importedEnrollmentDate) {
                await Student.updateOne(
                  { _id: savedStudent._id, ...query },
                  { $set: { enrollmentDate: importedEnrollmentDate } },
                );
              }
              logger.info(`[Student Import] Linked student ${savedStudent.fullName} (${studentIdStr}) to batch ${importBatch.batch.code}`);
            } else {
              logger.warn(`[Student Import] Batch with code ${code} not found for owner scope ${ownerId}`);
            }
          }
        }
      }
    }

    let updatedFeeCount = 0;
    if (tuitionUpdates.length > 0) {
      const result = await Student.bulkWrite(tuitionUpdates.map((update) => ({
        updateOne: {
          filter: { _id: update.id, phone: update.phone, ...query },
          update: { $set: { fee: update.fee, tuitionWaived: update.tuitionWaived } },
        },
      })));
      updatedFeeCount = result.matchedCount;
    }

    if (validStudents.length === 0 && tuitionUpdates.length === 0) {
      logger.info(`[Student] Bulk import complete: no valid students or tuition updates. Skipped ${skippedCount} rows`);
    }

    return {
      importedCount,
      updatedFeeCount,
      skippedCount,
      errors,
    };
  }

  static async previewBulkStudents(ownerId: string | string[], studentsData: BulkStudentInput[], branchId?: string) {
    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const existingStudents = await Student.find(query).select("_id phone email paidAmount");
    const existingPhones = new Set(existingStudents.map((student) => normalizePhone(student.phone)));
    const existingEmails = new Set(existingStudents.map((student) => normalizeEmail(student.email || "")).filter(Boolean));
    const existingStudentsByPhone = new Map(existingStudents.map((student) => [normalizePhone(student.phone), student]));
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const plannedBatchAdds = new Map<string, number>();
    const errors: BulkStudentValidationError[] = [];
    const feeUpdates: Array<{ index: number; row: number; name: string }> = [];
    const batchesByCode = await loadBulkImportBatches(ownerId, branchId, studentsData);

    const addError = (index: number, data: BulkStudentInput, reason: string) => {
      errors.push({
        index,
        row: Number.isInteger(data.sourceRow) && Number(data.sourceRow) > 0 ? Number(data.sourceRow) : index + 1,
        name: String(data.fullName || "").trim(),
        phone: normalizePhone(String(data.phone || "")),
        reason,
      });
    };

    studentsData.forEach((data, index) => {
      const phone = normalizePhone(String(data.phone || ""));
      const email = normalizeEmail(String(data.email || ""));
      const fullName = String(data.fullName || "").trim();
      const batchCode = normalizeBatchCode(data.batchCode);
      const existingStudent = existingStudentsByPhone.get(phone);
      const isTuitionUpdate = Boolean(data.feeProvided && existingStudent);
      const rowErrors: string[] = [];

      if (!fullName) rowErrors.push("Họ và tên không được để trống.");
      if (!phone) rowErrors.push("Số điện thoại không được để trống.");
      else if (!isValidImportPhone(phone)) rowErrors.push("Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09).");
      else if (seenPhones.has(phone)) rowErrors.push("Số điện thoại bị trùng lặp trong file import.");
      else if (existingPhones.has(phone) && !isTuitionUpdate) rowErrors.push("Số điện thoại đã tồn tại trong trung tâm hiện tại. Chỉ cập nhật học phí khi file có cột học phí và số điện thoại khớp.");

      if (!email && !isTuitionUpdate) rowErrors.push("Email không được để trống.");
      else if (email && !isValidImportEmail(email) && !isTuitionUpdate) rowErrors.push("Định dạng email không hợp lệ.");
      else if (email && seenEmails.has(email) && !isTuitionUpdate) rowErrors.push("Email bị trùng lặp trong file import.");
      else if (email && existingEmails.has(email) && !isTuitionUpdate) rowErrors.push("Email đã tồn tại trong trung tâm hiện tại.");

      const fee = parseImportAmount(data.fee);
      const paidAmount = parseImportAmount(data.paidAmount);
      if (fee === null) rowErrors.push("Học phí phải là số nguyên không âm.");
      if (paidAmount === null) rowErrors.push("Số tiền đã đóng phải là số nguyên không âm.");
      if (isTuitionUpdate && fee !== null && fee < Number(existingStudent?.paidAmount || 0)) rowErrors.push("Học phí mới không được thấp hơn số tiền học viên đã đóng.");
      if (fee !== null && paidAmount !== null && paidAmount > fee) rowErrors.push("Số tiền đã đóng không được vượt quá học phí.");

      const importBatch = !isTuitionUpdate && batchCode ? batchesByCode.get(batchCode) : undefined;
      if (!isTuitionUpdate && batchCode && !importBatch) rowErrors.push(`Mã lớp "${String(data.batchCode || "").trim()}" không tồn tại trong chi nhánh hiện tại.`);
      if (!isTuitionUpdate && importBatch && importBatch.quota > 0) {
        const plannedAdds = plannedBatchAdds.get(batchCode) || 0;
        if (importBatch.batch.learnerIds.length + plannedAdds >= importBatch.quota) {
          rowErrors.push(`Lớp đã đạt sĩ số tối đa (${importBatch.quota} học viên).`);
        }
      }

      for (const reason of rowErrors) addError(index, data, reason);
      if (rowErrors.length === 0) {
        seenPhones.add(phone);
        if (email && !isTuitionUpdate) seenEmails.add(email);
        if (isTuitionUpdate) feeUpdates.push({ index, row: Number(data.sourceRow) || index + 1, name: fullName });
        else if (batchCode) plannedBatchAdds.set(batchCode, (plannedBatchAdds.get(batchCode) || 0) + 1);
      }
    });

    return { errors, feeUpdates };
  }

  static async markInstallmentPaid(
    ownerId: string | string[],
    studentId: string,
    installmentNo: number,
    branchId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    logger.info(`[Student] Mark installment paid: studentId=${studentId}, installmentNo=${installmentNo}, ownerId=${ownerId}`);

    const query: Record<string, unknown> = {
      _id: studentId,
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };

    const student = await Student.findOne(query);
    if (!student) {
      logger.warn(`[Student] markInstallmentPaid: student not found, id=${studentId}`);
      return { success: false, error: "Không tìm thấy học viên." };
    }

    if (!student.installmentStatus || student.installmentStatus.length === 0) {
      return { success: false, error: "Học viên này chưa có lịch sử đợt thu học phí." };
    }

    type InstallmentEntry = {
      installmentNo: number;
      percent: number;
      amountDue: number;
      status: string;
      sentAt: string;
      paidAt: string;
      notificationId: string;
    };

    const entries = student.installmentStatus as InstallmentEntry[];
    const idx = entries.findIndex((s) => s.installmentNo === installmentNo);

    if (idx < 0) {
      return { success: false, error: `Không tìm thấy đợt ${installmentNo} cho học viên này.` };
    }

    entries[idx].status = "Đã thu";
    entries[idx].paidAt = new Date().toISOString();

    student.markModified("installmentStatus");
    await student.save();

    logger.info(`[Student] Installment ${installmentNo} marked as paid for student ${studentId}`);
    return { success: true };
  }

  static async getStudentByIdCard(idCard: string): Promise<IStudent | null> {
    logger.info(`[Student] Public lookup by idCard=${idCard}`);
    const normalizedIdCard = normalizeIdCard(idCard);
    if (!normalizedIdCard) {
      return null;
    }

    const flexibleDigitPattern = normalizedIdCard
      .split("")
      .map((digit) => `${digit}\\D*`)
      .join("");

    return Student.findOne({
      $or: [
        { idCard: normalizedIdCard },
        { idCard: idCard.trim() },
        { idCard: { $regex: `^\\D*${flexibleDigitPattern}$` } },
      ],
    });
  }
}
