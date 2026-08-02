import { Schema, model } from "mongoose";
import { IExam } from "../interfaces/exam.interface";

const examSchema = new Schema<IExam>(
  {
    customFields: { type: Schema.Types.Mixed, default: {} },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Sắp diễn ra", "Đã xác nhận", "Đã hoàn thành", "Đã hủy"],
      required: true,
      index: true,
    },
    // Hạng bằng lái — riêng ngành lái xe, kỳ thi ngành khác để trống
    rank: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    tentativeDate: { type: String, required: true },
    officialDate: { type: String, default: "" },
    location: { type: String, required: true },
    studentCount: { type: Number, default: 0 },
    passCount: { type: Number, default: 0 },
    failCount: { type: Number, default: 0 },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  },
  {
    timestamps: true,
  },
);

export const Exam = model<IExam>("WorkerExam", examSchema, "exams");
