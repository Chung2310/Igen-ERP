import { Schema, model } from "mongoose";
import { HR_CREDENTIAL_TYPES } from "../../shared/hr-credential";
import type { IHRCredential } from "../interface/hr-credential.interface";

const HRCredentialSchema = new Schema<IHRCredential>(
  {
    companyCode: { type: String, required: true, index: true, trim: true, uppercase: true },
    branchId: { type: String, index: true },
    employeeId: { type: String, required: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: HR_CREDENTIAL_TYPES, required: true, index: true },
    credentialNumber: { type: String, trim: true, default: "" },
    issuingOrganization: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, default: null, index: true },
    professionalScope: { type: String, trim: true, default: "" },
    fileUrl: { type: String, trim: true, default: "" },
    fileName: { type: String, trim: true, default: "" },
    fileMimeType: { type: String, trim: true, default: "" },
    fileSize: { type: Number, min: 0, default: 0 },
    resourceId: { type: String, default: "" },
    note: { type: String, trim: true, default: "" },
    reminderDays: { type: Number, min: 1, max: 365, default: 30 },
    status: { type: String, enum: ["active", "expiring", "expired"], required: true, index: true },
    createdBy: { type: String, required: true },
    updatedBy: String,
  },
  { timestamps: true },
);

HRCredentialSchema.index({ companyCode: 1, employeeId: 1, expiryDate: 1 });
HRCredentialSchema.index({ companyCode: 1, branchId: 1, status: 1, expiryDate: 1 });
HRCredentialSchema.index({ companyCode: 1, credentialNumber: 1 }, { sparse: true });

export const HRCredentialModel = model<IHRCredential>("HRCredential", HRCredentialSchema);
