import { Schema, model } from "mongoose";
import { ICategory } from "../interface/category.interface";

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true, index: true },
  code: { type: String, required: true, index: true },
  description: { type: String },
  colorClass: { type: String, default: "bg-blue-100 text-blue-800" },
  status: { type: String, enum: ["Đang dùng", "Tạm khóa"], default: "Đang dùng" },
  companyCode: { type: String, required: true, index: true },
  // Giữ trường này cho các danh mục cũ; danh mục mới dùng chung toàn doanh nghiệp.
  branchId: { type: String, index: true },
});

// Các bản ghi mới không có branchId nên các khóa này vẫn bảo đảm tính duy nhất toàn công ty.
// Dữ liệu cũ còn branchId được kiểm tra trùng trong crud.service.ts.
CategorySchema.index({ companyCode: 1, branchId: 1, name: 1 }, { unique: true });
CategorySchema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });

export const CategoryModel = model<ICategory>("Category", CategorySchema);
