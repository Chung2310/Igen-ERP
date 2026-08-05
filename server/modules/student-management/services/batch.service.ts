import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { BatchEnrollment } from "../models/batch-enrollment.model";
import { BatchEnrollmentStatus } from "../interfaces/batch-enrollment.interface";
import { LearningRoadmap } from "../models/learning-roadmap.model";
import { IBatch, IAttendanceSession, IAttendanceRecord } from "../interfaces/batch.interface";
import {
  countConsumedSessions,
  countTotalSessions,
  listScheduledSessionDates,
  loadHolidaySet,
  resolveCompanyCodeForOwner,
  todayInVietnam,
} from "../utils/session-count.util";
import { computeBatchProgress, BatchProgress } from "../utils/batch-progress.util";
import { transitionEnrollmentStatus, type EnrollmentOperationalStatus } from "../utils/enrollment-status.util";
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
import { getPlannedSessionCount, StudentBatchEnrollmentService } from "./student-batch-enrollment.service";

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
  instructorQualification: string;
  /** Cảnh báo tiến độ + nhãn tuổi lớp, tính sẵn để client không phải suy ra */
  progress: BatchProgress;
}

const ACTIVE_STATUSES = ["Sắp khai giảng", "Đang học"];

/** Trạng thái điểm danh được tính là đã dùng một buổi học */
const CONSUMING_ATTENDANCE_STATUSES = ["present", "late"];

/**
 * Ghi mốc thời gian khi lớp đóng/hủy, và xóa mốc khi lớp được mở lại.
 * Nhãn tuổi lớp dựa vào completedAt nên mốc phải luôn khớp với status.
 */
function applyStatusTimestamps(data: BatchData, batch: IBatch): BatchData {
  const nextStatus = data.status as string | undefined;
  if (!nextStatus || nextStatus === batch.status) return data;

  if (nextStatus === "Đã kết thúc") {
    return { ...data, completedAt: batch.completedAt || new Date(), cancelledAt: null };
  }
  if (nextStatus === "Đã hủy") {
    return { ...data, cancelledAt: batch.cancelledAt || new Date(), completedAt: null };
  }
  // Mở lại lớp: bỏ cả hai mốc để lớp quay về luồng cảnh báo tiến độ bình thường.
  return { ...data, completedAt: null, cancelledAt: null };
}

function buildOwnerQuery(ownerId: string | string[]): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function buildBranchScopeQuery(branchId?: string): Record<string, unknown> {
  return branchId ? { branchId } : {};
}

async function assertRoadmapAssignment(input: { ownerId: string; branchId?: string; courseId: string; roadmapId?: unknown; roadmapStepId?: unknown; }) {
  const roadmapId = String(input.roadmapId || "");
  const roadmapStepId = String(input.roadmapStepId || "");
  if (!roadmapId && !roadmapStepId) return;
  if (!roadmapId || !roadmapStepId) throw new Error("Lớp theo lộ trình cần chọn đủ lộ trình và chặng học.");
  const roadmap = await LearningRoadmap.findOne({ _id: roadmapId, ownerId: input.ownerId, ...buildBranchScopeQuery(input.branchId), status: "active" }).lean();
  const step = roadmap?.steps.find((item) => item.id === roadmapStepId);
  if (!step || step.courseId !== input.courseId) throw new Error("Chặng lộ trình không khớp với khóa học của lớp.");
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

async function assertRoomAvailable(
  ownerId: string,
  branchId: string | undefined,
  batchId: string | undefined,
  location: string | undefined,
  startDate: string,
  endDate: string,
  daysOfWeek: number[],
  startTime: string,
  endTime: string
) {
  if (!location || !location.trim()) return;

  const query: Record<string, unknown> = {
    ownerId,
    location: location.trim(),
    // Lớp đã đóng hoặc bị hủy thì không còn giữ chỗ phòng học
    status: { $nin: ["Đã kết thúc", "Đã hủy"] },
  };
  if (branchId) query.branchId = branchId;
  if (batchId) query._id = { $ne: batchId };

  const competingBatches = await Batch.find(query);

  for (const b of competingBatches) {
    const dateOverlap = startDate <= b.endDate && b.startDate <= endDate;
    if (!dateOverlap) continue;

    const dayOverlap = daysOfWeek.some(day => b.daysOfWeek.includes(day));
    if (!dayOverlap) continue;

    const timeOverlap = startTime < b.endTime && b.startTime < endTime;
    if (!timeOverlap) continue;

    throw new Error(
      `Phòng học "${location.trim()}" đã bị trùng lịch với lớp ${b.code} (${b.startTime} - ${b.endTime}, ${b.startDate} đến ${b.endDate}).`
    );
  }
}

async function enrichBatches(batches: IBatch[]): Promise<EnrichedBatch[]> {
  const courseIds = [...new Set(batches.map(b => b.courseId).filter(Boolean))];
  const instructorIds = [...new Set(batches.map(b => b.instructorId).filter(Boolean))];

  const [courses, instructors] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).select("code title maxLearners"),
    User.find({ _id: { $in: instructorIds } }).select("displayName qualification"),
  ]);

  const courseMap = new Map(courses.map(c => [String(c._id), c]));
  const instructorMap = new Map(instructors.map(i => [String(i._id), i]));

  // Cảnh báo tiến độ cần biết ngày nghỉ lễ của công ty; gom một lần cho cả
  // trang thay vì query theo từng lớp.
  const today = todayInVietnam();
  const holidaySetByOwner = await loadHolidaySetsForBatches(batches);

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
      instructorQualification: instructor?.qualification || "",
      progress: computeBatchProgress(
        {
          status: b.status,
          startDate: b.startDate,
          endDate: b.endDate,
          daysOfWeek: b.daysOfWeek,
          completedAt: b.completedAt,
          updatedAt: (b as IBatch & { updatedAt?: Date }).updatedAt,
        },
        { today, holidaySet: holidaySetByOwner.get(String(b.ownerId)) }
      ),
    };
  });
}

/**
 * Tập ngày nghỉ lễ theo từng owner, phủ toàn bộ khoảng ngày của các lớp
 * đang được enrich. Lỗi đọc lịch không được làm hỏng danh sách lớp —
 * khi đó coi như không có ngày lễ nào.
 */
async function loadHolidaySetsForBatches(batches: IBatch[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (batches.length === 0) return result;

  const byOwner = new Map<string, IBatch[]>();
  for (const b of batches) {
    const owner = String(b.ownerId);
    byOwner.set(owner, [...(byOwner.get(owner) || []), b]);
  }

  const companyCodeCache = new Map<string, string | undefined>();
  await Promise.all(
    [...byOwner.entries()].map(async ([ownerId, ownerBatches]) => {
      try {
        const starts = ownerBatches.map(b => b.startDate).filter(Boolean).sort();
        const ends = ownerBatches.map(b => b.endDate).filter(Boolean).sort();
        if (starts.length === 0 || ends.length === 0) return;
        const companyCode = await resolveCompanyCodeForOwner(ownerId, companyCodeCache);
        result.set(ownerId, await loadHolidaySet(companyCode, starts[0], ends[ends.length - 1]));
      } catch (error) {
        console.error(`[batch] Không đọc được lịch nghỉ lễ của owner ${ownerId}:`, error);
      }
    })
  );

  return result;
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
    await assertRoadmapAssignment({ ownerId, branchId: actor.branchId, courseId: String(writeData.courseId), roadmapId: writeData.roadmapId, roadmapStepId: writeData.roadmapStepId });

    await assertInstructorAssignable(actor, writeData.instructorId);

    await assertRoomAvailable(
      ownerId,
      actor.branchId,
      undefined,
      String(writeData.location || ""),
      String(writeData.startDate || ""),
      String(writeData.endDate || ""),
      Array.isArray(writeData.daysOfWeek) ? writeData.daysOfWeek : [],
      String(writeData.startTime || ""),
      String(writeData.endTime || "")
    );

    const batch = new Batch({ ...normalizeInstructorFields(writeData), ownerId, branchId: actor.branchId });
    const saved = await batch.save();
    await Promise.all(
      saved.learnerIds.map((studentId) => StudentBatchEnrollmentService.activate({
        ownerId: saved.ownerId,
        branchId: saved.branchId,
        batchId: String(saved._id),
        studentId,
        actorId: actor.uid,
        allowedSessions: getPlannedSessionCount(saved),
      })),
    );
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

    // Mã lớp và tên lớp bị khóa sau khi tạo để lịch sử học, điểm danh và đối
    // soát luôn tham chiếu được về đúng lớp. Gửi lại đúng giá trị hiện tại
    // vẫn hợp lệ; chỉ chặn khi thực sự đổi.
    if (writeData.code !== undefined && String(writeData.code).toUpperCase() !== batch.code) {
      throw new Error("Không được đổi mã lớp sau khi tạo.");
    }
    if (writeData.name !== undefined && String(writeData.name || "") !== (batch.name || "")) {
      throw new Error("Không được đổi tên lớp sau khi tạo.");
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

    const nextRoadmapId = writeData.roadmapId === undefined ? batch.roadmapId : String(writeData.roadmapId || "");
    const nextRoadmapStepId = writeData.roadmapStepId === undefined ? batch.roadmapStepId : String(writeData.roadmapStepId || "");
    const nextCourseId = String(writeData.courseId || batch.courseId);
    if ((nextRoadmapId !== (batch.roadmapId || "") || nextRoadmapStepId !== (batch.roadmapStepId || "")) && batch.learnerIds.length > 0) {
      throw new Error("Không thể đổi lộ trình của lớp đã có học viên.");
    }
    await assertRoadmapAssignment({ ownerId: batch.ownerId, branchId: batch.branchId, courseId: nextCourseId, roadmapId: nextRoadmapId, roadmapStepId: nextRoadmapStepId });

    if (writeData.instructorId && writeData.instructorId !== batch.instructorId) {
      await assertInstructorAssignable(actor, writeData.instructorId);
    }

    await assertRoomAvailable(
      batch.ownerId,
      batch.branchId,
      batch.id,
      writeData.location !== undefined ? String(writeData.location || "") : batch.location,
      writeData.startDate !== undefined ? String(writeData.startDate || "") : batch.startDate,
      writeData.endDate !== undefined ? String(writeData.endDate || "") : batch.endDate,
      Array.isArray(writeData.daysOfWeek) ? writeData.daysOfWeek : batch.daysOfWeek,
      writeData.startTime !== undefined ? String(writeData.startTime || "") : batch.startTime,
      writeData.endTime !== undefined ? String(writeData.endTime || "") : batch.endTime
    );

    const previousInstructorId = batch.instructorId;
    const persistData = applyStatusTimestamps(normalizeInstructorFields(writeData), batch);
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
    branchId?: string,
    actorId?: string,
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
    await StudentBatchEnrollmentService.activate({
      ownerId: saved.ownerId,
      branchId: saved.branchId,
      batchId: String(saved._id),
      studentId,
      actorId,
      allowedSessions: getPlannedSessionCount(saved),
    });
    logger.info(`[Batch] Learner added: batchId=${id}, studentId=${studentId}`);
    return (await enrichBatches([saved]))[0];
  }

  static async removeLearner(
    ownerId: string | string[],
    id: string,
    studentId: string,
    branchId?: string,
    actorId?: string,
  ): Promise<EnrichedBatch> {
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
    await StudentBatchEnrollmentService.remove({
      ownerId: saved.ownerId,
      branchId: saved.branchId,
      batchId: String(saved._id),
      studentId,
      actorId,
    });
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

    if (records) {
      await assertWithinSessionQuota(batch, dateStr, records);
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

    await StudentBatchEnrollmentService.assertAndSyncAttendanceLimits(batch);

    const saved = await batch.save();
    await syncAttendedSessions(saved);
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

    await StudentBatchEnrollmentService.assertAndSyncAttendanceLimits(batch);

    const saved = await batch.save();
    await syncAttendedSessions(saved);
    return (await enrichBatches([saved]))[0];
  }
}

// ---------------------------------------------------------------------------
// Đăng ký học (BatchEnrollment): sổ buổi học của từng học viên trong một lớp
// ---------------------------------------------------------------------------

/** Tổng số buổi theo lịch của lớp, đã trừ ngày nghỉ lễ của công ty */
export async function resolveBatchTotalSessions(batch: IBatch): Promise<number> {
  let holidaySet: Set<string> | undefined;
  try {
    const companyCode = await resolveCompanyCodeForOwner(String(batch.ownerId));
    holidaySet = await loadHolidaySet(companyCode, batch.startDate, batch.endDate);
  } catch (error) {
    console.error(`[batch] Không đọc được lịch nghỉ lễ khi đếm buổi lớp ${batch.code}:`, error);
  }
  return countTotalSessions(batch.startDate, batch.endDate, batch.daysOfWeek, holidaySet);
}

/** Số buổi học viên đã dùng, đếm lại từ dữ liệu điểm danh của lớp */
function countAttendedFromBatch(batch: IBatch, studentId: string): number {
  return countConsumedSessions(batch.attendanceSessions, studentId);
}

/**
 * Tạo đăng ký học khi thêm học viên vào lớp. Lỗi ở đây không được làm hỏng
 * việc thêm học viên — dữ liệu cũ có thể thiếu companyCode hoặc lịch lớp.
 */
export async function ensureEnrollment(batch: IBatch, studentId: string): Promise<void> {
  try {
    const existing = await BatchEnrollment.findOne({
      ownerId: batch.ownerId,
      batchId: String(batch._id),
      studentId,
    });

    if (existing) {
      // Học viên quay lại lớp cũ: mở lại đăng ký, giữ nguyên số buổi đã dùng.
      if (existing.leftAt) {
        existing.leftAt = null;
        existing.status = "Đang học";
        existing.history.push({ at: new Date(), action: "rejoined" });
        await existing.save();
      }
      return;
    }

    const allowedSessions = await resolveBatchTotalSessions(batch);
    await BatchEnrollment.create({
      ownerId: batch.ownerId,
      branchId: batch.branchId,
      batchId: String(batch._id),
      studentId,
      allowedSessions,
      attendedSessions: countAttendedFromBatch(batch, studentId),
      status: "Đang học",
      joinedAt: new Date(),
      history: [{ at: new Date(), action: "enrolled", toStatus: "Đang học" }],
    });
  } catch (error) {
    console.error(`[batch] Không tạo được đăng ký học cho học viên ${studentId}:`, error);
  }
}

/** Đánh dấu rời lớp mà không xóa bản ghi, để giữ lịch sử học */
export async function closeEnrollment(batchId: string, studentId: string): Promise<void> {
  try {
    await BatchEnrollment.updateOne(
      { batchId, studentId, leftAt: null },
      {
        $set: { leftAt: new Date() },
        $push: { history: { at: new Date(), action: "left" } },
      }
    );
  } catch (error) {
    console.error(`[batch] Không đóng được đăng ký học của học viên ${studentId}:`, error);
  }
}

/**
 * Chặn điểm danh vượt số buổi được học. Chỉ chặn buổi làm tăng số buổi đã
 * dùng — sửa lại buổi cũ hoặc đánh vắng thì luôn cho phép.
 */
export async function assertWithinSessionQuota(
  batch: IBatch,
  dateStr: string,
  records: { studentId: string; status: string }[]
): Promise<void> {
  const consuming = records
    .filter(r => CONSUMING_ATTENDANCE_STATUSES.includes(r.status))
    .map(r => r.studentId);
  const uniqueConsuming = [...new Set(consuming)];
  if (uniqueConsuming.length === 0) return;

  await backfillBatchEnrollments(batch);
  const enrollments = await BatchEnrollment.find({
    batchId: String(batch._id),
    studentId: { $in: uniqueConsuming },
  });
  if (enrollments.length !== uniqueConsuming.length) {
    throw new Error("Học viên không còn thuộc lớp hoặc chưa có sổ buổi hợp lệ.");
  }

  // Buổi này đã được tính chưa? Nếu rồi thì lưu lại không làm tăng số buổi.
  const existingSession = batch.attendanceSessions.find(s => s.date === dateStr);
  const alreadyCounted = new Set(
    (existingSession?.records || [])
      .filter(r => CONSUMING_ATTENDANCE_STATUSES.includes(r.status))
      .map(r => r.studentId)
  );

  for (const enrollment of enrollments) {
    if (enrollment.status === "Bảo lưu") {
      throw new Error("Học viên đang bảo lưu, không thể điểm danh.");
    }
    if (alreadyCounted.has(enrollment.studentId)) continue;
    if (enrollment.allowedSessions <= 0) continue;
    if (enrollment.attendedSessions < enrollment.allowedSessions) continue;

    const student = await Student.findById(enrollment.studentId).select("fullName name").lean();
    const label =
      (student as { fullName?: string; name?: string } | null)?.fullName ||
      (student as { fullName?: string; name?: string } | null)?.name ||
      enrollment.studentId;
    throw new Error(
      `Học viên ${label} đã dùng hết ${enrollment.allowedSessions} buổi được học của lớp này.`
    );
  }
}

/**
 * Đếm lại attendedSessions cho mọi học viên trong lớp từ dữ liệu điểm danh.
 * Gọi sau mỗi lần ghi/xóa điểm danh (kể cả điểm danh QR và online) để sổ
 * buổi không bao giờ lệch với thực tế.
 */
export async function syncAttendedSessions(batch: IBatch): Promise<void> {
  try {
    const enrollments = await BatchEnrollment.find({ batchId: String(batch._id) });
    await Promise.all(
      enrollments.map(enrollment => {
        const attended = countAttendedFromBatch(batch, enrollment.studentId);
        if (attended === enrollment.attendedSessions) return Promise.resolve();
        enrollment.attendedSessions = attended;
        return enrollment.save();
      })
    );
  } catch (error) {
    console.error(`[batch] Không đồng bộ được số buổi đã học của lớp ${batch.code}:`, error);
  }
}

/** Sổ buổi học của các học viên trong một lớp, dùng cho UI quản lý học viên */
export async function backfillBatchEnrollments(batch: IBatch): Promise<void> {
  await Promise.all(batch.learnerIds.map((studentId) => ensureEnrollment(batch, studentId)));
  const existing = await BatchEnrollment.find({ batchId: String(batch._id), studentId: { $in: batch.learnerIds } }).select("studentId").lean();
  const existingIds = new Set(existing.map((enrollment) => enrollment.studentId));
  const missing = batch.learnerIds.filter((studentId) => !existingIds.has(studentId));
  if (missing.length > 0) throw new Error("Không thể khởi tạo sổ buổi cho toàn bộ học viên của lớp.");
}

/** Cập nhật bảo lưu/quay lại học mà không đổi sổ buổi của học viên. */
export async function updateEnrollmentStatus(
  ownerId: string | string[],
  batchId: string,
  studentId: string,
  status: BatchEnrollmentStatus,
  reason?: string,
  expectedReturnAt?: string | null,
  branchId?: string,
  retakeFee = 0,
  targetBatchId?: string,
  actorId?: string,
) {
  const batch = await Batch.findOne({ _id: batchId, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  if (!batch) return null;
  if (!batch.learnerIds.includes(studentId)) throw new Error("Học viên không còn thuộc lớp này.");
  await backfillBatchEnrollments(batch);
  const enrollment = await BatchEnrollment.findOne({ batchId: String(batch._id), studentId });
  if (!enrollment) throw new Error("Không tìm thấy sổ buổi của học viên.");
  if (status === "Học lại") {
    const count = (enrollment.retakeCount || 0) + 1;
    if (count > 1 && retakeFee <= 0) throw new Error("Từ lần học lại thứ hai, lệ phí là bắt buộc.");
    enrollment.retakeCount = count;
    enrollment.status = "Học lại" as any;
    enrollment.retakeHistory.push({ count, batchId: String(batch._id), reason: reason || "", fee: retakeFee, at: new Date() });
    if (targetBatchId && targetBatchId !== String(batch._id)) {
      const target = await Batch.findOne({ _id: targetBatchId, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
      if (!target) throw new Error("Không tìm thấy lớp học lại đích.");
      if (target.quota && target.quota > 0 && target.learnerIds.length >= target.quota) throw new Error("Lớp học lại đích đã đủ sĩ số.");
      if (target.learnerIds.includes(studentId)) throw new Error("Học viên đã có trong lớp đích.");
      target.learnerIds.push(studentId); await target.save();
      await StudentBatchEnrollmentService.activate({ ownerId: String(Array.isArray(ownerId) ? ownerId[0] : ownerId), branchId, batchId: targetBatchId, studentId, actorId, allowedSessions: getPlannedSessionCount(target) });
    }
    enrollment.history.push({ at: new Date(), action: "retake", fromStatus: enrollment.status as any, toStatus: "Học lại" as any, note: reason || "" });
    await enrollment.save();
    return enrollment.toObject();
  }
  if (["Hoàn thành khóa", "Chờ xếp lớp tiếp theo", "Không còn nhu cầu học"].includes(status as string)) {
    const fromStatus = enrollment.status;
    enrollment.status = status as any;
    enrollment.history.push({ at: new Date(), action: "status_changed", fromStatus, toStatus: status as any, note: reason || "" });
    await enrollment.save();
    return enrollment.toObject();
  }
  if (enrollment.status !== "Đang học" && enrollment.status !== "Bảo lưu") {
    throw new Error("Chỉ có thể bảo lưu hoặc tiếp tục một học viên đang học/bảo lưu.");
  }
  const fromStatus = enrollment.status;
  const next = transitionEnrollmentStatus({
    status: enrollment.status as EnrollmentOperationalStatus,
    allowedSessions: enrollment.allowedSessions,
    attendedSessions: enrollment.attendedSessions,
    suspendedAt: enrollment.suspendedAt,
    suspensionReason: enrollment.suspensionReason,
    expectedReturnAt: enrollment.expectedReturnAt,
  }, status as EnrollmentOperationalStatus, { now: new Date(), reason, expectedReturnAt });
  enrollment.status = next.status;
  enrollment.suspendedAt = next.suspendedAt;
  enrollment.suspensionReason = next.suspensionReason;
  enrollment.expectedReturnAt = next.expectedReturnAt;
  enrollment.history.push({
    at: new Date(),
    action: status === "Bảo lưu" ? "suspended" : "resumed",
    fromStatus,
    toStatus: status,
    note: status === "Bảo lưu" ? next.suspensionReason : "",
  });
  await enrollment.save();
  return enrollment.toObject();
}

export async function listBatchEnrollments(ownerId: string | string[], batchId: string, branchId?: string) {
  const batch = await Batch.findOne({ _id: batchId, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  if (!batch) return null;
  await backfillBatchEnrollments(batch);
  return BatchEnrollment.find({ batchId: String(batch._id) }).lean({ virtuals: true });
}

// Danh sách buổi theo lịch — export lại để các service khác dùng chung nguồn
export { listScheduledSessionDates };
