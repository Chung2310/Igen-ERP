import { Document } from "mongoose";

export type StudentVerificationCodeChannel = "email" | "sms";

export interface IStudentVerificationCode extends Document {
  studentId: string;
  ownerId: string;
  batchId: string;
  date: string; // YYYY-MM-DD
  codeHash: string;
  channel: StudentVerificationCodeChannel;
  used: boolean;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}
