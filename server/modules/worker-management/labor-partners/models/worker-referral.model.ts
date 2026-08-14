import mongoose, { Schema, type Model } from "mongoose";
import type { IWorkerReferral } from "../interfaces/worker-referral.interface";

const schema = new Schema<IWorkerReferral>({
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true, index: true },
  partnerId: { type: Schema.Types.ObjectId, ref: "LaborPartner", required: true, index: true },
  workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true, index: true },
  policyId: { type: Schema.Types.ObjectId, ref: "LaborPartnerCommissionPolicy", required: true, index: true },
  commissionScheme: { type: String, enum: ["official_monthly", "seasonal_hourly"], required: true },
  referredAt: { type: String, required: true },
  employmentStartDate: { type: String, required: true },
  effectiveFrom: { type: String, required: true },
  effectiveTo: { type: String, default: null },
  status: { type: String, enum: ["pending", "active", "ended", "rejected"], default: "pending", index: true },
  confirmationSource: { type: String, enum: ["contract", "manual", "attendance"], default: "manual" },
  confirmedBy: { type: String, default: "" },
  confirmedAt: { type: Date, default: null },
  note: { type: String, default: "" },
}, { timestamps: true });

schema.index({ companyCode: 1, branchId: 1, workerId: 1, status: 1 });
schema.index({ partnerId: 1, effectiveFrom: 1, effectiveTo: 1 });

export const WorkerReferralModel: Model<IWorkerReferral> = (mongoose.models.WorkerReferral as Model<IWorkerReferral> | undefined) || mongoose.model<IWorkerReferral>("WorkerReferral", schema);
