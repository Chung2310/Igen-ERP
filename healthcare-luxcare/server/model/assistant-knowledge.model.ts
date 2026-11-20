import mongoose, { Schema } from "mongoose";

const AssistantKnowledgeDocumentSchema = new Schema(
  {
    companyCode: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true, maxlength: 100, default: "" },
    visibility: { type: String, enum: ["company", "restricted"], default: "company" },
    branchIds: { type: [String], default: [] },
    departmentIds: { type: [String], default: [] },
    identityKey: { type: String },
    activeRevision: { type: String },
    extractionQuality: { type: Schema.Types.Mixed },
    workbook: { type: Schema.Types.Mixed },
    legalScanCatalog: String,
    legalScannedUpdatedAt: Date,
    legalScanToken: String,
    legalScanLeaseUntil: Date,
    legalScanNextAt: Date,
    sourceFileId: { type: Schema.Types.ObjectId },
    indexingStatus: { type: String, enum: ["queued", "processing", "indexed", "failed"], default: "queued" },
    indexingError: { type: String },
    processingToken: { type: String },
    leaseUntil: { type: Date },
    chunksCount: { type: Number, default: 0 },
    documentType: { type: String, default: "general" },
    sourceType: { type: String, enum: ["manual", "resource"], required: true },
    resourceId: { type: Schema.Types.ObjectId, default: undefined },
    contentHash: { type: String, required: true },
    version: { type: Number, default: 1 },
    replaces: { type: Schema.Types.ObjectId, ref: "AssistantKnowledgeDocument" },
    supersededBy: { type: Schema.Types.ObjectId, ref: "AssistantKnowledgeDocument" },
    effectiveFrom: { type: Date, default: Date.now },
    effectiveTo: { type: Date },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: String },
    deletionReason: { type: String },
    auditFlags: { type: [Schema.Types.Mixed], default: [] },
    auditStatus: { type: String, enum: ["clean", "flagged", "verified"], default: "clean" },
    status: { type: String, enum: ["active", "disabled", "failed", "superseded", "withdrawn"], default: "active" },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

const AssistantKnowledgeChunkSchema = new Schema(
  {
    companyCode: { type: String, required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "AssistantKnowledgeDocument", required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    tokensApprox: { type: Number, required: true },
    version: { type: Number, required: true },
  },
  { timestamps: true },
);

AssistantKnowledgeDocumentSchema.index({ companyCode: 1, contentHash: 1 });
AssistantKnowledgeDocumentSchema.index({ companyCode: 1, resourceId: 1 });
AssistantKnowledgeDocumentSchema.index(
  { companyCode: 1, identityKey: 1 },
  { unique: true, partialFilterExpression: { identityKey: { $type: "string" } } },
);
AssistantKnowledgeChunkSchema.index({ companyCode: 1, documentId: 1, chunkIndex: 1 }, { unique: true });

export const AssistantKnowledgeDocumentModel = mongoose.model(
  "AssistantKnowledgeDocument",
  AssistantKnowledgeDocumentSchema,
);
export const AssistantKnowledgeChunkModel = mongoose.model("AssistantKnowledgeChunk", AssistantKnowledgeChunkSchema);

// Separate revision collection keeps the legacy unique chunk index intact during rollout.
const RevisionChunkSchema = new Schema(
  {
    companyCode: { type: String, required: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    revision: { type: String, required: true },
    legalSectionKey: String,
    chunkIndex: { type: Number, required: true },
    title: { type: String, required: true },
    text: { type: String, required: true },
    searchTokens: { type: [String], default: [] },
    embedding: { type: [Number], default: undefined },
    embeddingModel: { type: String },
  },
  { timestamps: true },
);
RevisionChunkSchema.index({ companyCode: 1, searchTokens: 1 });
RevisionChunkSchema.index({ companyCode: 1, embeddingModel: 1, documentId: 1, revision: 1 });
RevisionChunkSchema.index({ companyCode: 1, documentId: 1, revision: 1, chunkIndex: 1 }, { unique: true });
export const KnowledgeRevisionChunkModel = mongoose.model("KnowledgeRevisionChunk", RevisionChunkSchema);
