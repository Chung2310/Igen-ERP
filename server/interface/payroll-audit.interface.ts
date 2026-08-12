import type { Document } from "mongoose";
export type PayrollAuditAction = "snapshot" | "lock" | "calculate" | "approve" | "close" | "adjustment" | "reset" | "create_run" | "sync_attendance" | "lock_attendance" | "review" | "reject" | "reopen" | "mark_paid" | "payment";
export interface IPayrollAudit extends Document { companyCode: string; branchId?: string; periodKey: string; action: PayrollAuditAction; actorId: string; metadata?: Record<string, unknown>; createdAt: Date; }
