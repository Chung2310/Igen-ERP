import { Document, Types } from "mongoose";

export type ChatReportReason = "spam" | "harassment" | "inappropriate" | "fraud" | "other";
export type ChatReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export interface IChatReport extends Document {
  companyCode: string;
  reporterId: Types.ObjectId | string;
  reportedUserId: Types.ObjectId | string;
  roomId: Types.ObjectId | string;
  messageId?: Types.ObjectId | string;
  messageSnippet?: string;
  reason: ChatReportReason;
  details?: string;
  status: ChatReportStatus;
  resolvedBy?: Types.ObjectId | string;
  resolvedAt?: Date;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
