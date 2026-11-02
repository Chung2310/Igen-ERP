import { Schema, model } from "mongoose";

const HrDepartmentSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true },
  code: { type: String, trim: true, uppercase: true },
  description: { type: String, trim: true, default: "" },
  managerUid: { type: String },
  managerName: { type: String },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

HrDepartmentSchema.index({ companyCode: 1, normalizedName: 1 }, { unique: true });
HrDepartmentSchema.index({ companyCode: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } });

export const HrDepartmentModel = model("HrDepartment", HrDepartmentSchema);
