import { Schema, model } from "mongoose";
import type { IDepartment } from "../interface/department.interface";

const DepartmentSchema = new Schema<IDepartment>(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    managerUid: { type: String, default: "", trim: true },
    managerName: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

DepartmentSchema.index({ companyCode: 1, code: 1 }, { unique: true });
DepartmentSchema.index({ companyCode: 1, name: 1 }, { unique: true });
DepartmentSchema.index({ companyCode: 1, isActive: 1 });

export const DepartmentModel = model<IDepartment>("Department", DepartmentSchema);
