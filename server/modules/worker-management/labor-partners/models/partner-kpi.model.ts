import mongoose, { Schema, type Model } from "mongoose";
import type { IPartnerKpi } from "../interfaces/partner-kpi.interface";

const schema = new Schema<IPartnerKpi>({
  companyCode: { type: String, required: true, trim: true, index: true },
  branchId: { type: String, trim: true, index: true },
  partnerId: { type: Schema.Types.ObjectId, ref: "LaborPartner", required: true, index: true },
  periodStart: { type: String, required: true },
  periodEnd: { type: String, required: true },
  targetReferrals: { type: Number, required: true, min: 0, max: 100000 },
  note: { type: String, default: "" },
  createdBy: { type: Schema.Types.Mixed, default: null },
  updatedBy: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });

schema.index({ companyCode: 1, branchId: 1, partnerId: 1, periodStart: 1 }, { unique: true });

export const LaborPartnerKpiModel: Model<IPartnerKpi> = (mongoose.models.LaborPartnerKpi as Model<IPartnerKpi> | undefined)
  || mongoose.model<IPartnerKpi>("LaborPartnerKpi", schema);
