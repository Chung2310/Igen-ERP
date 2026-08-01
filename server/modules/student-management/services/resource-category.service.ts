import { ResourceCategory } from "../models/resource-category.model";
import { IResourceCategory } from "../interfaces/resource-category.interface";
import { Resource } from "../models/resource.model";
import { logger } from "../config/logger";

export class ResourceCategoryService {
  static async getCategories(ownerId: string | string[], branchId?: string): Promise<IResourceCategory[]> {
    logger.info(`[ResourceCategory] Fetching categories for ownerId: ${ownerId}`);

    let query: Record<string, unknown> = {};
    if (ownerId !== "ALL") {
      query = { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
    }
    if (branchId) query.branchId = branchId;

    return await ResourceCategory.find(query).sort({ createdAt: 1 });
  }

  static async createCategory(ownerId: string, name: string, branchId?: string): Promise<IResourceCategory> {
    const trimmedName = name.trim();
    logger.info(`[ResourceCategory] Creating category "${trimmedName}" for ownerId: ${ownerId}`);

    const existing = await ResourceCategory.findOne({ ownerId, name: { $regex: `^${trimmedName}$`, $options: "i" } });
    if (existing) {
      throw new Error(`Phân loại "${trimmedName}" đã tồn tại.`);
    }

    const category = new ResourceCategory({ name: trimmedName, ownerId, branchId });
    return await category.save();
  }

  static async deleteCategory(ownerId: string | string[], id: string, branchId?: string): Promise<IResourceCategory | null> {
    logger.info(`[ResourceCategory] Deleting category with id: ${id}`);

    let query: Record<string, unknown> = {};
    if (ownerId !== "ALL") {
      query = { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
    }
    if (branchId) query.branchId = branchId;

    const category = await ResourceCategory.findOne({ _id: id, ...query });
    if (!category) {
      return null;
    }

    // Kiểm tra xem phân loại này có đang được tài nguyên nào sử dụng không
    const resourcesInUse = await Resource.findOne({
      ...query,
      type: category.name,
    });

    if (resourcesInUse) {
      throw new Error(`Không thể xóa phân loại "${category.name}" vì đang có tài nguyên sử dụng.`);
    }

    return await ResourceCategory.findOneAndDelete({ _id: id });
  }
}
