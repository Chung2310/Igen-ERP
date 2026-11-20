export const BLOG_REPORT_REASONS = {
  spam: "Spam / Tin rác",
  harassment: "Quấy rối / Đe dọa",
  inappropriate: "Nội dung không phù hợp",
  fraud: "Lừa đảo / Giả mạo",
  other: "Khác",
} as const;
export type BlogReportReason = keyof typeof BLOG_REPORT_REASONS;
export const BLOG_REPORT_STATUSES = ["pending", "reviewed", "resolved", "dismissed"] as const;
export type BlogReportStatus = (typeof BLOG_REPORT_STATUSES)[number];
export interface BlogBlockedAuthor {
  authorId: string;
  authorName: string;
  createdAt: string;
}
export interface BlogReportItem {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  reporterId: string;
  title: string;
  snippet: string;
  reason: BlogReportReason;
  details: string;
  status: BlogReportStatus;
  notes: string;
  createdAt: string;
  moderatedAt?: string;
  postRemoved: boolean;
  post?: { content: string; attachments: Array<{ url: string; name?: string; type?: string }> };
}
export interface BlogReportPage {
  items: BlogReportItem[];
  total: number;
  page: number;
  limit: number;
}
