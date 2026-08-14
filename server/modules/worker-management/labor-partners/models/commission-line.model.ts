import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  settlementId: { type: Schema.Types.ObjectId, ref: "LaborPartnerSettlement", required: true, index: true },
  partnerId: { type: Schema.Types.ObjectId, ref: "LaborPartner", required: true, index: true },
  workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: function(this: any) { return this.scheme !== "adjustment"; }, index: true },
  referralId: { type: Schema.Types.ObjectId, ref: "WorkerReferral", required: function(this: any) { return this.scheme !== "adjustment"; }, index: true },
  lineKey: { type: String, required: true },
  scheme: { type: String, enum: ["official_monthly", "seasonal_hourly", "adjustment"], required: true },
  status: { type: String, enum: ["draft", "approved", "void"], default: "draft", index: true },
  officialMilestone: { type: Number, min: 1, max: 3, default: null },
  eligibleMinutes: { type: Number, default: null },
  hourlyRate: { type: Number, default: null },
  amount: { type: Number, required: true },
  sourceAttendanceLogIds: { type: [Schema.Types.ObjectId], default: [] },
  sourceContractId: { type: Schema.Types.ObjectId, default: null },
  policySnapshot: { type: Schema.Types.Mixed, required: true },
  explanation: { type: String, required: true },
}, { timestamps: true });

schema.index({ settlementId: 1, lineKey: 1 }, { unique: true });
schema.index({ referralId: 1, officialMilestone: 1, status: 1 });

export const LaborPartnerCommissionLineModel = (mongoose.models.LaborPartnerCommissionLine as mongoose.Model<any> | undefined) || mongoose.model("LaborPartnerCommissionLine", schema);
