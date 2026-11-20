import { Schema, model, type Document } from "mongoose";
import type { ResourceStorageProvider } from "./resource-item.model";

export interface IPendingUpload extends Document {
  token: string;
  companyCode: string;
  branchId?: string;
  actorId: string;
  actorName?: string;
  sourceType: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
  storageProvider: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  status: "pending" | "finalized";
  finalizedResourceId?: string;
  createdAt: Date;
  expiresAt: Date;
}

const PendingUploadSchema = new Schema<IPendingUpload>({
  token: { type: String, required: true, unique: true, index: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, default: undefined, index: true },
  actorId: { type: String, required: true, index: true },
  actorName: { type: String, default: "" },
  sourceType: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileUrl: { type: String, required: true },
  mimeType: { type: String, default: "" },
  size: { type: Number, default: 0 },
  storageProvider: { type: String, enum: ["cloudinary", "google-drive", "local"], required: true },
  storagePublicId: { type: String, default: undefined },
  storageResourceType: { type: String, default: undefined },
  status: { type: String, enum: ["pending", "finalized"], default: "pending", index: true },
  finalizedResourceId: { type: String, default: undefined },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true, index: true },
});

PendingUploadSchema.index({ status: 1, expiresAt: 1 });

export const PendingUploadModel = model<IPendingUpload>("PendingUpload", PendingUploadSchema);
