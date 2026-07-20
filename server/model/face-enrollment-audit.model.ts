import mongoose, { Schema, model } from "mongoose";

import type { IFaceEnrollmentAudit } from "../interface/face-enrollment.interface";

const EvidenceSchema = new Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    type: { type: String, required: true },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false },
);

const FaceEnrollmentAuditSchema = new Schema<IFaceEnrollmentAudit>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    companyCode: { type: String, required: true, immutable: true, index: true },
    action: {
      type: String,
      enum: ["register", "replace", "delete"],
      required: true,
      immutable: true,
    },
    outcome: {
      type: String,
      enum: ["success", "rejected", "error"],
      required: true,
      immutable: true,
    },
    reasonCode: { type: String, immutable: true },
    evidence: { type: EvidenceSchema, immutable: true },
    attemptedAt: { type: Date, required: true, immutable: true, default: Date.now },
  },
  { versionKey: false },
);

FaceEnrollmentAuditSchema.index({ companyCode: 1, targetUserId: 1, attemptedAt: -1 });
FaceEnrollmentAuditSchema.index({ actorId: 1, attemptedAt: -1 });

export const FaceEnrollmentAuditModel =
  mongoose.models.FaceEnrollmentAudit ||
  model<IFaceEnrollmentAudit>("FaceEnrollmentAudit", FaceEnrollmentAuditSchema);