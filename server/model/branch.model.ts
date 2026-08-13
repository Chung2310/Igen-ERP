import { Schema, model } from "mongoose";
import { IBranch } from "../interface/branch.interface";

const BranchSchema = new Schema<IBranch>({
  companyCode: { type: String, required: true, uppercase: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  managerId: { type: String, default: "" },
  pendingOwnerSetup: { type: Boolean, default: false, index: true },
  locationConfig: { type: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    allowedRadius: { type: Number, required: true, min: 1 },
    allowedPublicIps: { type: [String], required: true, validate: [(items: string[]) => items.length > 0, "At least one public IP is required"] },
  }, default: undefined, _id: false },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

BranchSchema.index({ companyCode: 1, code: 1 }, { unique: true });

export const BranchModel = model<IBranch>("Branch", BranchSchema);
