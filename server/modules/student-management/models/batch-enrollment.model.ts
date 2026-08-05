import { Schema, model } from "mongoose";
import { IBatchEnrollment } from "../interfaces/batch-enrollment.interface";

export const BATCH_ENROLLMENT_STATUSES = [
  "Đang học",
  "Bảo lưu",
  "Học lại",
  "Hoàn thành khóa",
  "Chờ xếp lớp tiếp theo",
  "Không còn nhu cầu học",
] as const;

const retakeEntrySchema = new Schema({ count: Number, batchId: String, reason: String, fee: { type: Number, default: 0 }, at: { type: Date, default: Date.now }, actorId: String }, { _id: false });

const historyEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    action: { type: String, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    actorId: { type: String },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const batchEnrollmentSchema = new Schema<IBatchEnrollment>(
  {
    ownerId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    batchId: { type: String, required: true, index: true },
    studentId: { type: String, required: true, index: true },
    allowedSessions: { type: Number, default: 0, min: 0 },
    attendedSessions: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: BATCH_ENROLLMENT_STATUSES,
      default: "Đang học",
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
    // Học viên rời lớp vẫn giữ bản ghi để không mất lịch sử học.
    leftAt: { type: Date, default: null },
    // Bảo lưu tách khỏi việc rời lớp: học viên vẫn thuộc lớp và giữ sổ buổi.
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: "" },
    expectedReturnAt: { type: String, default: null },
    history: { type: [historyEntrySchema], default: [] },
    retakeCount: { type: Number, default: 0, min: 0 },
    retakeHistory: { type: [retakeEntrySchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Số buổi còn lại luôn tính lại từ hai số kia để không bao giờ lệch nhau.
// Bảo lưu vì thế giữ nguyên số buổi còn lại mà không cần xử lý gì thêm.
batchEnrollmentSchema.virtual("remainingSessions").get(function (this: IBatchEnrollment) {
  return Math.max(0, (this.allowedSessions || 0) - (this.attendedSessions || 0));
});

// Một học viên chỉ có một đăng ký trong một lớp
batchEnrollmentSchema.index({ ownerId: 1, batchId: 1, studentId: 1 }, { unique: true });

export const BatchEnrollment = model<IBatchEnrollment>("BatchEnrollment", batchEnrollmentSchema);
