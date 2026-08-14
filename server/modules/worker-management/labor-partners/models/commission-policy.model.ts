import mongoose, { Schema, type Model } from "mongoose";
import type { ICommissionPolicy } from "../interfaces/commission-policy.interface";

const actorSchema = new Schema({ id: { type: String, required: true }, name: { type: String, default: "" }, email: { type: String, default: "" } }, { _id: false });
const milestoneSchema = new Schema({
  month: { type: Number, required: true, min: 1, max: 3 },
  amount: { type: Number, required: true, min: 0 },
  eligibilityRule: { type: String, enum: ["contract_active", "manual_confirmation", "attendance_threshold"], required: true },
  minWorkedDays: { type: Number, min: 0, default: null },
  minWorkedHours: { type: Number, min: 0, default: null },
}, { _id: false });
const tierSchema = new Schema({ minHours: { type: Number, required: true, min: 0 }, maxHours: { type: Number, min: 0, default: null }, hourlyRate: { type: Number, required: true, min: 0 } }, { _id: false });
const schema = new Schema<ICommissionPolicy>({
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  version: { type: Number, required: true, min: 1 },
  effectiveFrom: { type: String, required: true },
  effectiveTo: { type: String, default: null },
  status: { type: String, enum: ["draft", "active", "retired"], default: "draft", index: true },
  settlementCycle: {
    type: { type: String, enum: ["calendar_month", "cutoff_day"], required: true },
    cutoffDay: { type: Number, min: 1, max: 28, default: null },
  },
  official: {
    enabled: { type: Boolean, required: true, default: false },
    maxMonths: { type: Number, min: 1, max: 3, default: null },
    milestones: { type: [milestoneSchema], default: [] },
  },
  seasonal: {
    enabled: { type: Boolean, required: true, default: false },
    aggregationScope: { type: String, enum: ["partner_period", "partner_project_period"], default: null },
    tierMode: { type: String, enum: ["flat", "progressive"], default: null },
    minHoursPerWorker: { type: Number, min: 0, default: null },
    maxEligibleHoursPerWorker: { type: Number, min: 0, default: null },
    hourRounding: { unitMinutes: { type: Number, enum: [1, 5, 15, 30, 60], default: 1 }, mode: { type: String, enum: ["floor", "nearest", "ceil"], default: "nearest" } },
    moneyRounding: { unitVnd: { type: Number, min: 1, default: 1 }, mode: { type: String, enum: ["floor", "nearest", "ceil"], default: "nearest" } },
    tiers: { type: [tierSchema], default: [] },
  },
  createdBy: { type: actorSchema, required: true },
  activatedBy: { type: actorSchema, default: null },
  activatedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ companyCode: 1, branchId: 1, name: 1, version: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, status: 1, effectiveFrom: 1 });

export const CommissionPolicyModel: Model<ICommissionPolicy> = (mongoose.models.LaborPartnerCommissionPolicy as Model<ICommissionPolicy> | undefined) || mongoose.model<ICommissionPolicy>("LaborPartnerCommissionPolicy", schema);
