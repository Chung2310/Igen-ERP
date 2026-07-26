import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true, index: true },
  logId: { type: Schema.Types.ObjectId, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  actorId: { type: String, required: true },
  reason: { type: String, required: true },
  before: { type: Schema.Types.Mixed, required: true },
  after: { type: Schema.Types.Mixed, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const TimekeepingAdjustmentAuditModel = model("TimekeepingAdjustmentAudit", schema);
