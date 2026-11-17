import mongoose, { Schema, type Document, type Model } from "mongoose";

export type LegalJurisdiction = "central" | "ministry" | "local";
export type LegalStatus = "effective" | "partially_effective" | "upcoming" | "expired" | "repealed" | "unknown";

export interface ILegalDocument extends Document {
  companyCode: string;
  sourceSystem: "vbpl" | "uploaded";
  sourceDocumentId?: string;
  symbol: string;
  title: string;
  issuingAuthority: string;
  jurisdiction: LegalJurisdiction;
  province?: string;
  field?: string;
  issueDate?: Date;
  effectiveDate?: Date;
  expiryDate?: Date;
  status: LegalStatus;
  sourceUrl: string;
  relatedDocuments: Array<{ symbol: string; relation: "amends" | "consolidates" | "related"; affectedArticles: string[]; reviewStatus: "needs_review" | "verified" }>;
  currentVersionId?: mongoose.Types.ObjectId;
  reviewRequired: boolean;
  createdBy: string;
}

export interface ILegalVersion extends Document {
  companyCode: string;
  documentId: mongoose.Types.ObjectId;
  versionNumber: number;
  sourceUrl: string;
  sourceModifiedAt?: Date;
  downloadedAt: Date;
  originalFileId?: mongoose.Types.ObjectId;
  originalFilename: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  extractedText: string;
  textHash: string;
  extractionStatus: "indexed" | "needs_review" | "failed";
  lifecycleStatus: "current" | "pending_review" | "superseded";
  isConsolidated: boolean;
  sourceStatus?: LegalStatus;
  sourceEffectiveDate?: Date;
  sourceExpiryDate?: Date;
  supersedesVersionId?: mongoose.Types.ObjectId;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  createdBy: string;
}

export interface ILegalChunk extends Document {
  companyCode: string;
  documentId: mongoose.Types.ObjectId;
  versionId: mongoose.Types.ObjectId;
  chunkIndex: number;
  text: string;
  embedding: number[];
  chapter?: string;
  article?: string;
  clause?: string;
  point?: string;
  issuingAuthority: string;
  field?: string;
  status: LegalStatus;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  sourceUrl: string;
}

export interface ILegalReviewTask extends Document {
  companyCode: string;
  documentId: mongoose.Types.ObjectId;
  versionId: mongoose.Types.ObjectId;
  taskType: "extraction" | "version_change" | "amendment";
  status: "pending" | "resolved" | "rejected";
  reason: string;
  details: Record<string, unknown>;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILegalSyncState extends Document {
  companyCode: string;
  status: "idle" | "running" | "completed" | "failed";
  configuredScopes: number;
  startedAt?: Date;
  completedAt?: Date;
  lastSuccessAt?: Date;
  pagesScanned: number;
  documentsFound: number;
  documentsAdded: number;
  revisionsAdded: number;
  unchanged: number;
  reviewRequired: number;
  missingOriginal: number;
  lastError: string;
  cursors: Record<string, number>;
}

const relatedDocumentSchema = new Schema({
  symbol: { type: String, required: true, trim: true },
  relation: { type: String, enum: ["amends", "consolidates", "related"], required: true },
  affectedArticles: { type: [String], default: [] },
  reviewStatus: { type: String, enum: ["needs_review", "verified"], default: "needs_review" },
}, { _id: false });

const LegalDocumentSchema = new Schema<ILegalDocument>({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  sourceSystem: { type: String, enum: ["vbpl", "uploaded"], required: true, default: "uploaded" },
  sourceDocumentId: { type: String, trim: true, default: "" },
  symbol: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  issuingAuthority: { type: String, required: true, trim: true },
  jurisdiction: { type: String, enum: ["central", "ministry", "local"], required: true },
  province: { type: String, trim: true, default: "" },
  field: { type: String, trim: true, default: "" },
  issueDate: { type: Date },
  effectiveDate: { type: Date },
  expiryDate: { type: Date },
  status: { type: String, enum: ["effective", "partially_effective", "upcoming", "expired", "repealed", "unknown"], default: "unknown", index: true },
  sourceUrl: { type: String, trim: true, default: "" },
  relatedDocuments: { type: [relatedDocumentSchema], default: [] },
  currentVersionId: { type: Schema.Types.ObjectId, ref: "LegalReferenceVersion" },
  reviewRequired: { type: Boolean, default: false, index: true },
  createdBy: { type: String, default: "" },
}, { timestamps: true });

LegalDocumentSchema.index({ companyCode: 1, symbol: 1 }, { unique: true });
LegalDocumentSchema.index({ companyCode: 1, jurisdiction: 1, status: 1, effectiveDate: -1 });
LegalDocumentSchema.index({ companyCode: 1, issuingAuthority: 1, field: 1 });

const LegalVersionSchema = new Schema<ILegalVersion>({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "LegalReferenceDocument", required: true, index: true },
  versionNumber: { type: Number, required: true },
  sourceUrl: { type: String, trim: true, default: "" },
  sourceModifiedAt: { type: Date },
  downloadedAt: { type: Date, required: true, default: Date.now },
  originalFileId: { type: Schema.Types.ObjectId },
  originalFilename: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  byteLength: { type: Number, required: true, min: 1 },
  sha256: { type: String, required: true, index: true },
  extractedText: { type: String, default: "" },
  textHash: { type: String, default: "" },
  extractionStatus: { type: String, enum: ["indexed", "needs_review", "failed"], required: true },
  lifecycleStatus: { type: String, enum: ["current", "pending_review", "superseded"], required: true, default: "pending_review", index: true },
  isConsolidated: { type: Boolean, default: false },
  sourceStatus: { type: String, enum: ["effective", "partially_effective", "upcoming", "expired", "repealed", "unknown"] },
  sourceEffectiveDate: Date,
  sourceExpiryDate: Date,
  supersedesVersionId: { type: Schema.Types.ObjectId, ref: "LegalReferenceVersion" },
  effectiveFrom: { type: Date },
  effectiveTo: { type: Date },
  createdBy: { type: String, default: "" },
}, { timestamps: true, minimize: false });

LegalVersionSchema.index({ companyCode: 1, documentId: 1, versionNumber: 1 }, { unique: true });
LegalVersionSchema.index({ companyCode: 1, documentId: 1, sha256: 1 });

const LegalChunkSchema = new Schema<ILegalChunk>({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "LegalReferenceDocument", required: true, index: true },
  versionId: { type: Schema.Types.ObjectId, ref: "LegalReferenceVersion", required: true, index: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], default: [] },
  chapter: { type: String, default: "" },
  article: { type: String, default: "" },
  clause: { type: String, default: "" },
  point: { type: String, default: "" },
  issuingAuthority: { type: String, required: true, index: true },
  field: { type: String, default: "", index: true },
  status: { type: String, enum: ["effective", "partially_effective", "upcoming", "expired", "repealed", "unknown"], required: true, index: true },
  effectiveFrom: { type: Date, index: true },
  effectiveTo: { type: Date, index: true },
  sourceUrl: { type: String, default: "" },
}, { timestamps: true });

LegalChunkSchema.index({ companyCode: 1, documentId: 1, versionId: 1, chunkIndex: 1 }, { unique: true });
LegalChunkSchema.index({ companyCode: 1, issuingAuthority: 1, field: 1, status: 1, effectiveFrom: 1, effectiveTo: 1 });
LegalChunkSchema.index({ text: "text" }, { name: "legal_reference_text_search", default_language: "none" });

const LegalReviewTaskSchema = new Schema<ILegalReviewTask>({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  documentId: { type: Schema.Types.ObjectId, ref: "LegalReferenceDocument", required: true, index: true },
  versionId: { type: Schema.Types.ObjectId, ref: "LegalReferenceVersion", required: true, index: true },
  taskType: { type: String, enum: ["extraction", "version_change", "amendment"], required: true },
  status: { type: String, enum: ["pending", "resolved", "rejected"], default: "pending", index: true },
  reason: { type: String, required: true },
  details: { type: Schema.Types.Mixed, default: {} },
  resolvedBy: { type: String, default: "" },
  resolvedAt: { type: Date },
}, { timestamps: true });

LegalReviewTaskSchema.index({ companyCode: 1, status: 1, createdAt: -1 });

const LegalSyncStateSchema = new Schema<ILegalSyncState>({
  companyCode: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
  status: { type: String, enum: ["idle", "running", "completed", "failed"], default: "idle", index: true },
  configuredScopes: { type: Number, default: 0 },
  startedAt: Date,
  completedAt: Date,
  lastSuccessAt: Date,
  pagesScanned: { type: Number, default: 0 },
  documentsFound: { type: Number, default: 0 },
  documentsAdded: { type: Number, default: 0 },
  revisionsAdded: { type: Number, default: 0 },
  unchanged: { type: Number, default: 0 },
  reviewRequired: { type: Number, default: 0 },
  missingOriginal: { type: Number, default: 0 },
  lastError: { type: String, default: "" },
  cursors: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

function modelFor<T extends Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) || mongoose.model<T>(name, schema);
}

export const LegalDocumentModel = modelFor<ILegalDocument>("LegalReferenceDocument", LegalDocumentSchema);
export const LegalVersionModel = modelFor<ILegalVersion>("LegalReferenceVersion", LegalVersionSchema);
export const LegalChunkModel = modelFor<ILegalChunk>("LegalReferenceChunk", LegalChunkSchema);
export const LegalReviewTaskModel = modelFor<ILegalReviewTask>("LegalReferenceReviewTask", LegalReviewTaskSchema);
export const LegalSyncStateModel = modelFor<ILegalSyncState>("LegalReferenceSyncState", LegalSyncStateSchema);
