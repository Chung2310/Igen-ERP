import { Schema, model } from "mongoose";
import { ITrainingEnrollment } from "../interface/training-enrollment.interface";

const TrainingEnrollmentSchema = new Schema<ITrainingEnrollment>({
  courseId: { type: String, required: true, index: true },
  courseTitle: { type: String, required: true },
  uid: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  progress: { type: Number, default: 0 },
  status: { type: String, enum: ["not_started", "in_progress", "completed"], default: "not_started", index: true },
  startedAt: { type: Date },
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true },
  completedLessons: { type: [String], default: [] },
  quizPassed: { type: Boolean, default: false },
});

// Một nhân viên chỉ đăng ký một khóa học duy nhất một lần
TrainingEnrollmentSchema.index({ uid: 1, courseId: 1 }, { unique: true });

export const TrainingEnrollmentModel = model<ITrainingEnrollment>("TrainingEnrollment", TrainingEnrollmentSchema);
