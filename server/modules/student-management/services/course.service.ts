import { Course } from "../models/course.model";
import { ICourse } from "../interfaces/course.interface";
import { BatchService } from "./batch.service";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";
import { customFieldResourceService } from "./custom-field-resource.service";

interface CourseFilters {
  page?: number | string;
  limit?: number | string;
  category?: string;
  status?: string;
  search?: string;
  ownerFilter?: string;
}

interface CourseData {
  [key: string]: unknown;
}

function normalizeCourseFee(fee: unknown): string {
  const raw = String(fee || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "0đ";
  const num = parseInt(digits, 10);
  if (isNaN(num)) return "0đ";
  return `${num.toLocaleString("vi-VN")}đ`;
}

function buildOwnerQuery(ownerId: string | string[]): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function buildBranchScopeQuery(branchId?: string): Record<string, unknown> {
  return branchId ? { branchId } : {};
}

export class CourseService {
  static customFieldWrites = customFieldWriteService;

  static async createCourse(ownerId: string, data: CourseData, context: CustomFieldWriteContext): Promise<ICourse> {
    logger.info(`[Course] Creating course for ownerId=${ownerId}, code=${data.code}`);
    const writeData = await this.customFieldWrites.prepareCreate(context, data);
    const existing = await Course.findOne({ ownerId, branchId: writeData.branchId, code: String(writeData.code || "").toUpperCase() });
    if (existing) {
      throw new Error(`Mã khóa học "${data.code}" đã tồn tại.`);
    }
    const course = new Course({ ...writeData, fee: normalizeCourseFee(writeData.fee), ownerId });
    const saved = await course.save();
    await customFieldResourceService.finalizeEntity(context, saved);
    logger.info(`[Course] Course created: id=${saved._id}, code=${saved.code}`);
    return saved;
  }

  static async getCourses(ownerId: string | string[], filters: CourseFilters, branchId?: string) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = { ...buildOwnerQuery(resolvedOwnerId), ...buildBranchScopeQuery(branchId) };
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: "i" } },
        { code: { $regex: filters.search, $options: "i" } },
      ];
    }

    const total = await Course.countDocuments(query);
    const courses = await Course.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // activeBatches tính từ số lớp còn hoạt động, không dùng con số tĩnh lưu trong document
    const activeCounts = await BatchService.countActiveByCourse(courses.map(c => String(c._id)));
    const withBatches = courses.map(c => ({
      ...c.toObject(),
      activeBatches: activeCounts.get(String(c._id)) || 0,
    }));

    return { courses: withBatches, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getCourseById(ownerId: string | string[], id: string, branchId?: string) {
    const course = await Course.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!course) return null;
    const activeCounts = await BatchService.countActiveByCourse([String(course._id)]);
    return { ...course.toObject(), activeBatches: activeCounts.get(String(course._id)) || 0 };
  }

  static async updateCourse(
    ownerId: string | string[],
    id: string,
    data: CourseData,
    context: CustomFieldWriteContext,
    branchId?: string,
  ): Promise<ICourse | null> {
    logger.info(`[Course] Updating course: id=${id}`);
    const query = { _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) };
    const existing = await Course.findOne(query);
    if (!existing) return null;
    const expectedVersion = expectedVersionOf(data);
    const targetContext = context.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(existing.ownerId) } : context;
    const writeData = await this.customFieldWrites.prepareUpdate(targetContext, existing, data);
    const normalizedData = {
      ...writeData,
      ...(Object.prototype.hasOwnProperty.call(writeData, "fee") ? { fee: normalizeCourseFee(writeData.fee) } : {}),
    };
    const updated = await Course.findOneAndUpdate(
      { ...query, ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
      { $set: normalizedData, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) throw new CustomFieldWriteConflictError();
    await customFieldResourceService.finalizeEntity(targetContext, updated);
    return updated;
  }

  static async deleteCourse(ownerId: string | string[], id: string, branchId?: string): Promise<ICourse | null> {
    logger.info(`[Course] Deleting course: id=${id}`);
    const activeCounts = await BatchService.countActiveByCourse([id]);
    if ((activeCounts.get(id) || 0) > 0) {
      throw new Error("Không thể xóa: khóa học đang có lớp hoạt động. Hãy kết thúc hoặc xóa các lớp trước.");
    }
    return await Course.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  }
}
