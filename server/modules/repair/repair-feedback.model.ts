import { Schema, model } from "mongoose";
const RepairFeedbackSchema = new Schema({ ticketId: { type: String, required: true, unique: true }, ticketCode: { type: String, required: true }, companyCode: { type: String, required: true }, branchId: { type: String, required: true }, rating: { type: Number, required: true, min: 1, max: 5 }, comment: String, submittedAt: { type: Date, required: true }, submittedIp: String }, { timestamps: true });
RepairFeedbackSchema.index({ companyCode: 1, submittedAt: -1 });
export const RepairFeedbackModel = model("RepairFeedback", RepairFeedbackSchema);
