import { Schema, model } from "mongoose";

const BranchTransferSchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  fromBranchId: { type: String, default: null },
  toBranchId: { type: String, required: true },
  performedBy: { type: String, required: true },
  reason: { type: String, default: "" },
  effectiveAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const BranchTransferModel = model("BranchTransfer", BranchTransferSchema);
