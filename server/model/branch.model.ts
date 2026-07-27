import { Schema, model } from "mongoose";
import { IBranch } from "../interface/branch.interface";

const BranchSchema = new Schema<IBranch>({
  companyCode: { type: String, required: true, uppercase: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  managerId: { type: String, default: "" },
  locationConfig: { type: Schema.Types.Mixed, default: undefined },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

BranchSchema.index({ companyCode: 1, code: 1 }, { unique: true });

export const BranchModel = model<IBranch>("Branch", BranchSchema);
