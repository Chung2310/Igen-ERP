import { Schema, model, Types } from "mongoose";
import {
  BLOG_REPORT_REASONS,
  BLOG_REPORT_STATUSES,
  type BlogReportReason,
  type BlogReportStatus,
} from "../../shared/blog-moderation";
export interface BlogReportRecord {
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  reporterId: Types.ObjectId;
  companyCode: string;
  authorName: string;
  title: string;
  snippet: string;
  reason: BlogReportReason;
  details: string;
  status: BlogReportStatus;
  notes: string;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  postRemoved: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<BlogReportRecord>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "BlogPost", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyCode: { type: String, required: true },
    authorName: { type: String, default: "", maxlength: 300 },
    title: { type: String, default: "", maxlength: 300 },
    snippet: { type: String, default: "", maxlength: 500 },
    reason: { type: String, enum: Object.keys(BLOG_REPORT_REASONS), required: true },
    details: { type: String, default: "", maxlength: 2000 },
    status: { type: String, enum: BLOG_REPORT_STATUSES, default: "pending" },
    notes: { type: String, default: "", maxlength: 2000 },
    moderatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    moderatedAt: Date,
    postRemoved: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ postId: 1, reporterId: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1 });
export const BlogReportModel = model<BlogReportRecord>("BlogReport", schema);
