import { Schema, model, Document } from "mongoose";

/**
 * ResourceItem — mục tài nguyên trong "Quản lý tài nguyên".
 * Dùng chung cho 2 phần:
 *  - section = "local": file explorer nội bộ (folder + file upload lên Cloudinary)
 *  - section = "drive": tài liệu Google Drive (lưu link chia sẻ)
 * Cấu trúc cây nhờ parentId (null = thư mục gốc của section).
 */
export interface IResourceItem extends Document {
  companyCode: string;
  section: "local" | "drive";
  type: "folder" | "file";
  name: string;
  parentId: string | null;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  driveType?: "folder" | "document" | "spreadsheet" | "presentation" | "pdf" | "file";
  creatorUid?: string;
  creatorName?: string;
  isFixed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceItemSchema = new Schema<IResourceItem>(
  {
    companyCode: { type: String, required: true, index: true },
    section: { type: String, enum: ["local", "drive"], required: true, index: true },
    type: { type: String, enum: ["folder", "file"], required: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: String, default: null, index: true },
    fileUrl: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    driveType: {
      type: String,
      enum: ["folder", "document", "spreadsheet", "presentation", "pdf", "file"],
      default: "file",
    },
    creatorUid: { type: String, default: "" },
    creatorName: { type: String, default: "" },
    isFixed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Truy vấn thường xuyên: liệt kê theo doanh nghiệp + phần + thư mục cha
ResourceItemSchema.index({ companyCode: 1, section: 1, parentId: 1 });

export const ResourceItemModel = model<IResourceItem>("ResourceItem", ResourceItemSchema);
