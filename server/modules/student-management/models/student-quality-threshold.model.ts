import { Schema, model } from "mongoose";
import { IStudentQualityThreshold } from "../interfaces/student-quality-threshold.interface";

const threshold = { type: Number, required: true, min: 0, max: 100 };
const schema = new Schema<IStudentQualityThreshold>({
  ownerId: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  riskAttendance: { ...threshold, default: 50 }, riskAssignment: { ...threshold, default: 50 }, riskMiniTest: { ...threshold, default: 50 },
  watchAttendance: { ...threshold, default: 80 }, watchAssignment: { ...threshold, default: 70 }, watchMiniTest: { ...threshold, default: 70 },
}, { timestamps: true });
schema.index({ ownerId: 1, branchId: 1 }, { unique: true });
export const StudentQualityThreshold = model<IStudentQualityThreshold>("StudentQualityThreshold", schema);
