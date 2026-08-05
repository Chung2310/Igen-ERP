import { Schema, model } from "mongoose";
import { IStudentProgressionDecision } from "../interfaces/student-progression.interface";

const progressionSchema = new Schema<IStudentProgressionDecision>({
  ownerId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  roadmapId: { type: String, required: true, index: true },
  sourceStepId: { type: String, required: true },
  targetStepId: { type: String, default: "" },
  sourceBatchId: { type: String, required: true, index: true },
  sourceEnrollmentId: { type: String, default: "" },
  studentId: { type: String, required: true, index: true },
  intent: { type: String, enum: ["continue", "pending", "stop", "preserve", "repeat"], default: "pending" },
  teacherConfirmed: { type: Boolean, default: false },
  teacherNote: { type: String, default: "", maxlength: 4000 },
  eligible: { type: Boolean, default: false },
  eligibilityReasons: { type: [String], default: [] },
  eligibilitySnapshot: { type: Schema.Types.Mixed, default: {} },
  overrideEligible: { type: Boolean, default: null },
  overrideReason: { type: String, default: "", maxlength: 2000 },
  overrideBy: { type: String, default: "" },
  overrideAt: { type: Date, default: null },
}, { timestamps: true });

progressionSchema.index({ ownerId: 1, sourceBatchId: 1, studentId: 1, roadmapId: 1 }, { unique: true });

export const StudentProgressionDecision = model<IStudentProgressionDecision>("StudentProgressionDecision", progressionSchema);
