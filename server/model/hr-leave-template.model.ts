import { Schema, model } from "mongoose";
import { IHRLeaveTemplate, LEAVE_REQUEST_KINDS } from "../interface/hr-leave.interface";

const HRLeaveTemplateSchema = new Schema<IHRLeaveTemplate>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    requestKind: { type: String, enum: LEAVE_REQUEST_KINDS, default: "leave", index: true },
    name: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedBy: { type: String, required: true, index: true },
    uploadToken: { type: String },
  },
  {
    timestamps: true,
  }
);

export const HRLeaveTemplateModel = model<IHRLeaveTemplate>("HRLeaveTemplate", HRLeaveTemplateSchema);
