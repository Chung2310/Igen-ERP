import { Schema, model } from "mongoose";
import { IBatch } from "../interfaces/batch.interface";

const attendanceRecordSchema = new Schema(
  {
    studentId: { type: String, required: true },
    status: { type: String, enum: ["present", "absent", "excused", "late"], default: "present" },
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
    customFields: { type: Schema.Types.Mixed, default: {} },
    code: { type: String, required: true, trim: true, uppercase: true, index: true },
    name: { type: String, default: "", trim: true },
    quota: { type: Number, default: 0, min: 0 },
    courseId: { type: String, required: true, index: true },
    instructorId: { type: String, default: "", index: true },
    instructorText: { type: String, default: "", trim: true },
    learnerIds: { type: [String], default: [] },
    daysOfWeek: { type: [Number], default: [] },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    location: { type: String, default: "", trim: true },
    geoLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      radiusMeters: { type: Number, default: 150 },
    },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["Sắp khai giảng", "Đang học", "Đã kết thúc", "Đã hủy"],
      default: "Sắp khai giảng",
      index: true,
    },
    // Mốc thời gian để tính nhãn tuổi lớp (6 tháng / 1 năm) khi rà soát dữ liệu cũ
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    attendanceSessions: { type: [attendanceSessionSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

// Mã lớp là duy nhất trong phạm vi một chủ sở hữu
batchSchema.index({ ownerId: 1, code: 1 }, { unique: true });

export const Batch = model<IBatch>("Batch", batchSchema);
