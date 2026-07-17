import { Schema, model } from "mongoose";
import { IBatch } from "../interfaces/batch.interface";

const attendanceRecordSchema = new Schema(
  {
    studentId: { type: String, required: true },
    status: { type: String, enum: ["present", "absent", "excused"], default: "present" },
  },
  { _id: false }
);

const attendanceSessionSchema = new Schema(
  {
    date: { type: String, required: true },
    note: { type: String, default: "" },
    records: [attendanceRecordSchema],
  }
);

const batchSchema = new Schema<IBatch>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    courseId: { type: String, required: true, index: true },
    instructorId: { type: String, default: "", index: true },
    learnerIds: { type: [String], default: [] },
    daysOfWeek: { type: [Number], default: [] },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: { type: String, default: "", trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["Sắp khai giảng", "Đang học", "Đã kết thúc"],
      default: "Sắp khai giảng",
      index: true,
    },
    ownerId: { type: String, required: true, index: true },
    attendanceSessions: { type: [attendanceSessionSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// Mã lớp là duy nhất trong phạm vi một chủ sở hữu
batchSchema.index({ ownerId: 1, code: 1 }, { unique: true });

export const Batch = model<IBatch>("Batch", batchSchema);
