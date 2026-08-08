import { Schema, model, Document } from "mongoose";

/**
 * ResourceItem — mục tài nguyên trong "Quản lý tài nguyên".
 * Dùng chung cho 2 phần:
 *  - section = "local": file explorer nội bộ (folder + file upload lên Cloudinary)
 *  - section = "drive": tài liệu Google Drive (lưu link chia sẻ)
 * Cấu trúc cây nhờ parentId (null = thư mục gốc của section).
 */
export interface IResourceShare {
  targetId: string;
  targetType: "user" | "room";
  targetName: string;
}

export type ResourceManagedType = "user" | "system";
export type ResourceStorageProvider = "cloudinary" | "google-drive" | "local";
export type ResourceStorageAccess = "public" | "authenticated";

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
  isDeleted?: boolean;
  deletedAt?: Date | null;
  roomId?: string | null;
  shares?: IResourceShare[];
  managedType: ResourceManagedType;
  systemFolderKey?: string;
  sourceKey?: string;
  sourceType?: string;
  sourceModule?: string;
  sourceGroup?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEntityLabel?: string;
  sourceRecordId?: string;
  sourceField?: string;
  sourceRoute?: string;
  branchId?: string;
  requiredPermissions?: string[];
  sourceAudienceIds?: string[];
  storageProvider?: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  storageAccess?: ResourceStorageAccess;
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
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
    roomId: { type: String, default: null, index: true },
    shares: {
      type: [
        {
          targetId: { type: String, required: true },
          targetType: { type: String, enum: ["user", "room"], required: true },
          targetName: { type: String, default: "" },
        },
      ],
      default: [],
    },
    managedType: { type: String, enum: ["user", "system"], default: "user", index: true },
    systemFolderKey: { type: String, default: undefined },
    sourceKey: { type: String, default: undefined },
    sourceType: { type: String, default: undefined, index: true },
    sourceModule: { type: String, default: undefined, index: true },
    sourceGroup: { type: String, default: undefined },
    sourceEntityType: { type: String, default: undefined },
    sourceEntityId: { type: String, default: undefined, index: true },
    sourceEntityLabel: { type: String, default: undefined },
    sourceRecordId: { type: String, default: undefined, index: true },
    sourceField: { type: String, default: undefined },
    sourceRoute: { type: String, default: undefined },
    branchId: { type: String, default: undefined, index: true },
    requiredPermissions: { type: [String], default: [] },
    sourceAudienceIds: { type: [String], default: undefined },
    storageProvider: { type: String, enum: ["cloudinary", "google-drive", "local"], default: undefined },
    storagePublicId: { type: String, default: undefined },
    storageResourceType: { type: String, default: undefined },
    storageAccess: { type: String, enum: ["public", "authenticated"], default: undefined },
  },
  { timestamps: true }
);

// Truy vấn thường xuyên: liệt kê theo doanh nghiệp + phần + thư mục cha
ResourceItemSchema.index({ companyCode: 1, section: 1, parentId: 1 });
ResourceItemSchema.index(
  { companyCode: 1, systemFolderKey: 1 },
  { unique: true, partialFilterExpression: { systemFolderKey: { $type: "string" } } },
);
ResourceItemSchema.index(
  { companyCode: 1, sourceKey: 1 },
  { unique: true, partialFilterExpression: { sourceKey: { $type: "string" } } },
);
ResourceItemSchema.index({ companyCode: 1, sourceType: 1, sourceRecordId: 1, sourceField: 1, isDeleted: 1 });

export const ResourceItemModel = model<IResourceItem>("ResourceItem", ResourceItemSchema);
