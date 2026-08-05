import { Schema, model } from "mongoose";
import { IExam } from "../interfaces/exam.interface";

const resultSchema = new Schema({ studentId: { type: String, required: true }, score: { type: Number, min: 0 }, note: { type: String, default: "" }, gradedBy: { type: String, default: "" }, gradedAt: { type: Date, default: null } }, { _id: false });

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
    batchId: { type: String, default: "", index: true },
    maxScore: { type: Number, default: 100, min: 1 },
    results: { type: [resultSchema], default: [] },
    studentCount: { type: Number, default: 0 },
    passCount: { type: Number, default: 0 },
    failCount: { type: Number, default: 0 },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  },
  {
    timestamps: true,
  }
);

export const Exam = model<IExam>("Exam", examSchema);
