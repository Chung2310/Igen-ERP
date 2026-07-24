import { Schema, model } from "mongoose";
import { IStudentVerificationCode } from "../interfaces/student-verification-code.interface";

const studentVerificationCodeSchema = new Schema<IStudentVerificationCode>(
  {
    studentId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    codeHash: { type: String, required: true },
    channel: { type: String, enum: ["email", "sms"], required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

studentVerificationCodeSchema.index({ studentId: 1, batchId: 1, date: 1 });
studentVerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const StudentVerificationCodeModel = model<IStudentVerificationCode>(
  "StudentVerificationCode",
  studentVerificationCodeSchema
);
