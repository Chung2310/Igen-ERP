import { Schema, model } from "mongoose";

const schema = new Schema({
  companyCode: { type: String, required: true },
  pageId: { type: String, required: true },
  commentId: { type: String, required: true },
  status: { type: String, enum: ["processing", "sending", "sent", "failed", "unknown"], required: true },
  lockId: { type: String },
  lockExpiresAt: { type: Date },
  publicReplyId: { type: String },
}, { timestamps: true });
schema.index({ companyCode: 1, pageId: 1, commentId: 1 }, { unique: true });
export const FacebookCommentDeliveryModel = model("FacebookCommentDelivery", schema);
