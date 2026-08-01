import { Schema, model } from "mongoose";
import { IHRLeaveApplication, LEAVE_REQUEST_KINDS } from "../interface/hr-leave.interface";

const HRLeaveApplicationSchema = new Schema<IHRLeaveApplication>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    type: { type: String, required: true, index: true },
    requestKind: { type: String, enum: LEAVE_REQUEST_KINDS, default: "leave", index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    uploadedFileUrl: { type: String },
    uploadedFileName: { type: String },
    attachments: { type: [{ url: String, name: String, mimeType: String, size: Number }], default: [] },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    rejectReason: { type: String },
    note: { type: String },
    approvedBy: { type: String, index: true },
    approvedAt: { type: Date },
    approvalType: { type: String, enum: ["justified", "unjustified"] },
    approvalNote: { type: String },
    year: { type: Number, index: true },
    chargeableDays: { type: Number, min: 0 },
    chargeableDates: { type: [String], default: undefined },
    reminderSentAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const HRLeaveApplicationModel = model<IHRLeaveApplication>("HRLeaveApplication", HRLeaveApplicationSchema);
