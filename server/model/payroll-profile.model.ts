import { Schema, model } from "mongoose";

export interface IPayrollProfile {
  companyCode: string;
  branchId?: string;
  employeeId: string;
  participatesInsurance: boolean;
  insuranceGroup?: string;
  insuranceStartDate?: Date;
  insuranceEndDate?: Date;
  participatesUnion: boolean;
  taxCode?: string;
  residencyStatus: "resident" | "nonResident";
  taxMethod: "progressive" | "shortTerm" | "nonResident";
  hasWithholdingCommitment: boolean;
  bankName?: string;
  bankCode?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  paymentMethod: "transfer" | "cash";
  effectiveFrom: Date;
  effectiveTo?: Date;
  status: "active" | "inactive";
  note?: string;
  createdBy: string;
  updatedBy?: string;
}

export interface IPayrollDependent {
  companyCode: string;
  employeeId: string;
  fullName: string;
  relationship: string;
  identityNumber?: string;
  taxCode?: string;
  birthDate?: Date;
  /** Months the dependent deduction may be claimed. */
  deductionFrom: Date;
  deductionTo?: Date;
  status: "pending" | "verified" | "rejected";
  note?: string;
  createdBy: string;
}

const profileSchema = new Schema<IPayrollProfile>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  employeeId: { type: String, required: true, index: true },
  participatesInsurance: { type: Boolean, required: true, default: true },
  insuranceGroup: String,
  insuranceStartDate: Date,
  insuranceEndDate: Date,
  participatesUnion: { type: Boolean, required: true, default: false },
  taxCode: { type: String, trim: true },
  residencyStatus: { type: String, enum: ["resident", "nonResident"], required: true, default: "resident" },
  taxMethod: { type: String, enum: ["progressive", "shortTerm", "nonResident"], required: true, default: "progressive" },
  hasWithholdingCommitment: { type: Boolean, required: true, default: false },
  bankName: { type: String, trim: true },
  bankCode: { type: String, trim: true },
  bankAccountNumber: { type: String, trim: true },
  bankAccountHolder: { type: String, trim: true },
  paymentMethod: { type: String, enum: ["transfer", "cash"], required: true, default: "transfer" },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  status: { type: String, enum: ["active", "inactive"], required: true, default: "active", index: true },
  note: String,
  createdBy: { type: String, required: true },
  updatedBy: String,
}, { timestamps: true });

profileSchema.index({ companyCode: 1, employeeId: 1, effectiveFrom: -1 });

const dependentSchema = new Schema<IPayrollDependent>({
  companyCode: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  fullName: { type: String, required: true, trim: true },
  relationship: { type: String, required: true, trim: true },
  identityNumber: { type: String, trim: true },
  taxCode: { type: String, trim: true },
  birthDate: Date,
  deductionFrom: { type: Date, required: true },
  deductionTo: Date,
  status: { type: String, enum: ["pending", "verified", "rejected"], required: true, default: "pending", index: true },
  note: String,
  createdBy: { type: String, required: true },
}, { timestamps: true });

dependentSchema.index({ companyCode: 1, employeeId: 1, deductionFrom: -1 });

export const PayrollProfileModel = model<IPayrollProfile>("PayrollProfile", profileSchema);
export const PayrollDependentModel = model<IPayrollDependent>("PayrollDependent", dependentSchema);
