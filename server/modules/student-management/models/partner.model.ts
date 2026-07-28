import { Schema, model } from "mongoose";
import { IPartner } from "../interfaces/partner.interface";

const payoutSchema = new Schema({
  id: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  method: { type: String, enum: ["Tiền mặt", "Chuyển khoản"], required: true },
  note: { type: String, default: "" },
});

const partnerSchema = new Schema<IPartner>(
  {
    customFields: { type: Schema.Types.Mixed, default: {} },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    commissionType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
      default: "fixed",
    },
    commissionValue: { type: Number, required: true, default: 0 },
    bankName: { type: String, default: "" },
    bankAccountNo: { type: String, default: "" },
    bankAccountName: { type: String, default: "" },
    isActive: { type: Boolean, required: true, default: true },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    notes: { type: String, default: "" },
    payoutHistory: { type: [payoutSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// Add unique compound index for phone and ownerId (so phone numbers can only be registered once per center)
partnerSchema.index({ phone: 1, ownerId: 1 }, { unique: true });

export const Partner = model<IPartner>("Partner", partnerSchema);
