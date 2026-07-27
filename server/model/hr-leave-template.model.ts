import { Schema, model } from "mongoose";
import { IHRLeaveTemplate } from "../interface/hr-leave.interface";

const HRLeaveTemplateSchema = new Schema<IHRLeaveTemplate>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    name: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    uploadedBy: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

export const HRLeaveTemplateModel = model<IHRLeaveTemplate>("HRLeaveTemplate", HRLeaveTemplateSchema);
