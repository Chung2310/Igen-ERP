import mongoose, { Schema } from "mongoose";

const actorSchema = new Schema({ id: String, name: String, email: String }, { _id: false });
const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  partnerId: { type: Schema.Types.ObjectId, ref: "LaborPartner", required: true, index: true },
  sourceSettlementId: { type: Schema.Types.ObjectId, ref: "LaborPartnerSettlement", default: null, index: true },
  settlementKey: { type: String, required: true, index: true },
  revision: { type: Number, required: true, default: 1 },
  periodStart: { type: String, required: true },
  periodEnd: { type: String, required: true },
  cutoffAt: { type: Date, required: true },
  status: { type: String, enum: ["draft", "calculated", "approved", "partially_paid", "paid", "void"], default: "draft", index: true },
  officialAmount: { type: Number, required: true, default: 0 },
  seasonalMinutes: { type: Number, required: true, default: 0 },
  seasonalAmount: { type: Number, required: true, default: 0 },
  adjustmentAmount: { type: Number, required: true, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  paidAmount: { type: Number, required: true, default: 0 },
  balanceAmount: { type: Number, required: true, default: 0 },
  manualEntries: { type: [Schema.Types.Mixed], default: [] },
  policySnapshots: { type: [Schema.Types.Mixed], default: [] },
  warnings: { type: [Schema.Types.Mixed], default: [] },
  calculatedBy: { type: actorSchema, default: null },
  calculatedAt: { type: Date, default: null },
  approvedBy: { type: actorSchema, default: null },
  approvedAt: { type: Date, default: null },
  voidReason: { type: String, default: "" },
  version: { type: Number, required: true, default: 1 },
}, { timestamps: true });

schema.index({ settlementKey: 1, revision: 1 }, { unique: true });
schema.index({ companyCode: 1, branchId: 1, partnerId: 1, periodStart: 1, periodEnd: 1 });

export const LaborPartnerSettlementModel = (mongoose.models.LaborPartnerSettlement as mongoose.Model<any> | undefined) || mongoose.model("LaborPartnerSettlement", schema);
