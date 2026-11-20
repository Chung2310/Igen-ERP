import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    number: { type: String, required: true, trim: true, uppercase: true, unique: true },
    title: { type: String, required: true },
    issuer: { type: String, required: true },
    issuedAt: { type: Date, required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: Date,
    sourceUrl: { type: String, required: true },
    companyCodes: { type: [String], default: [] },
    applicability: { type: String, required: true },
    replaces: { type: Schema.Types.ObjectId, ref: "LegalDocument" },
    amends: { type: Schema.Types.ObjectId, ref: "LegalDocument" },
    sectionChanges: {
      type: [
        new Schema(
          {
            action: { type: String, enum: ["replace", "repeal", "add"] as const, required: true },
            targetKey: { type: String, required: true },
            targetLabel: { type: String, required: true },
            sourceKeys: { type: [String], required: true },
            previousAmendmentId: Schema.Types.ObjectId,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    sectionClaims: { type: [String], default: undefined },
    sections: {
      type: [
        new Schema(
          {
            key: { type: String, required: true },
            label: { type: String, required: true },
            start: { type: Number, required: true },
            end: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    structureRevision: String,
    structureSourceRevision: String,
    structuredBy: String,
    structuredAt: Date,
    // Set only during approval: unique claim makes concurrent replacement approval safe.
    replacementClaim: { type: Schema.Types.ObjectId },
    knowledgeDocumentId: { type: Schema.Types.ObjectId, required: true },
    approvedRevision: String,
    approvedContentHash: String,
    sourceFileId: Schema.Types.ObjectId,
    postId: { type: Schema.Types.ObjectId, ref: "BlogPost", required: true },
    status: { type: String, enum: ["draft", "approved", "withdrawn"], default: "draft" },
    isDeleted: { type: Boolean, default: false, index: true },
    auditFlags: { type: [Schema.Types.Mixed], default: [] },
    auditStatus: { type: String, enum: ["clean", "flagged", "verified"], default: "clean" },
    createdBy: { type: String, required: true },
    approvedBy: String,
    approvedAt: Date,
    withdrawnBy: String,
    withdrawnAt: Date,
    withdrawalReason: String,
  },
  { timestamps: true },
);
schema.index({ replacementClaim: 1 }, { unique: true, sparse: true });
schema.index({ status: 1, effectiveFrom: 1, companyCodes: 1 });
schema.index({ postId: 1, approvedAt: 1 });
schema.index({ sectionClaims: 1 }, { unique: true, sparse: true });
schema.index({ amends: 1, approvedAt: 1, effectiveFrom: 1 });
export const LegalDocumentModel = model("LegalDocument", schema);
