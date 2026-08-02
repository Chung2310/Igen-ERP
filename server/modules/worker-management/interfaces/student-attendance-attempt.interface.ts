import { Document } from "mongoose";

export type StudentAttendanceChannel = "qr-offline" | "online-code";
export type StudentAttendanceOutcome = "accepted" | "rejected" | "error";

export interface IStudentAttendanceEvidence {
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
}

export interface IStudentAttendanceAttempt extends Document {
  studentId: string;
  ownerId: string;
  batchId: string;
  channel: StudentAttendanceChannel;
  sessionId?: string;
  verificationCodeId?: string;
  outcome: StudentAttendanceOutcome;
  reasonCode: string;
  similarity?: number;
  live?: boolean;
  livenessScore?: number;
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  evidence?: IStudentAttendanceEvidence;
  evidenceDeleteAfter?: Date;
  attemptedAt: Date;
}
