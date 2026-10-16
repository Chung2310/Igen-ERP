import { Schema, model } from "mongoose";

const HrDepartmentSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true },
}, { timestamps: true });

HrDepartmentSchema.index({ companyCode: 1, normalizedName: 1 }, { unique: true });

export const HrDepartmentModel = model("HrDepartment", HrDepartmentSchema);
