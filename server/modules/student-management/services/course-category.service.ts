import { CourseCategory } from "../models/course-category.model";
import { ICourseCategory } from "../interfaces/course-category.interface";
import { Course } from "../models/course.model";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";

export class CourseCategoryService {
  static async getCategories(ownerId: string | string[], filters: { ownerFilter?: string } = {}): Promise<ICourseCategory[]> {
    logger.info(`[CourseCategory] Fetching categories for ownerId: ${ownerId}, ownerFilter: ${filters.ownerFilter}`);
    
    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    let query: Record<string, unknown> = {};
    if (resolvedOwnerId !== "ALL") {
      query = { ownerId: Array.isArray(resolvedOwnerId) ? { $in: resolvedOwnerId } : resolvedOwnerId };
    }

    return await CourseCategory.find(query).sort({ createdAt: 1 });
  }

  static async createCategory(ownerId: string, name: string): Promise<ICourseCategory> {
    const trimmedName = name.trim();
    logger.info(`[CourseCategory] Creating category "${trimmedName}" for ownerId: ${ownerId}`);

    const existing = await CourseCategory.findOne({ ownerId, name: { $regex: `^${trimmedName}$`, $options: "i" } });
    if (existing) {
      throw new Error(`Phân loại "${trimmedName}" đã tồn tại.`);
    }

    const category = new CourseCategory({ name: trimmedName, ownerId });
    return await category.save();
  }

  static async deleteCategory(ownerId: string | string[], id: string): Promise<ICourseCategory | null> {
    logger.info(`[CourseCategory] Deleting category with id: ${id}`);
    
    let query: Record<string, unknown> = {};
    if (ownerId !== "ALL") {
      query = { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
    }

    const category = await CourseCategory.findOne({ _id: id, ...query });
    if (!category) {
      return null;
    }

    // Kiểm tra xem phân loại này có đang được khoá học nào sử dụng không
    const coursesInUse = await Course.findOne({ 
      ...query,
      category: category.name 
    });

    if (coursesInUse) {
      throw new Error(`Không thể xóa phân loại "${category.name}" vì đang có khóa học sử dụng.`);
    }

    return await CourseCategory.findOneAndDelete({ _id: id });
  }
}
