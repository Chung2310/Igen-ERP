import type { Document } from "mongoose";
export interface IPayrollAudit extends Document { companyCode: string; periodKey: string; action: "snapshot" | "lock" | "calculate" | "approve" | "close" | "adjustment" | "reset"; actorId: string; metadata?: Record<string, unknown>; createdAt: Date; }
