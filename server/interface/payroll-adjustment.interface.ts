import type { Document } from "mongoose";
export interface IPayrollAdjustment extends Document {
  companyCode: string; branchId?: string; periodKey: string; employeeId: string; kind: "allowance" | "bonus" | "deduction" | "correction"; amount: number; reason: string; status: "draft" | "pending" | "approved" | "rejected" | "snapshotted"; snapshotRevisionId?: string; snapshotAt?: Date; version: number; createdBy: string; approvedBy?: string;
}
