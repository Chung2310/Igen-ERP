import { Schema, model } from "mongoose";
import { IClassWaitlistEntry } from "../interfaces/class-waitlist.interface";

const waitlistSchema = new Schema<IClassWaitlistEntry>({
  ownerId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  studentId: { type: String, required: true, index: true },
  roadmapId: { type: String, required: true, index: true },
  targetStepId: { type: String, required: true, index: true },
  sourceBatchId: { type: String, required: true, index: true },
  sourceEnrollmentId: { type: String, default: "" },
  progressionDecisionId: { type: String, required: true },
  status: { type: String, enum: ["waiting", "assigned", "cancelled", "paused"], default: "waiting", index: true },
  learningFormat: { type: String, default: "" },
  preferredTimeSlot: { type: String, default: "" },
  queuedAt: { type: Date, default: Date.now, index: true },
  assignedAt: { type: Date, default: null },
  assignedBatchId: { type: String, default: "" },
  assignedEnrollmentId: { type: String, default: "" },
}, { timestamps: true });

waitlistSchema.index({ ownerId: 1, studentId: 1, roadmapId: 1, targetStepId: 1, status: 1 });

export const ClassWaitlistEntry = model<IClassWaitlistEntry>("ClassWaitlistEntry", waitlistSchema);
