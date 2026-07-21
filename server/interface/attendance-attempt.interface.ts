import type { Document } from "mongoose";
export interface IAttendanceAttempt extends Document {
  uid: string; companyCode: string; action: "check-in" | "check-out";
  outcome: "accepted" | "rejected" | "error"; reasonCode: string;
  latitude?: number; longitude?: number; attemptedAt: Date;
  evidence?: { publicId: string; resourceType: string; type: string; format?: string; bytes?: number };
  evidenceDeleteAfter?: Date; evidenceDeletedAt?: Date;
}