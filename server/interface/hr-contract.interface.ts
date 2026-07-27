import { Document } from "mongoose";

export type HRContractStatus = "draft" | "active" | "expired" | "terminated";

export interface IHRContract extends Document {
  companyCode: string;
  contractType: string;
  employeeId: string;
  employeeName: string;
  startDate: Date;
  endDate: Date;
  status: HRContractStatus;
  contractFileUrl?: string;
  signedImageUrl?: string;
  note?: string;
  createdBy: string;
  updatedBy?: string;
}

export interface IHRContractExtension extends Document {
  companyCode: string;
  contractId: string;
  employeeId: string;
  employeeName: string;
  previousEndDate: Date;
  newEndDate: Date;
  extensionDate: Date;
  reason?: string;
  extensionFileUrl?: string;
  signedImageUrl?: string;
  createdBy: string;
}
