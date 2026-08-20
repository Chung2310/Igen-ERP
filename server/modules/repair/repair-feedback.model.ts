import { Schema, model } from "mongoose";
const RepairFeedbackSchema = new Schema({ ticketId: { type: String, required: true, unique: true }, ticketCode: { type: String, required: true }, companyCode: { type: String, required: true }, branchId: { type: String, required: true }, rating: { type: Number, required: true, min: 1, max: 5 }, comment: String,
  technicianId: String, technicianName: String,
  /** Điểm chi tiết từng mặt; để trống khi khách chỉ chấm sao tổng. */
  criteria: { type: { skill: { type: Number, min: 1, max: 5 }, attitude: { type: Number, min: 1, max: 5 }, speed: { type: Number, min: 1, max: 5 } }, _id: false, default: undefined },
  /** qr = khách tự quét; staff = nhân viên nhập hộ khi khách nhận máy. */
  source: { type: String, enum: ["qr", "staff"], default: "qr" }, ratedBy: String, ratedByName: String, submittedAt: { type: Date, required: true }, submittedIp: String }, { timestamps: true });
RepairFeedbackSchema.index({ companyCode: 1, submittedAt: -1 });
RepairFeedbackSchema.index({ companyCode: 1, technicianId: 1, submittedAt: -1 });
export const RepairFeedbackModel = model("RepairFeedback", RepairFeedbackSchema);
