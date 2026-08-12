import { Types } from "mongoose";
import { logger } from "../config/logger";
import { IStudent, StudentStatus } from "../interfaces/student.interface";
import { Student, slugify } from "../models/student.model";
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
import { getPlannedSessionCount, StudentBatchEnrollmentService } from "./student-batch-enrollment.service";
import { BranchModel } from "../../../model/branch.model";
import { resolveOwnerFilter } from "../utils/auth.util";
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
  const checks: Array<{ field: "email" | "phone" | "idCard"; value: string; message: string }> = [
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
    {
      field: "idCard",
      value: normalizeIdCard(String(data.idCard || "")),
      message: "CCCD/CMND này đã tồn tại trong trung tâm hiện tại. Vui lòng kiểm tra lại!",
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
      .sort({ createdAt: -1 })
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
    const students = await Student.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
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
      { new: true, runValidators: true },
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
      { new: true, runValidators: true }
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
              { $set: { amount: Number(newItem.amount), date: newItem.date, note: newItem.note } },
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
    const impact = await this.getDeletionImpact(ownerId, [id], branchId);
    const blocked = impact.items.find(item => item.studentId === id && item.reasons.length > 0);
    if (blocked) {
      const error = new Error(`Không thể xóa ${blocked.name} vì đang có ${blocked.reasons.map(reason => reason.label).join(", ")}.`);
      (error as Error & { status: number; code: string }).status = 409;
      (error as Error & { status: number; code: string }).code = "STUDENT_IN_USE";
      throw error;
    }
    const query: Record<string, unknown> = {
      _id: id,
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const deletedStudent = await Student.findOneAndDelete(query);
    if (deletedStudent) {
      logger.info(`[Student] Student deleted successfully: id=${id}`);
      try {
        await Payment.deleteMany({ studentId: id });
        await Batch.updateMany({ learnerIds: id }, { $pull: { learnerIds: id } });
      } catch (err) {
        logger.error(`[Student] Failed to clean up associated records for deleted student: %o`, err);
      }
    } else {
      logger.warn(`[Student] Student delete failed/not found: id=${id}, ownerId=${ownerId}`);
    }
    return deletedStudent;
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

    const deletableIds = items.filter(item => item.reasons.length === 0).map(item => item.studentId);
    const blockedIds = items.filter(item => item.reasons.length > 0).map(item => item.studentId);
    return { items, deletableIds, blockedIds };
  }

  static async bulkDeleteStudents(ownerId: string | string[], ids: string[], branchId?: string): Promise<{ deletedCount: number; deletedIds: string[]; blocked: StudentDeletionImpactItem[] }> {
    const impact = await this.getDeletionImpact(ownerId, ids, branchId);
    const resolvedIds = impact.deletableIds;
    const blocked = impact.items.filter(item => item.reasons.length > 0);
    if (resolvedIds.length === 0) return { deletedCount: 0, deletedIds: [], blocked };

    const result = await Student.deleteMany({
      _id: { $in: resolvedIds },
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    });
    return { deletedCount: result.deletedCount || 0, deletedIds: resolvedIds, blocked };
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

    const seenPhonesInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();
    const seenIdCardsInBatch = new Set<string>();

    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const existingStudents = await Student.find(query).select("phone email idCard");
    const existingPhones = new Set(existingStudents.map((s) => normalizePhone(s.phone)));
    const existingEmails = new Set(existingStudents.map((s) => normalizeEmail(s.email || "")).filter(Boolean));
    const existingIdCards = new Set(existingStudents.map((s) => normalizeIdCard(s.idCard || "")).filter(Boolean));

    // Chỉ truy vấn lớp khi file thực sự có cột/mã lớp. Nhập học viên thuần túy
    // không cần phụ thuộc vào collection lớp (và tránh một truy vấn không cần thiết).
    const hasBatchCode = studentsData.some((student) => Boolean(normalizeBatchCode(student.batchCode)));
    const availableBatches = hasBatchCode ? await Batch.find(query).select("code ownerId branchId startDate endDate daysOfWeek learnerIds") : [];
    const batchesByCode = new Map(availableBatches.map((batch) => [normalizeBatchCode(batch.code), batch]));

    for (let i = 0; i < studentsData.length; i++) {
      const rowNum = Number.isInteger(studentsData[i]?.sourceRow) && Number(studentsData[i]?.sourceRow) > 0
        ? Number(studentsData[i].sourceRow)
        : i + 1;
      const data = studentsData[i];
      const fullName = String(data.fullName || "").trim();
      const phone = normalizePhone(String(data.phone || ""));
      const rank = String(data.rank || "").trim().toUpperCase();
      const batchCode = normalizeBatchCode(data.batchCode);

      if (!fullName) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "Họ và tên không được để trống." });
        skippedCount++;
        continue;
      }
      if (!phone) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "Số điện thoại không được để trống." });
        skippedCount++;
        continue;
      }
      if (seenPhonesInBatch.has(phone)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "Số điện thoại bị trùng lặp trong file import." });
        skippedCount++;
        continue;
      }
      seenPhonesInBatch.add(phone);

      if (existingPhones.has(phone)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "Số điện thoại đã tồn tại trong trung tâm hiện tại." });
        skippedCount++;
        continue;
      }

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

      if (email && seenEmailsInBatch.has(email)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "Email bị trùng lặp trong file import." });
        skippedCount++;
        continue;
      }

      if (batchCode && !batchesByCode.has(batchCode)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: `Mã lớp "${String(data.batchCode || "").trim()}" không tồn tại trong chi nhánh hiện tại.` });
        skippedCount++;
        continue;
      }
      if (email) seenEmailsInBatch.add(email);

      if (email && existingEmails.has(email)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "Email đã tồn tại trong trung tâm hiện tại." });
        skippedCount++;
        continue;
      }

      if (idCard && seenIdCardsInBatch.has(idCard)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "CCCD/CMND bị trùng lặp trong file import." });
        skippedCount++;
        continue;
      }
      if (idCard) seenIdCardsInBatch.add(idCard);

      if (idCard && existingIdCards.has(idCard)) {
        errors.push({ row: rowNum, name: fullName, phone, reason: "CCCD/CMND đã tồn tại trong trung tâm hiện tại." });
        skippedCount++;
        continue;
      }

      const feeNum = parseInt(fee.replace(/\D/g, ""), 10) || 0;
      const paidAmount = parseInt(String(data.paidAmount || "0").replace(/\D/g, ""), 10) || 0;

      const paymentHistory: NonNullable<IStudent["paymentHistory"]> = [];
      if (paidAmount > 0) {
        paymentHistory.push({
          id: new Types.ObjectId().toString(),
          amount: Math.min(paidAmount, feeNum),
          date: registrationDate,
          method: "Chuyển khoản",
          note: "Nhập từ file Excel",
          recipient: "Hệ thống",
        });
      }

      validStudents.push({
        fullName,
        slug: slugify(fullName),
        phone,
        email: email || undefined,
        referral,
        birthday,
        idCard,
        rank,
        registrationDate,
        enrollmentDate,
        fee,
        paidAmount: Math.min(paidAmount, feeNum),
        paymentHistory,
        address,
        status: [status as StudentStatus],
        ownerId: targetOwnerId || creatorId,
        createdBy: creatorId,
        createdByName: creatorName || "",
        branchId,
      });

      existingPhones.add(phone);
    }

    if (validStudents.length > 0) {
      const results = await Student.insertMany(validStudents);
      importedCount = results.length;
      logger.info(`[Student] Bulk import complete: successfully imported ${importedCount} students, skipped ${skippedCount} students`);

      // Link students to their respective batches/classes if batchCode is provided
      for (let j = 0; j < results.length; j++) {
        const savedStudent = results[j];
        const matchingInput = studentsData.find(s => normalizePhone(s.phone || "") === normalizePhone(savedStudent.phone || ""));
        if (matchingInput && matchingInput.batchCode) {
          const code = normalizeBatchCode(matchingInput.batchCode);
          if (code) {
            const batch = batchesByCode.get(code);
            if (batch) {
              const studentIdStr = savedStudent._id.toString();
              if (!batch.learnerIds.includes(studentIdStr)) {
                batch.learnerIds.push(studentIdStr);
                await batch.save();
                await StudentBatchEnrollmentService.activate({
                  ownerId: String(batch.ownerId),
                  branchId: batch.branchId,
                  batchId: String(batch._id),
                  studentId: studentIdStr,
                  actorId: creatorId,
                  allowedSessions: getPlannedSessionCount(batch),
                });
                logger.info(`[Student Import] Linked student ${savedStudent.fullName} (${studentIdStr}) to batch ${batch.code}`);
              }
            } else {
              logger.warn(`[Student Import] Batch with code ${code} not found for owner scope ${ownerId}`);
            }
          }
        }
      }
    } else {
      logger.info(`[Student] Bulk import complete: no valid students to import. Skipped ${skippedCount} students`);
    }

    return {
      importedCount,
      skippedCount,
      errors,
    };
  }

  static async previewBulkStudents(ownerId: string | string[], studentsData: BulkStudentInput[], branchId?: string) {
    const query: Record<string, unknown> = {
      ...buildOwnerScopeQuery(ownerId),
      ...buildBranchScopeQuery(branchId),
    };
    const existingStudents = await Student.find(query).select("phone email idCard");
    const existingPhones = new Set(existingStudents.map((student) => normalizePhone(student.phone)));
    const existingEmails = new Set(existingStudents.map((student) => normalizeEmail(student.email || "")).filter(Boolean));
    const existingIdCards = new Set(existingStudents.map((student) => normalizeIdCard(student.idCard || "")).filter(Boolean));
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const seenIdCards = new Set<string>();
    const errors: BulkStudentValidationError[] = [];

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
      const idCard = normalizeIdCard(String(data.idCard || ""));

      if (phone) {
        if (seenPhones.has(phone)) addError(index, data, "Số điện thoại bị trùng lặp trong file import.");
        else if (existingPhones.has(phone)) addError(index, data, "Số điện thoại đã tồn tại trong trung tâm hiện tại.");
        seenPhones.add(phone);
      }
      if (email) {
        if (seenEmails.has(email)) addError(index, data, "Email bị trùng lặp trong file import.");
        else if (existingEmails.has(email)) addError(index, data, "Email đã tồn tại trong trung tâm hiện tại.");
        seenEmails.add(email);
      }
      if (idCard) {
        if (seenIdCards.has(idCard)) addError(index, data, "CCCD/CMND bị trùng lặp trong file import.");
        else if (existingIdCards.has(idCard)) addError(index, data, "CCCD/CMND đã tồn tại trong trung tâm hiện tại.");
        seenIdCards.add(idCard);
      }
    });

    return { errors };
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
