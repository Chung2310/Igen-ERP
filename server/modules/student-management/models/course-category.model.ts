import { Schema, model } from "mongoose";
import { ICourseCategory } from "../interfaces/course-category.interface";

const courseCategorySchema = new Schema<ICourseCategory>(
  {
    name: { type: String, required: true, trim: true, index: true },
    ownerId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Tránh trùng lặp tên phân loại cho cùng một tài khoản giáo viên/chủ sở hữu
courseCategorySchema.index({ ownerId: 1, name: 1 }, { unique: true });

export const CourseCategory = model<ICourseCategory>("CourseCategory", courseCategorySchema);
