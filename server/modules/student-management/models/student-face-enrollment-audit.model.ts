import { Schema, model } from "mongoose";
import { IStudentFaceEnrollmentAudit } from "../interfaces/student-face-enrollment-audit.interface";

const evidenceSchema = new Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false }
);

const studentFaceEnrollmentAuditSchema = new Schema<IStudentFaceEnrollmentAudit>(
  {
    actorId: { type: String, required: true },
    studentId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    action: { type: String, enum: ["register", "replace", "delete"], required: true },
    outcome: { type: String, enum: ["success", "rejected", "error"], required: true },
    reasonCode: { type: String },
    evidence: { type: evidenceSchema },
    attemptedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

studentFaceEnrollmentAuditSchema.index({ ownerId: 1, studentId: 1, attemptedAt: -1 });

export const StudentFaceEnrollmentAuditModel = model<IStudentFaceEnrollmentAudit>(
  "StudentFaceEnrollmentAudit",
  studentFaceEnrollmentAuditSchema
);
