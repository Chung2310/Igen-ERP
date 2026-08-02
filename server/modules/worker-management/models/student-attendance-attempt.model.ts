import { Schema, model } from "mongoose";
import { IStudentAttendanceAttempt } from "../interfaces/student-attendance-attempt.interface";

const evidenceSchema = new Schema(
  {
    publicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    format: { type: String },
    bytes: { type: Number },
  },
  { _id: false },
);

const studentAttendanceAttemptSchema = new Schema<IStudentAttendanceAttempt>(
  {
    studentId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ["qr-offline", "online-code"],
      required: true,
    },
    sessionId: { type: String },
    verificationCodeId: { type: String },
    outcome: {
      type: String,
      enum: ["accepted", "rejected", "error"],
      required: true,
    },
    reasonCode: { type: String, required: true },
    similarity: { type: Number },
    live: { type: Boolean },
    livenessScore: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    distanceMeters: { type: Number },
    evidence: { type: evidenceSchema },
    evidenceDeleteAfter: { type: Date },
    attemptedAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false },
);

studentAttendanceAttemptSchema.index({
  ownerId: 1,
  batchId: 1,
  attemptedAt: -1,
});
studentAttendanceAttemptSchema.index({ studentId: 1, attemptedAt: -1 });

export const StudentAttendanceAttemptModel = model<IStudentAttendanceAttempt>(
  "WorkerStudentAttendanceAttempt",
  studentAttendanceAttemptSchema,
  "studentattendanceattempts",
);
