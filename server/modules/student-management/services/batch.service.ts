import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { IBatch } from "../interfaces/batch.interface";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";

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

function hasLockedStudentFee(fee: string | undefined): boolean {
  const feeNum = parseInt(String(fee || "").replace(/\D/g, ""), 10) || 0;
  return feeNum > 0;
}

async function assertInstructorAssignable(actor: BatchActor, instructorId: unknown) {
  if (!instructorId) return;

  const query: Record<string, unknown> = {
    _id: instructorId,
    role: "user",
  };

    if (actor.role !== "superadmin") {
      query.companyCode = actor.companyCode || actor.centerId;
    }

  const instructor = await User.findOne(query);
  if (!instructor) {
    throw new Error("Không tìm thấy giảng viên được gán.");
  }
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
      maxLearners: course?.maxLearners ?? 0,
      instructorName: instructor?.displayName || "",
    };
  });
}

export class BatchService {
  static customFieldWrites = customFieldWriteService;

  static async createBatch(
    ownerId: string,
    actor: BatchActor,
    data: BatchData,
    context: CustomFieldWriteContext,
  ): Promise<EnrichedBatch> {
    logger.info(`[Batch] Creating batch for ownerId=${ownerId}, code=${data.code}`);
    const writeData = await this.customFieldWrites.prepareCreate(context, data);
    const existing = await Batch.findOne({ ownerId, code: String(writeData.code || "").toUpperCase() });
    if (existing) {
      throw new Error(`Mã lớp "${data.code}" đã tồn tại.`);
    }
    assertScheduleValid(writeData);

    const course = await Course.findOne({ _id: writeData.courseId, ownerId });
    if (!course) {
      throw new Error("Không tìm thấy khóa học của lớp.");
    }

    await assertInstructorAssignable(actor, writeData.instructorId);

    const batch = new Batch({ ...writeData, ownerId });
    const saved = await batch.save();
    logger.info(`[Batch] Batch created: id=${saved._id}, code=${saved.code}`);
    return (await enrichBatches([saved]))[0];
  }

  static async getBatches(ownerId: string | string[], filters: BatchFilters) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = buildOwnerQuery(resolvedOwnerId);
    if (filters.courseId) query.courseId = filters.courseId;
    if (filters.instructorId) query.instructorId = filters.instructorId;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { code: { $regex: filters.search, $options: "i" } },
        { location: { $regex: filters.search, $options: "i" } },
      ];
    }

    const total = await Batch.countDocuments(query);
    const batches = await Batch.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { batches: await enrichBatches(batches), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getBatchById(ownerId: string | string[], id: string): Promise<EnrichedBatch | null> {
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
    if (!batch) return null;
    return (await enrichBatches([batch]))[0];
  }

  static async updateBatch(
    ownerId: string | string[],
    actor: BatchActor,
    id: string,
    data: BatchData,
    context: CustomFieldWriteContext,
  ): Promise<EnrichedBatch | null> {
    logger.info(`[Batch] Updating batch: id=${id}`);
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
    if (!batch) return null;
    const expectedVersion = expectedVersionOf(data);
    const targetContext = context.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(batch.ownerId) } : context;
    const writeData = await this.customFieldWrites.prepareUpdate(targetContext, batch, data);

    if (writeData.code && String(writeData.code).toUpperCase() !== batch.code) {
      const dup = await Batch.findOne({ ownerId: batch.ownerId, code: String(writeData.code).toUpperCase() });
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
      const course = await Course.findOne({ _id: writeData.courseId, ownerId: batch.ownerId });
      if (!course) {
        throw new Error("Không tìm thấy khóa học của lớp.");
      }
    }

    if (writeData.instructorId && writeData.instructorId !== batch.instructorId) {
      await assertInstructorAssignable(actor, writeData.instructorId);
    }

    const saved = await Batch.findOneAndUpdate(
      { _id: id, ...buildOwnerQuery(ownerId), ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
      { $set: writeData, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
    if (!saved) throw new CustomFieldWriteConflictError();
    return (await enrichBatches([saved]))[0];
  }

  static async deleteBatch(ownerId: string | string[], id: string): Promise<IBatch | null> {
    logger.info(`[Batch] Deleting batch: id=${id}`);
    return await Batch.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId) });
  }

  static async addLearner(
    ownerId: string | string[],
    id: string,
    studentId: string,
    businessType: "driving" | "language" | "general" = "general"
  ): Promise<EnrichedBatch> {
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
    if (!batch) {
      throw new Error("Không tìm thấy lớp học.");
    }
    if (batch.learnerIds.includes(studentId)) {
      throw new Error("Học viên đã có trong lớp này.");
    }
    const student = await Student.findOne({ _id: studentId, ...buildOwnerQuery(ownerId) });
    if (!student) {
      throw new Error("Không tìm thấy học viên.");
    }
    const course = await Course.findOne({ _id: batch.courseId });
    if (course && course.maxLearners > 0 && batch.learnerIds.length >= course.maxLearners) {
      throw new Error(`Lớp đã đạt sĩ số tối đa (${course.maxLearners} học viên).`);
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

  static async removeLearner(ownerId: string | string[], id: string, studentId: string): Promise<EnrichedBatch> {
    const batch = await Batch.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
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

  static async getClassEventsInRange(ownerId: string | string[], from?: string, to?: string) {
    const batches = await Batch.find(buildOwnerQuery(ownerId));
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
}
