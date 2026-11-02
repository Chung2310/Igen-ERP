import type { Document } from "mongoose";
export interface IPayrollAdjustment extends Document {
  companyCode: string; branchId?: string; periodKey: string; employeeId: string; kind: "allowance" | "bonus" | "deduction" | "correction" | "advance"; amount: number; reason: string; advanceDetails?: { date: string; method: "transfer" | "cash"; note?: string }; status: "draft" | "pending" | "approved" | "rejected" | "snapshotted"; snapshotRevisionId?: string; snapshotAt?: Date; version: number; createdBy: string; approvedBy?: string;
}
