import { Schema, model } from "mongoose";
import type { IRoom } from "../interface/room.interface";

const RoomSchema = new Schema<IRoom>(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    branchId: { type: String, required: true, trim: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["clinic", "office", "storage", "treatment", "meeting", "other"],
      default: "other",
      trim: true,
    },
    floor: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

RoomSchema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
RoomSchema.index({ companyCode: 1, branchId: 1, isActive: 1 });

export const RoomModel = model<IRoom>("Room", RoomSchema);
