import { Schema, model } from "mongoose";
import { ICourse } from "../interfaces/course.interface";

const courseSchema = new Schema<ICourse>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      index: true,
    },
    fee: { type: String, required: true },
    duration: { type: String, required: true },
    maxLearners: { type: Number, default: 20 },
    activeBatches: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Hoạt động", "Tạm dừng"],
      default: "Hoạt động",
      index: true,
    },
    ownerId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

// Mã khóa học là duy nhất trong phạm vi một chủ sở hữu
courseSchema.index({ ownerId: 1, code: 1 }, { unique: true });

export const Course = model<ICourse>("Course", courseSchema);
