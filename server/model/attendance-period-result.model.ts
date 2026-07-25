import { Schema, model } from "mongoose";
import type { IAttendancePeriodResult } from "../interface/payroll-period.interface";

const schema = new Schema<IAttendancePeriodResult>({
  companyCode: { type: String, required: true, index: true }, periodKey: { type: String, required: true }, employeeId: { type: String, required: true }, employeeName: { type: String, default: "" },
  monthlySalary: { type: Number, required: true, min: 0 }, standardHours: { type: Number, required: true, min: 1 }, shortageMinutes: { type: Number, required: true, min: 0, default: 0 }, workedDays: { type: Number, min: 0 }, shortageDays: { type: Number, min: 0 },
  paidLeaveMinutesByRate: [{ minutes: { type: Number, min: 0 }, payRate: { type: Number, min: 0 } }],
  overtime: [{ minutes: { type: Number, min: 0 }, category: { type: String, enum: ["weekday", "restDay", "holiday"] } }],
  status: { type: String, enum: ["draft", "locked"], default: "draft", index: true }, lockedAt: Date, lockedBy: String,
}, { timestamps: true });
schema.index({ companyCode: 1, periodKey: 1, employeeId: 1 }, { unique: true });
export const AttendancePeriodResultModel = model<IAttendancePeriodResult>("AttendancePeriodResult", schema);
