import { Schema, model } from "mongoose";
import { IStudentQualityRecord } from "../interfaces/student-quality.interface";

const miniTestSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 0.000001 },
    note: { type: String, default: "", maxlength: 2000 },
    assessedBy: { type: String, required: true },
    assessedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const studentQualitySchema = new Schema<IStudentQualityRecord>(
  {
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    batchId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    attitudeNote: { type: String, default: "", maxlength: 4000 },
    teacherAssessment: { type: String, default: "", maxlength: 4000 },
    miniTests: { type: [miniTestSchema], default: [] },
    updatedBy: { type: String, required: true, default: "system" },
  },
  { timestamps: true },
);

studentQualitySchema.index(
  { ownerId: 1, branchId: 1, batchId: 1, studentId: 1 },
  { unique: true },
);

export const StudentQualityRecord = model<IStudentQualityRecord>("StudentQualityRecord", studentQualitySchema);
