import { Schema, model, models } from "mongoose";
import type { IAttendanceAttempt } from "../interface/attendance-attempt.interface";
const EvidenceSchema = new Schema({ publicId: String, resourceType: String, type: String, format: String, bytes: Number }, { _id: false });
const schema = new Schema<IAttendanceAttempt>({
  uid: { type: String, required: true, immutable: true, index: true },
  companyCode: { type: String, required: true, immutable: true, index: true },
  action: { type: String, enum: ["check-in", "check-out"], required: true, immutable: true },
  outcome: { type: String, enum: ["accepted", "rejected", "error"], required: true, immutable: true },
  reasonCode: { type: String, required: true, immutable: true },
  latitude: { type: Number, immutable: true }, longitude: { type: Number, immutable: true },
  attemptedAt: { type: Date, required: true, default: Date.now, immutable: true },
  evidence: { type: EvidenceSchema, immutable: true },
  evidenceDeleteAfter: { type: Date, immutable: true, index: true }, evidenceDeletedAt: Date,
}, { versionKey: false });
schema.index({ companyCode: 1, attemptedAt: -1 });
export const AttendanceAttemptModel = models.AttendanceAttempt || model<IAttendanceAttempt>("AttendanceAttempt", schema);