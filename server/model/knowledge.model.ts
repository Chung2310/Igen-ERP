import { model, Schema, Types } from "mongoose";

const aclFields = {
  visibility: { type: String, enum: ["company", "restricted"], default: "company" },
  allowedUserIds: { type: [String], default: [] },
  allowedRoles: { type: [String], default: [] },
};

const KnowledgeDocumentSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, index: true },
  sourceType: { type: String, enum: ["drive", "manual", "resource"], required: true },
  driveFileId: { type: String, default: "", index: true },
  sourceTitle: { type: String, required: true },
  sourceUrl: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  status: { type: String, enum: ["active", "syncing", "failed"], default: "active" },
  version: { type: Number, default: 1 },
  contentHash: { type: String, required: true },
  modifiedTime: Date,
  ...aclFields,
  createdBy: { type: String, default: "" },
}, { timestamps: true });

const KnowledgeChunkSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "KnowledgeDocument", required: true, index: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  ...aclFields,
  version: { type: Number, default: 1 },
}, { timestamps: true });

KnowledgeChunkSchema.index({ companyCode: 1, documentId: 1, chunkIndex: 1 }, { unique: true });
KnowledgeChunkSchema.index({ companyCode: 1, updatedAt: -1 });
KnowledgeDocumentSchema.index({ companyCode: 1, driveFileId: 1 });

export interface KnowledgeUserAcl { id: string; role: string }
export interface KnowledgeDocumentRecord { _id: Types.ObjectId; companyCode: string; sourceType: "drive" | "manual" | "resource"; driveFileId: string; sourceTitle: string; sourceUrl: string; mimeType: string; status: "active" | "syncing" | "failed"; version: number; contentHash: string; modifiedTime?: Date; visibility: "company" | "restricted"; allowedUserIds: string[]; allowedRoles: string[]; createdBy: string }

export const KnowledgeDocumentModel = model("KnowledgeDocument", KnowledgeDocumentSchema);
export const KnowledgeChunkModel = model("KnowledgeChunk", KnowledgeChunkSchema);
