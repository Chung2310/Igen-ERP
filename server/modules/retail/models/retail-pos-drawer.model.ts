import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  branchId: { type: String, required: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
export const RetailPosDrawerModel = model("RetailPosDrawer", schema);
