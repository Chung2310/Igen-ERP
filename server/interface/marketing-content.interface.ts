import { Document } from "mongoose";

export interface IMarketingContent extends Document {
  title: string;
  channel: "Facebook" | "TikTok" | "LinkedIn" | "Instagram";
  contentType: string;
  status: "draft" | "pending" | "approved" | "scheduled" | "published";
  bodyText: string;
  outline?: string;
  imageUrl?: string;
  videoUrl?: string;
  generatedAt: Date;
  feedback?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  authorUid?: string;
  publishedAt?: Date;
  facebookPostId?: string;
  tiktokPostId?: string;
  tiktokShareUrl?: string;
  companyCode: string;
}
