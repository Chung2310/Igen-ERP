import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  pageId: { type: String, required: true },
  commentId: { type: String, required: true },
  status: { type: String, enum: ["pending", "processing", "sending", "sent", "failed", "private_failed", "unknown", "skipped"], required: true },
  commentText: { type: String },
  senderId: { type: String },
  postId: { type: String },
  attemptCount: { type: Number, default: 0 },
  nextAttemptAt: { type: Date },
  publicReplyStatus: { type: String, enum: ["pending", "sending", "sent", "unknown"], default: "pending" },
  publicReplyText: { type: String },
  privateReplyText: { type: String },
  privateReplyStatus: { type: String, enum: ["none", "pending", "sending", "sent", "failed", "unknown"], default: "none" },
  privateReplyAttempts: { type: Number, default: 0 },
  privateReplyRetryable: { type: Boolean, default: false },
  lastError: { type: String },
  lockId: { type: String },
  lockExpiresAt: { type: Date },
  publicReplyId: { type: String },
}, { timestamps: true });
schema.index({ companyCode: 1, pageId: 1, commentId: 1 }, { unique: true });
schema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
schema.index({ status: 1, lockExpiresAt: 1 });
export const FacebookCommentDeliveryModel = model("FacebookCommentDelivery", schema);
