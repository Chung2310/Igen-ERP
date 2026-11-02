import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  enabled: { type: Boolean, required: true, default: false },
  day: { type: Number, required: true, min: 1, max: 31 },
  hour: { type: Number, required: true, min: 0, max: 23 },
  minute: { type: Number, required: true, min: 0, max: 59 },
  periodOffset: { type: Number, required: true, enum: [0, -1] },
  version: { type: Number, required: true, default: 1 },
  effectiveFrom: { type: Date, required: true },
  updatedBy: { type: String, required: true },
  lastAttemptAt: Date,
}, { timestamps: true, versionKey: false });
schema.index({ companyCode: 1, branchId: 1 }, { unique: true });
schema.index({ enabled: 1 });
export const PayrollPublicationScheduleModel = model("PayrollPublicationSchedule", schema);
