import { Schema, model } from "mongoose";
import { IHRLeaveApplication } from "../interface/hr-leave.interface";

const HRLeaveApplicationSchema = new Schema<IHRLeaveApplication>(
  {
    companyCode: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    type: { type: String, required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    uploadedFileUrl: { type: String },
    uploadedFileName: { type: String },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    rejectReason: { type: String },
    note: { type: String },
    approvedBy: { type: String, index: true },
    chargeableDays: { type: Number, min: 0 },
    chargeableDates: { type: [String], default: undefined },
  },
  {
    timestamps: true,
  }
);

export const HRLeaveApplicationModel = model<IHRLeaveApplication>("HRLeaveApplication", HRLeaveApplicationSchema);
