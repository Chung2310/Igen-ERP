import { Schema, model } from "mongoose";
const schema = new Schema(
  {
    companyCode: { type: String, required: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    sourceFileId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    createdBy: { type: String, required: true },
    textInput: { type: Boolean, default: false },
    force: { type: Boolean, default: false },
    status: { type: String, enum: ["queued", "processing", "indexed", "failed"], default: "queued" },
    active: { type: Boolean, default: true },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date },
    token: { type: String },
    error: { type: String },
    chunksCount: { type: Number, default: 0 },
    progress: {
      type: new Schema(
        {
          stage: {
            type: String,
            enum: ["reading", "ocr", "chunking", "embedding", "publishing", "complete"],
            required: true,
          },
          completed: { type: Number, min: 0 },
          total: { type: Number, min: 0 },
          unit: { type: String, enum: ["pages", "chunks"] },
          updatedAt: Date,
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);
schema.index({ companyCode: 1, documentId: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ active: 1, status: 1, availableAt: 1, leaseUntil: 1 });
schema.index({ companyCode: 1, documentId: 1, createdAt: -1 });
export const KnowledgeJobModel = model("KnowledgeJob", schema);
