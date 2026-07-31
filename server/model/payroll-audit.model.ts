import { Schema, model } from "mongoose";
import type { IPayrollAudit } from "../interface/payroll-audit.interface";
const schema = new Schema<IPayrollAudit>({ companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true }, periodKey: { type: String, required: true, index: true }, action: { type: String, enum: ["snapshot", "lock", "calculate", "approve", "close", "adjustment", "reset", "create_run", "sync_attendance", "lock_attendance", "review", "reject", "payment"], required: true }, actorId: { type: String, required: true }, metadata: { type: Schema.Types.Mixed } }, { timestamps: { createdAt: true, updatedAt: false } });
export const PayrollAuditModel = model<IPayrollAudit>("PayrollAudit", schema);
