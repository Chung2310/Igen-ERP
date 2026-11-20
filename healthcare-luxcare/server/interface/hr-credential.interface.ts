import type { Document } from "mongoose";
import type { HRCredentialStatus, HRCredentialType } from "../../shared/hr-credential";

export interface IHRCredential extends Document {
  companyCode: string;
  branchId?: string;
  employeeId: string;
  employeeName: string;
  name: string;
  type: HRCredentialType;
  credentialNumber?: string;
  issuingOrganization: string;
  issueDate: Date;
  expiryDate?: Date | null;
  professionalScope?: string;
  fileUrl?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  resourceId?: string;
  note?: string;
  reminderDays: number;
  status: HRCredentialStatus;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
