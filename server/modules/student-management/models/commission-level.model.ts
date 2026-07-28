import { Schema, model } from "mongoose";
import { ICommissionLevel } from "../interfaces/commission-level.interface";

const commissionLevelSchema = new Schema<ICommissionLevel>(
  {
    name: { type: String, required: true, trim: true },
    minTuition: { type: Number, required: true, default: 0 },
    commissionRate: { type: Number, required: true, default: 0 },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  },
  {
    timestamps: true,
  }
);

// Ensure name is unique per center (ownerId)
commissionLevelSchema.index({ name: 1, ownerId: 1 }, { unique: true });

export const CommissionLevel = model<ICommissionLevel>("CommissionLevel", commissionLevelSchema);
