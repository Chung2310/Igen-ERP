import { Schema, model } from "mongoose";
import { ITimekeepingLog } from "../interface/timekeeping.interface";

const TimekeepingDetailSchema = new Schema(
  {
    time: { type: Date, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    distance: { type: Number, required: true },
    deviceInfo: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
  },
  { _id: false }
);

const TimekeepingLogSchema = new Schema<ITimekeepingLog>({
  uid: { type: String, required: true, index: true },
  companyCode: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  checkIn: { type: TimekeepingDetailSchema, default: null },
  checkOut: { type: TimekeepingDetailSchema, default: null },
  status: { type: String, enum: ["Present", "Late", "Left-Early", "Half-Day", "Late-Left-Early", "Absent", "Approved-Leave"], default: "Present", index: true },
  note: { type: String, default: "" },
  manuallyAdjusted: { type: Boolean, default: false, index: true },
  adjustedAt: Date,
  adjustedBy: String,
  adjustmentReason: String,
  shiftId: { type: String, index: true },
  shiftName: String,
  shiftCode: String,
  workDate: { type: String, index: true },
  scheduledStartAt: Date,
  scheduledEndAt: Date,
  standardMinutes: Number,
  breakPeriods: { type: [{ name: String, startTime: String, endTime: String, paid: Boolean }], default: undefined, _id: false },
  assignmentSource: { type: String, enum: ["employee", "company", "legacy"] },
});

// Composite unique index for one timekeeping entry per user per day
TimekeepingLogSchema.index({ uid: 1, date: 1 }, { unique: true });

export const TimekeepingLogModel = model<ITimekeepingLog>("TimekeepingLog", TimekeepingLogSchema);
