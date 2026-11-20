import { Schema, model } from "mongoose";
const schema = new Schema(
  {
    companyCode: { type: String, required: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    legalDocumentId: { type: Schema.Types.ObjectId, required: true },
    state: { type: String, enum: ["suggested", "confirmed", "dismissed"], default: "suggested" },
    matchKind: { type: String, enum: ["identical", "reference", "manual"], required: true },
    matchedRevision: { type: String, required: true },
    matchedChunkIndexes: { type: [Number], default: [] },
    sample: { type: String, default: "" },
    relation: { type: String, enum: ["copy", "reference"] },
    scope: { type: String, enum: ["document", "chunks"], default: "document" },
    chunkIndexes: { type: [Number], default: [] },
    selectedChunkIndexes: { type: [Number], default: [] },
    sectionKeys: { type: [String], default: [] },
    reviewedRevision: String,
    reviewedLegalFingerprint: String,
    reviewedBy: String,
    reviewedAt: Date,
    history: {
      type: [
        new Schema(
          {
            action: String,
            actor: String,
            at: Date,
            revision: String,
            legalFingerprint: String,
            relation: String,
            scope: String,
            chunkIndexes: [Number],
            sectionKeys: [String],
            note: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
schema.index({ companyCode: 1, documentId: 1, legalDocumentId: 1 }, { unique: true });
schema.index({ companyCode: 1, state: 1, documentId: 1 });
export const KnowledgeLegalReviewModel = model("KnowledgeLegalReview", schema);
