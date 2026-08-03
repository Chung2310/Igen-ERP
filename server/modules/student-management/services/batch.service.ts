import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { IBatch, IAttendanceSession, IAttendanceRecord } from "../interfaces/batch.interface";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";
import { EmailService, SmtpSettings } from "./email.service";
import { companyEmailService } from "../../../service/company-email.service";

interface BatchFilters {
  page?: number | string;
  limit?: number | string;
  courseId?: string;
  instructorId?: string;
  status?: string;
  search?: string;
  ownerFilter?: string;
}

interface BatchData {
  [key: string]: unknown;
}

interface BatchActor {
  uid: string;
  role: string;
  centerId?: string;
  companyCode?: string;
  branchId?: string;
}

export interface EnrichedBatch {
  [key: string]: unknown;
  courseCode: string;
  courseTitle: string;
  maxLearners: number;
  instructorName: string;
}

const ACTIVE_STATUSES = ["Sắp khai giảng", "Đang học"];

function buildOwnerQuery(ownerId: string | string[]): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function buildBranchScopeQuery(branchId?: string): Record<string, unknown> {
  return branchId ? { branchId } : {};
}

/**
 * Chỉ tiêu hiệu lực của một dự án/lớp: ưu tiên số đặt riêng trên batch, chỉ khi
 * chưa đặt (0/undefined) mới rơi về chỉ tiêu của khóa học/danh mục.
 */
export function resolveQuota(batchQuota?: number, courseMaxLearners?: number): number {
  if (typeof batchQuota === "number" && batchQuota > 0) return batchQuota;
  return courseMaxLearners ?? 0;
}

function hasLockedStudentFee(fee: string | undefined): boolean {
  const feeNum = parseInt(String(fee || "").replace(/\D/g, ""), 10) || 0;
  return feeNum > 0;
}

export function buildInstructorAssignmentQuery(actor: BatchActor, instructorId: unknown): Record<string, unknown> {
  const companyCode = actor.companyCode || actor.centerId;
  if (!companyCode) throw new Error("Không xác định được công ty khi gán người phụ trách.");
  if (!actor.branchId) throw new Error("Vui lòng chọn chi nhánh trước khi gán người phụ trách.");
  return { _id: instructorId, companyCode, branchId: actor.branchId, isActive: true };
}

async function assertInstructorAssignable(actor: BatchActor, instructorId: unknown) {
  if (!instructorId) return;
  const instructor = await User.findOne(buildInstructorAssignmentQuery(actor, instructorId));
  if (!instructor) {
    throw new Error("Không tìm thấy tài khoản đang hoạt động trong chi nhánh được chọn.");
  }
}

/**
 * Người phụ trách có thể là tài khoản trong công ty (instructorId) hoặc tên nhập
 * tay (instructorText) — không bao giờ cả hai. Gán tài khoản luôn thắng.
 */
function normalizeInstructorFields(data: BatchData): BatchData {
  const hasId = "instructorId" in data;
  const hasText = "instructorText" in data;
  if (!hasId && !hasText) return data;

  const id = String(data.instructorId ?? "").trim();
  if (id) return { ...data, instructorId: id, instructorText: "" };
  if (hasText) return { ...data, instructorId: "", instructorText: String(data.instructorText ?? "").trim() };
  return { ...data, instructorId: "" };
}

function assertScheduleValid(data: BatchData) {
  if (data.startTime && data.endTime && String(data.startTime) >= String(data.endTime)) {
    throw new Error("Giờ bắt đầu phải trước giờ kết thúc.");
  }
  if (data.startDate && data.endDate && String(data.startDate) > String(data.endDate)) {
    throw new Error("Ngày khai giảng phải trước hoặc bằng ngày kết thúc.");
  }
}

async function enrichBatches(batches: IBatch[]): Promise<EnrichedBatch[]> {
  const courseIds = [...new Set(batches.map(b => b.courseId).filter(Boolean))];
  const instructorIds = [...new Set(batches.map(b => b.instructorId).filter(Boolean))];

  const [courses, instructors] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("code title maxLearners"),
    User.find({ _id: { $in: instructorIds } }).select("displayName"),
  ]);

  const courseMap = new Map(courses.map(c => [String(c._id), c]));
  const instructorMap = new Map(instructors.map(i => [String(i._id), i]));

  return batches.map(b => {
    const course = courseMap.get(b.courseId);
    const instructor = b.instructorId ? instructorMap.get(b.instructorId) : undefined;
    return {
      ...b.toObject(),
      courseCode: course?.code || "",
      courseTitle: course?.title || "(Khóa học đã xóa)",
      // Chỉ tiêu riêng của dự án (nếu có) thắng chỉ tiêu của khóa học/danh mục
      maxLearners: resolveQuota(b.quota, course?.maxLearners),
      // Ưu tiên tên tài khoản được gán; nếu không có thì dùng tên nhập tay
      instructorName: instructor?.displayName || b.instructorText || "",
    };
  });
}

const DAY_LABELS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function formatDaysOfWeek(days: unknown): string {
  if (!Array.isArray(days) || days.length === 0) return "Chưa xếp lịch";
  return days
    .map((d) => DAY_LABELS[Number(d)])
    .filter(Boolean)
    .join(", ");
}

/**
 * Lấy cấu hình SMTP riêng của công ty (chủ sở hữu lớp). Trả về undefined để
 * EmailService dùng cấu hình SMTP mặc định từ biến môi trường.
 */
async function resolveSmtpForOwner(ownerId: string): Promise<SmtpSettings | undefined> {
  const owner = await User.findById(ownerId).select("companyCode");
  if (owner?.companyCode) {
    return companyEmailService.resolveLegacySettings(owner.companyCode);
  }
  return undefined;
}

function buildInstructorAssignmentHtml(instructorName: string, batch: EnrichedBatch): string {
  const schedule = `${batch.startTime || ""} - ${batch.endTime || ""}`.trim();
  const rows: Array<[string, string]> = [
    ["Mã lớp", String(batch.code || "")],
    ["Khóa học", String(batch.courseTitle || "")],
    ["Lịch học", formatDaysOfWeek(batch.daysOfWeek)],
    ["Khung giờ", schedule || "Chưa xác định"],
    ["Thời gian", `${batch.startDate || "?"} → ${batch.endDate || "?"}`],
    ["Địa điểm", String(batch.location || "Chưa cập nhật")],
  ];
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;font-weight:600;">${label}</td><td style="padding:6px 12px;color:#111827;">${value}</td></tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111827;">
    <h2 style="color:#2563eb;">Bạn được phân công phụ trách một lớp học</h2>
    <p>Xin chào <strong>${instructorName || "Thầy/Cô"}</strong>,</p>
    <p>Bạn vừa được phân công làm giáo viên phụ trách lớp học với thông tin sau:</p>
    <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;overflow:hidden;">
      ${rowsHtml}
    </table>
    <p style="margin-top:16px;">Vui lòng đăng nhập hệ thống để xem chi tiết lớp và danh sách học viên.</p>
    <p style="color:#6b7280;font-size:13px;">Email được gửi tự động, vui lòng không trả lời email này.</p>
  </div>`;
}

/**
 * Gửi email thông báo cho giáo viên khi được phân công phụ trách một lớp học.
 * Chạy nền, không chặn và không làm hỏng luồng tạo/cập nhật lớp nếu gửi thất bại.
 */
async function notifyInstructorAssigned(ownerId: string, instructorId: string, batch: EnrichedBatch): Promise<void> {
  try {
    const instructor = await User.findById(instructorId).select("email displayName");
    if (!instructor || !instructor.email) {
      logger.warn(`[Batch] Skip instructor email: no email for instructorId=${instructorId}`);
      return;
    }

    const smtpSettings = await resolveSmtpForOwner(ownerId);
    const result = await EmailService.sendMail(
      {
        to: instructor.email,
        subject: `[Phân công lớp] Bạn phụ trách lớp ${batch.code || ""} - ${batch.courseTitle || ""}`,
        html: buildInstructorAssignmentHtml(instructor.displayName || "", batch),
      },
      smtpSettings
    );

    if (result.success) {
      logger.info(`[Batch] Instructor assignment email sent to ${instructor.email} for batch=${batch.code}`);
    } else {
      logger.warn(`[Batch] Instructor assignment email failed (${result.error}) for batch=${batch.code}`);
    }
  } catch (error: unknown) {
    logger.error("[Batch] notifyInstructorAssigned error: %o", error);
  }
}

export class BatchService {
  static customFieldWrites = customFieldWriteService;

  static async createBatch(
    ownerId: string,
    actor: BatchActor,
    data: BatchData,
    context?: CustomFieldWriteContext,
  ): Promise<EnrichedBatch> {
    logger.info(`[Batch] Creating batch for ownerId=${ownerId}, code=${data.code}`);
    const writeData = context ? await this.customFieldWrites.prepareCreate(context, data) : data;
    const existing = await Batch.findOne({ ownerId, branchId: actor.branchId, code: String(writeData.code || "").toUpperCase() });
    if (existing) {
      throw new Error(`Mã lớp "${data.code}" đã tồn tại.`);
    }
    assertScheduleValid(writeData);

    const course = await Course.findOne({ _id: writeData.courseId, ownerId, branchId: actor.branchId });
    if (!course) {
      throw new Error("Không tìm thấy khóa học của lớp.");
    }

    await assertInstructorAssignable(actor, writeData.instructorId);

    const batch = new Batch({ ...normalizeInstructorFields(writeData), ownerId, branchId: actor.branchId });
    const saved = await batch.save();
    logger.info(`[Batch] Batch created: id=${saved._id}, code=${saved.code}`);
    const enriched = (await enrichBatches([saved]))[0];

    // Tự động thông báo cho giáo viên khi lớp được tạo kèm phân công giáo viên.
    if (saved.instructorId) {
      void notifyInstructorAssigned(ownerId, saved.instructorId, enriched);
    }

    return enriched;
  }

  static async getBatches(ownerId: string | string[], filters: BatchFilters, branchId?: string) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = { ...buildOwnerQuery(resolvedOwnerId), ...buildBranchScopeQuery(branchId) };
    if (filters.courseId) query.courseId = filters.courseId;
    if (filters.instructorId) query.instructorId = filters.instructorId;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { code: { $regex: filters.search, $options: "i" } },
        { location: { $regex: filters.search, $options: "i" } },
        { instructorText: { $regex: filters.search, $options: "i" } },
      ];
    }

    const total = await Batch.countDocuments(query);
    const batches = await Batch.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { batches: await enrichBatches(batches), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getBatchById(ownerId: string | string[], id: string, branchId?: string): Promise<EnrichedBatch | null> {
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!batch) return null;
    return (await enrichBatches([batch]))[0];
  }

  static async updateBatch(
    ownerId: string | string[],
    actor: BatchActor,
    id: string,
    data: BatchData,
    context?: CustomFieldWriteContext,
    branchId?: string,
  ): Promise<EnrichedBatch | null> {
    logger.info(`[Batch] Updating batch: id=${id}`);
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!batch) return null;
    const expectedVersion = expectedVersionOf(data);
    const targetContext = context?.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(batch.ownerId) } : context;
    const writeData = targetContext ? await this.customFieldWrites.prepareUpdate(targetContext, batch, data) : data;

    if (writeData.code && String(writeData.code).toUpperCase() !== batch.code) {
      const dup = await Batch.findOne({ ownerId: batch.ownerId, branchId: batch.branchId, code: String(writeData.code).toUpperCase() });
      if (dup) {
        throw new Error(`Mã lớp "${data.code}" đã tồn tại.`);
      }
    }

    assertScheduleValid({
      startTime: writeData.startTime ?? batch.startTime,
      endTime: writeData.endTime ?? batch.endTime,
      startDate: writeData.startDate ?? batch.startDate,
      endDate: writeData.endDate ?? batch.endDate,
    });

    if (writeData.courseId && writeData.courseId !== batch.courseId) {
      const course = await Course.findOne({ _id: writeData.courseId, ownerId: batch.ownerId, branchId: batch.branchId });
      if (!course) {
        throw new Error("Không tìm thấy khóa học của lớp.");
      }
    }

    if (writeData.instructorId && writeData.instructorId !== batch.instructorId) {
      await assertInstructorAssignable(actor, writeData.instructorId);
    }

    const previousInstructorId = batch.instructorId;
    const persistData = normalizeInstructorFields(writeData);
    let saved: IBatch;
    if (context) {
      const updated = await Batch.findOneAndUpdate(
        { _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId), ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
        { $set: persistData, $inc: { __v: 1 } },
        { new: true, runValidators: true },
      );
      if (!updated) throw new CustomFieldWriteConflictError();
      saved = updated;
    } else {
      batch.set(persistData);
      saved = await batch.save();
    }
    const enriched = (await enrichBatches([saved]))[0];

    // Thông báo cho giáo viên khi được phân công vào lớp (mới gán hoặc đổi giáo viên).
    if (saved.instructorId && saved.instructorId !== previousInstructorId) {
      void notifyInstructorAssigned(saved.ownerId, saved.instructorId, enriched);
    }

    return enriched;
  }

  static async deleteBatch(ownerId: string | string[], id: string, branchId?: string): Promise<IBatch | null> {
    logger.info(`[Batch] Deleting batch: id=${id}`);
    return await Batch.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  }

  static async addLearner(
    ownerId: string | string[],
    id: string,
    studentId: string,
    businessType: "driving" | "language" | "general" = "general",
    branchId?: string
  ): Promise<EnrichedBatch> {
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }
    if (batch.learnerIds.includes(studentId)) {
      throw new Error("Học viên đã có trong lớp này.");
    }
    const student = await Student.findOne({ _id: studentId, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!student) {
      throw new Error("Không tìm thấy học viên.");
    }
    const course = await Course.findOne({ _id: batch.courseId });
    const quota = resolveQuota(batch.quota, course?.maxLearners);
    if (quota > 0 && batch.learnerIds.length >= quota) {
      throw new Error(`Lớp đã đạt sĩ số tối đa (${quota} học viên).`);
    }

    if (businessType !== "driving" && course) {
      let shouldSaveStudent = false;

      if (!student.courseId) {
        student.courseId = batch.courseId;
        shouldSaveStudent = true;
      }

      if (!hasLockedStudentFee(student.fee)) {
        student.fee = course.fee;
        shouldSaveStudent = true;
      }

      if (shouldSaveStudent) {
        await student.save();
      }
    }

    batch.learnerIds.push(studentId);
    const saved = await batch.save();
    logger.info(`[Batch] Learner added: batchId=${id}, studentId=${studentId}`);
    return (await enrichBatches([saved]))[0];
  }

  static async removeLearner(ownerId: string | string[], id: string, studentId: string, branchId?: string): Promise<EnrichedBatch> {
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }
    const before = batch.learnerIds.length;
    batch.learnerIds = batch.learnerIds.filter(lid => lid !== studentId);
    if (batch.learnerIds.length === before) {
      throw new Error("Học viên không có trong lớp này.");
    }
    const saved = await batch.save();
    logger.info(`[Batch] Learner removed: batchId=${id}, studentId=${studentId}`);
    return (await enrichBatches([saved]))[0];
  }

  static async countActiveByCourse(courseIds: string[]): Promise<Map<string, number>> {
    if (courseIds.length === 0) return new Map();
    const rows = await Batch.aggregate([
      { $match: { courseId: { $in: courseIds }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: "$courseId", count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r: { _id: string; count: number }) => [r._id, r.count]));
  }

  static async countActiveByInstructor(instructorIds: string[]): Promise<Map<string, number>> {
    if (instructorIds.length === 0) return new Map();
    const rows = await Batch.aggregate([
      { $match: { instructorId: { $in: instructorIds }, status: { $in: ACTIVE_STATUSES } } },
      { $group: { _id: "$instructorId", count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r: { _id: string; count: number }) => [r._id, r.count]));
  }

  static async getClassEventsInRange(ownerId: string | string[], from?: string, to?: string, branchId?: string) {
    const batches = await Batch.find({ ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    const enriched = await enrichBatches(batches);
    const events: { id: string; title: string; date: string; time: string; details: string }[] = [];

    for (const b of enriched) {
      const startDate = String(b.startDate);
      const endDate = String(b.endDate);
      const lower = from && from > startDate ? from : startDate;
      const upper = to && to < endDate ? to : endDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(lower) || !/^\d{4}-\d{2}-\d{2}$/.test(upper) || lower > upper) continue;

      const daysOfWeek = (b.daysOfWeek as number[]) || [];
      const learnerCount = Array.isArray(b.learnerIds) ? b.learnerIds.length : 0;
      const detailParts = [
        b.instructorName ? `GV ${b.instructorName}` : "Chưa gán GV",
        `${learnerCount} học viên`,
      ];
      if (b.location) detailParts.push(String(b.location));

      const cursor = new Date(`${lower}T00:00:00Z`);
      const end = new Date(`${upper}T00:00:00Z`);
      for (let i = 0; cursor <= end && i < 400; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        if (!daysOfWeek.includes(cursor.getUTCDay())) continue;
        const date = cursor.toISOString().slice(0, 10);
        events.push({
          id: `${b._id}-${date}`,
          title: `Lớp ${b.code} • ${b.courseTitle}`,
          date,
          time: `${b.startTime} - ${b.endTime}`,
          details: detailParts.join(" • "),
        });
      }
    }
    return events;
  }

  static async saveAttendanceSession(
    ownerId: string | string[],
    batchId: string,
    date: string,
    records: { studentId: string; status: "present" | "absent" | "excused" | "late" }[],
    note?: string,
    branchId?: string
  ): Promise<EnrichedBatch> {
    const batch = await Batch.findOne({ _id: batchId, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }
    
    const dateStr = date.trim();
    let session = batch.attendanceSessions.find(s => s.date === dateStr);
    
    if (!session) {
      const newSessionObj = {
        date: dateStr,
        note: note || "",
        records: []
      };
      batch.attendanceSessions.push(newSessionObj as unknown as IAttendanceSession);
      session = batch.attendanceSessions.find(s => s.date === dateStr);
    }

    if (session) {
      if (note !== undefined) session.note = note;
      if (records) {
        session.records = records.map(r => ({
          studentId: r.studentId,
          status: r.status
        })) as unknown as IAttendanceRecord[];
      }
    }

    const saved = await batch.save();
    return (await enrichBatches([saved]))[0];
  }

  static async deleteAttendanceSessionByDate(
    ownerId: string | string[],
    batchId: string,
    date: string,
    branchId?: string
  ): Promise<EnrichedBatch> {
    const batch = await Batch.findOne({ _id: batchId, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }

    const before = batch.attendanceSessions.length;
    const dateStr = date.trim();
    batch.attendanceSessions = batch.attendanceSessions.filter(s => s.date !== dateStr) as unknown as IAttendanceSession[];
    if (batch.attendanceSessions.length === before) {
      throw new Error("Không tìm thấy dữ liệu điểm danh của ngày này để xóa.");
    }

    const saved = await batch.save();
    return (await enrichBatches([saved]))[0];
  }
}
