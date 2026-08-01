import { Document } from "mongoose";

export type HRContractStatus = "draft" | "active" | "expired" | "terminated";

export type HRSalaryType = "monthly" | "daily" | "hourly";

/** Effective-dated pay terms; a mid-month change splits the payroll period into segments. */
export interface IHRSalaryTerm {
  salaryEffectiveFrom: Date;
  salaryEffectiveTo?: Date;
  contractSalary: number;
  insuranceSalary: number;
  payrollSalary: number;
  salaryType: HRSalaryType;
  probation?: boolean;
  probationSalary?: number;
  probationRate?: number;
  currency: string;
}

export interface IHRContract extends Document {
  companyCode: string;
  branchId?: string;
  contractType: string;
  employeeId: string;
  employeeName: string;
  startDate: Date;
  endDate: Date;
  status: HRContractStatus;
  salaryTerms?: IHRSalaryTerm[];
  contractFileUrl?: string;
  contractFileName?: string;
  contractFileMimeType?: string;
  contractFileSize?: number;
  contractResourceId?: string;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
  note?: string;
  createdBy: string;
  updatedBy?: string;
}

export interface IHRContractExtension extends Document {
  companyCode: string;
  branchId?: string;
  contractId: string;
  employeeId: string;
  employeeName: string;
  previousEndDate: Date;
  newEndDate: Date;
  extensionDate: Date;
  reason?: string;
  extensionFileUrl?: string;
  extensionFileName?: string;
  extensionFileMimeType?: string;
  extensionFileSize?: number;
  extensionResourceId?: string;
  signedImageUrl?: string;
  signedImageName?: string;
  signedImageMimeType?: string;
  signedImageSize?: number;
  signedImageResourceId?: string;
  createdBy: string;
}
