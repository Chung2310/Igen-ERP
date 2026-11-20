import { Schema, model } from "mongoose";
// Identity only: never preserve credentials, sessions or login capability.
const schema = new Schema({
  userId: { type: String, required: true },
  companyCode: { type: String, required: true },
  displayName: String,
  branchId: String,
  parentId: String,
  role: String,
  deletedAt: { type: Date, required: true },
});
schema.index({ companyCode: 1, userId: 1 }, { unique: true });
export const HistoricalUserModel = model("HistoricalUser", schema);
