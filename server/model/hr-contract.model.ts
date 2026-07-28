import { Schema, model } from "mongoose";
import {
  IHRContract,
  IHRContractExtension,
} from "../interface/hr-contract.interface";

const HRContractSchema = new Schema<IHRContract>(
  {
    companyCode: { type: String, required: true, index: true },
    contractType: { type: String, required: true, trim: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "active", "expired", "terminated"],
      default: "active",
      index: true,
    },
    contractFileUrl: { type: String, trim: true },
    contractFileName: { type: String, trim: true },
    contractFileMimeType: { type: String, trim: true },
    contractFileSize: { type: Number, min: 0 },
    contractResourceId: { type: String, index: true },
    signedImageUrl: { type: String, trim: true },
    signedImageName: { type: String, trim: true },
    signedImageMimeType: { type: String, trim: true },
    signedImageSize: { type: Number, min: 0 },
    signedImageResourceId: { type: String, index: true },
    note: { type: String, trim: true },
    createdBy: { type: String, required: true },
    updatedBy: String,
  },
  { timestamps: true },
);

HRContractSchema.index({ companyCode: 1, employeeId: 1, endDate: -1 });

const HRContractExtensionSchema = new Schema<IHRContractExtension>(
  {
    companyCode: { type: String, required: true, index: true },
    contractId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true },
    previousEndDate: { type: Date, required: true },
    newEndDate: { type: Date, required: true },
    extensionDate: { type: Date, required: true, default: Date.now },
    reason: { type: String, trim: true },
    extensionFileUrl: { type: String, trim: true },
    extensionFileName: { type: String, trim: true },
    extensionFileMimeType: { type: String, trim: true },
    extensionFileSize: { type: Number, min: 0 },
    extensionResourceId: { type: String, index: true },
    signedImageUrl: { type: String, trim: true },
    signedImageName: { type: String, trim: true },
    signedImageMimeType: { type: String, trim: true },
    signedImageSize: { type: Number, min: 0 },
    signedImageResourceId: { type: String, index: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

HRContractExtensionSchema.index({
  companyCode: 1,
  contractId: 1,
  extensionDate: -1,
});

export const HRContractModel = model<IHRContract>(
  "HRContract",
  HRContractSchema,
);
export const HRContractExtensionModel = model<IHRContractExtension>(
  "HRContractExtension",
  HRContractExtensionSchema,
);
