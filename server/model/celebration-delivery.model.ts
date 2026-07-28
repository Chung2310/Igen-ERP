import { Schema, model } from "mongoose";

const CelebrationDeliverySchema = new Schema({
  companyCode: { type: String, required: true, index: true },
  eventType: { type: String, enum: ["birthday", "holiday"], required: true },
  eventDate: { type: String, required: true },
  eventKey: { type: String, required: true },
  recipientUserId: { type: String },
  recipientEmail: { type: String, required: true },
  subject: { type: String, required: true },
  status: { type: String, enum: ["pending", "sending", "sent", "failed", "skipped"], default: "pending", index: true },
  attempts: { type: Number, default: 0 },
  error: { type: String, default: "" },
  messageId: { type: String, default: "" },
  sentAt: { type: Date },
}, { timestamps: true });

CelebrationDeliverySchema.index({ companyCode: 1, eventType: 1, eventDate: 1, eventKey: 1, recipientEmail: 1 }, { unique: true });
export const CelebrationDeliveryModel = model("CelebrationDelivery", CelebrationDeliverySchema);
