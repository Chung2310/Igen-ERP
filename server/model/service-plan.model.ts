import { Schema, model } from "mongoose";
import { MODULE_KEYS } from "../config/module-keys";

export interface ServicePlanRecord {
  code: string; name: string; description: string; priceVnd: number; durationDays: number;
  modules: string[]; active: boolean; createdBy: string; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<ServicePlanRecord>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  priceVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  durationDays: { type: Number, required: true, min: 1, max: 3660, validate: Number.isSafeInteger },
  modules: { type: [String], required: true, enum: MODULE_KEYS },
  active: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });
export const ServicePlanModel = model<ServicePlanRecord>("ServicePlan", schema);
