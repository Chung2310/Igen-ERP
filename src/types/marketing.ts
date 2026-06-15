export type MarketingSubTabType = "LÊN Ý TƯỞNG AI" | "DUYỆT NỘI DUNG" | "LỊCH ĐĂNG CONTENT" | "XƯỞNG NỘI DUNG";

export interface MarketingConcept {
  title: string;
  matchPercent: number;
  summary: string;
  channels: string[];
  suggestedContent: string;
  hashtags: string[];
}

export interface ContentApprovalCard {
  id: string;
  title: string;
  channel: "Facebook" | "TikTok" | "LinkedIn" | "Instagram" | "Zalo";
  contentType: string;
  status: "draft" | "pending" | "approved" | "scheduled" | "published" | "failed";
  bodyText: string;
  outline?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaPrompt?: string;
  generatedAt: string;
  feedback?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  authorUid?: string;
  publishedAt?: string;
  facebookPostId?: string;
  tiktokPostId?: string;
  tiktokShareUrl?: string;
  integrationId?: string;
  publishError?: string;
}

export interface PublishEvent {
  id: string;
  date: number; // day in October 2026
  title: string;
  type: string;
  channel: string;
  status: "Draft" | "Approved" | "Published";
}
