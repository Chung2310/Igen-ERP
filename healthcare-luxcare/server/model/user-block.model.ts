import { Schema, model } from "mongoose";
import { IUserBlock } from "../interface/user-block.interface";

const UserBlockSchema = new Schema<IUserBlock>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyCode: { type: String, required: true, index: true },
    reason: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  },
);

// Prevent duplicate blocks
UserBlockSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });

export const UserBlockModel = model<IUserBlock>("UserBlock", UserBlockSchema);
