import { Schema, model } from "mongoose";
import { IStudentBatchEnrollment } from "../interfaces/student-batch-enrollment.interface";

const studentBatchEnrollmentSchema = new Schema<IStudentBatchEnrollment>(
  {
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    batchId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    status: { type: String, enum: ["active", "removed", "completed"], default: "active", index: true },
    allowedSessions: { type: Number, required: true, default: 0, min: 0 },
    attendedSessions: { type: Number, required: true, default: 0, min: 0 },
    enrolledAt: { type: Date, required: true, default: Date.now },
    leftAt: { type: Date },
    createdBy: { type: String, required: true, default: "system" },
    updatedBy: { type: String, required: true, default: "system" },
  },
  { timestamps: true },
);

studentBatchEnrollmentSchema.index(
  { ownerId: 1, branchId: 1, batchId: 1, studentId: 1 },
  { unique: true },
);

export const StudentBatchEnrollment = model<IStudentBatchEnrollment>(
  "StudentBatchEnrollment",
  studentBatchEnrollmentSchema,
);
