import { Schema, model, Document, Types } from "mongoose";

export interface IBlogAttachment {
  url: string;
  name: string;
  type?: string;
  size?: number;
}

export interface IBlogPost extends Document {
  companyCode: string;
  authorId: Types.ObjectId;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  title?: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  attachmentsPublic?: boolean;
  attachments: IBlogAttachment[];
  likes: Types.ObjectId[];
  viewCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    companyCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    authorRole: {
      type: String,
      default: "Ban Biên Tập",
      trim: true,
    },
    authorAvatar: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 300,
    },
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 10000,
    },
    tags: {
      type: [String],
      default: ["Thông báo"],
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    // No schema default: documents without the flag retain legacy public behavior.
    attachmentsPublic: { type: Boolean },
    attachments: [
      {
        url: { type: String, required: true },
        name: { type: String, default: "" },
        type: { type: String, default: "" },
        size: { type: Number, default: 0 },
      },
    ],
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

BlogPostSchema.index({ companyCode: 1, isDeleted: 1, createdAt: 1 });
BlogPostSchema.index({ companyCode: 1, isPinned: 1, createdAt: -1 });

export const BlogPostModel = model<IBlogPost>("BlogPost", BlogPostSchema);
