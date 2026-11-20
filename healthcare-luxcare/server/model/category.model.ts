import { Schema, model } from "mongoose";
import type { ICategory } from "../interface/category.interface";

const CategorySchema = new Schema<ICategory>(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    color: { type: String, default: "emerald", trim: true },
    icon: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

CategorySchema.index({ companyCode: 1, code: 1 }, { unique: true });
CategorySchema.index({ companyCode: 1, isActive: 1 });

export const CategoryModel = model<ICategory>("LuxcareSupplyCategory", CategorySchema);
