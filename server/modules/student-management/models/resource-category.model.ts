import { Schema, model } from "mongoose";
import { IResourceCategory } from "../interfaces/resource-category.interface";

const resourceCategorySchema = new Schema<IResourceCategory>(
  {
    name: { type: String, required: true, trim: true, index: true },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  },
  {
    timestamps: true,
  }
);

// Tránh trùng lặp tên phân loại cho cùng một chủ sở hữu
resourceCategorySchema.index({ ownerId: 1, name: 1 }, { unique: true });

export const ResourceCategory = model<IResourceCategory>("ResourceCategory", resourceCategorySchema);
