import mongoose, { Schema } from "mongoose";

const FacebookFollowUpJobSchema = new Schema({
  companyCode: { type: String, required: true },
  pageId: { type: String, required: true },
  conversationId: { type: Schema.Types.ObjectId, ref: "FBConversation", required: true },
  sourceMessageId: { type: String, required: true },
  status: { type: String, enum: ["pending", "processing", "completed", "cancelled", "failed"], required: true },
  attempts: { type: Number, default: 0 },
  leaseToken: String,
  leaseUntil: Date,
  deliveryStartedAt: Date,
  completedAt: Date,
  lastError: { type: String, default: "" },
}, { timestamps: true });

FacebookFollowUpJobSchema.index({ companyCode: 1, conversationId: 1, sourceMessageId: 1 }, { unique: true });

export const FacebookFollowUpJobModel = mongoose.model("FacebookFollowUpJob", FacebookFollowUpJobSchema);
