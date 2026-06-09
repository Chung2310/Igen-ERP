import { Schema, model } from "mongoose";
import { IMarketingContent } from "../interface/marketing-content.interface";

const MarketingContentSchema = new Schema<IMarketingContent>({
  title: { type: String, required: true, index: true },
  channel: { type: String, enum: ["Facebook", "TikTok", "LinkedIn", "Instagram"], required: true, index: true },
  contentType: { type: String, required: true },
  status: { type: String, enum: ["draft", "pending", "approved", "scheduled", "published"], default: "draft", index: true },
  bodyText: { type: String, required: true },
  outline: { type: String },
  imageUrl: { type: String },
  videoUrl: { type: String },
  generatedAt: { type: Date, default: Date.now, index: true },
  feedback: { type: String },
  scheduledDate: { type: String },
  scheduledTime: { type: String },
  authorUid: { type: String, index: true },
  publishedAt: { type: Date },
  facebookPostId: { type: String },
  tiktokPostId: { type: String },
  tiktokShareUrl: { type: String },
  companyCode: { type: String, required: true, index: true },
});

export const MarketingContentModel = model<IMarketingContent>("MarketingContent", MarketingContentSchema);
