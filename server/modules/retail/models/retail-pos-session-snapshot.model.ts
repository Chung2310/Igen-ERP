import { Schema, model } from "mongoose";

// One document per order keeps large sessions below MongoDB's document limit.
const schema = new Schema({
  companyCode: { type: String, required: true }, branchId: { type: String, required: true },
  shiftId: { type: String, required: true }, orderId: { type: String, required: true },
  order: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, shiftId: 1, orderId: 1 }, { unique: true });
export const RetailPosSessionSnapshotModel = model("RetailPosSessionSnapshot", schema);
