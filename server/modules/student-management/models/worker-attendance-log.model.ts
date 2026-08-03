import { Schema, model } from "mongoose";
import { IWorkerAttendanceLog } from "../interfaces/worker-attendance.interface";

const markSchema = new Schema(
  {
    time: { type: Date, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    distanceMeters: { type: Number },
    deviceInfo: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    recordedBy: { type: String, default: "" },
  },
  { _id: false }
);

const workerAttendanceLogSchema = new Schema<IWorkerAttendanceLog>(
  {
    studentId: { type: String, required: true, index: true },
    batchId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    date: { type: String, required: true, index: true },
    checkIn: { type: markSchema, default: null },
    checkOut: { type: markSchema, default: null },
    status: {
      type: String,
      enum: ["present", "late", "left-early", "late-left-early", "missing-checkout"],
      default: "missing-checkout",
      index: true,
    },
    workedMinutes: { type: Number },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

// Một lao động chỉ có một bản ghi mỗi ngày trong cùng một dự án. Khóa gồm cả
// batchId để người làm nhiều dự án trong ngày vẫn chấm được cho từng dự án.
workerAttendanceLogSchema.index({ studentId: 1, batchId: 1, date: 1 }, { unique: true });
workerAttendanceLogSchema.index({ batchId: 1, date: -1 });

export const WorkerAttendanceLogModel = model<IWorkerAttendanceLog>(
  "WorkerAttendanceLog",
  workerAttendanceLogSchema
);
