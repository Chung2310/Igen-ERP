import { Course } from "../models/course.model";
import { ICourse } from "../interfaces/course.interface";
import { BatchService } from "./batch.service";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";

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

export class CourseService {
  static async createCourse(ownerId: string, data: CourseData): Promise<ICourse> {
    logger.info(`[Course] Creating course for ownerId=${ownerId}, code=${data.code}`);
    const existing = await Course.findOne({ ownerId, code: String(data.code || "").toUpperCase() });
    if (existing) {
      throw new Error(`Mã khóa học "${data.code}" đã tồn tại.`);
    }
    const course = new Course({ ...data, fee: normalizeCourseFee(data.fee), ownerId });
    const saved = await course.save();
    logger.info(`[Course] Course created: id=${saved._id}, code=${saved.code}`);
    return saved;
  }

  static async getCourses(ownerId: string | string[], filters: CourseFilters) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = buildOwnerQuery(resolvedOwnerId);
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

  static async getCourseById(ownerId: string | string[], id: string) {
    const course = await Course.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
    if (!course) return null;
    const activeCounts = await BatchService.countActiveByCourse([String(course._id)]);
    return { ...course.toObject(), activeBatches: activeCounts.get(String(course._id)) || 0 };
  }

  static async updateCourse(ownerId: string | string[], id: string, data: CourseData): Promise<ICourse | null> {
    logger.info(`[Course] Updating course: id=${id}`);
    const normalizedData = {
      ...data,
      ...(Object.prototype.hasOwnProperty.call(data, "fee") ? { fee: normalizeCourseFee(data.fee) } : {}),
    };
    return await Course.findOneAndUpdate(
      { _id: id, ...buildOwnerQuery(ownerId) },
      { $set: normalizedData },
      { new: true, runValidators: true }
    );
  }

  static async deleteCourse(ownerId: string | string[], id: string): Promise<ICourse | null> {
    logger.info(`[Course] Deleting course: id=${id}`);
    const activeCounts = await BatchService.countActiveByCourse([id]);
    if ((activeCounts.get(id) || 0) > 0) {
      throw new Error("Không thể xóa: khóa học đang có lớp hoạt động. Hãy kết thúc hoặc xóa các lớp trước.");
    }
    return await Course.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId) });
  }
}
