import { Schema, model } from "mongoose";
import { IChatReport } from "../interface/chat-report.interface";

const ChatReportSchema = new Schema<IChatReport>(
  {
    companyCode: { type: String, required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true },
    messageId: { type: Schema.Types.ObjectId, ref: "ChatMessage", default: null },
    messageSnippet: { type: String, default: "" },
    reason: {
      type: String,
      enum: ["spam", "harassment", "inappropriate", "fraud", "other"],
      required: true,
      index: true,
    },
    details: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
    adminNotes: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

ChatReportSchema.index({ companyCode: 1, status: 1, createdAt: -1 });

export const ChatReportModel = model<IChatReport>("ChatReport", ChatReportSchema);
