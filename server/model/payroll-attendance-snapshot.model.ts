import { Schema, model } from "mongoose";
import type { PayrollAttendanceSnapshot } from "../interface/payroll-operations.interface";

const employeeSchema = new Schema({
  employeeId: { type: String, required: true, immutable: true },
  employeeName: { type: String, immutable: true },
  standardHours: { type: Number, required: true, min: 0, immutable: true },
  standardDays: { type: Number, required: true, min: 0, immutable: true },
  workedMinutes: { type: Number, required: true, min: 0, immutable: true },
  shortageMinutes: { type: Number, required: true, min: 0, immutable: true },
  paidLeaveMinutesByRate: { type: [{
    minutes: { type: Number, required: true, min: 0, immutable: true },
    payRate: { type: Number, required: true, min: 0, immutable: true },
  }], required: true, immutable: true },
  overtime: { type: [{
    minutes: { type: Number, required: true, min: 0, immutable: true },
    category: { type: String, required: true, enum: ["weekday", "restDay", "holiday"], immutable: true },
    night: { type: Boolean, default: false, immutable: true },
  }], required: true, immutable: true },
  sourceResultId: { type: String, immutable: true },
  sourceVersion: { type: Number, min: 0, immutable: true },
}, { _id: false });

const schema = new Schema<PayrollAttendanceSnapshot>({
  companyCode: { type: String, required: true, immutable: true },
  branchId: { type: String, required: true, immutable: true },
  runId: { type: String, required: true, immutable: true },
  periodKey: { type: String, required: true, immutable: true },
  employees: { type: [employeeSchema], required: true, immutable: true },
  lockedAt: { type: String, required: true, immutable: true },
  lockedBy: { type: String, required: true, immutable: true },
}, { timestamps: true });

schema.index({ companyCode: 1, runId: 1 }, { unique: true });

export const PayrollAttendanceSnapshotModel = model<PayrollAttendanceSnapshot>("PayrollAttendanceSnapshot", schema);
