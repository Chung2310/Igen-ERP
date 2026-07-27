import { Schema, model } from "mongoose";
import { IShiftAssignment, IWorkShift } from "../interface/work-shift.interface";

const ShiftBreakSchema = new Schema({
  name: { type: String, trim: true, default: "Nghỉ giữa ca" },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  paid: { type: Boolean, default: false },
}, { _id: false });

const WorkShiftSchema = new Schema<IWorkShift>({
  companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  color: { type: String, default: "#4F46E5" },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  crossesMidnight: { type: Boolean, default: false },
  checkInFrom: String,
  checkInUntil: String,
  checkOutFrom: String,
  checkOutUntil: String,
  breakPeriods: { type: [ShiftBreakSchema], default: () => [] },
  allowedLateMinutes: { type: Number, min: 0, default: 0 },
  allowedEarlyLeaveMinutes: { type: Number, min: 0, default: 0 },
  standardMinutes: { type: Number, min: 1, required: true },
  workingDays: { type: [Number], default: () => [1, 2, 3, 4, 5] },
  isDefault: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

WorkShiftSchema.index({ companyCode: 1, code: 1 }, { unique: true });
WorkShiftSchema.index({ companyCode: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

const ShiftAssignmentSchema = new Schema<IShiftAssignment>({
  companyCode: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  shiftId: { type: String, required: true, index: true },
  effectiveFrom: { type: String, required: true },
  effectiveTo: { type: String, default: null },
  daysOfWeek: { type: [Number], default: () => [1, 2, 3, 4, 5] },
}, { timestamps: true });

ShiftAssignmentSchema.index({ companyCode: 1, employeeId: 1, effectiveFrom: -1 });

export const WorkShiftModel = model<IWorkShift>("WorkShift", WorkShiftSchema);
export const ShiftAssignmentModel = model<IShiftAssignment>("ShiftAssignment", ShiftAssignmentSchema);
