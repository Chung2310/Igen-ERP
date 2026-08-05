import { Document } from "mongoose";

export type StudentBatchEnrollmentStatus = "active" | "removed" | "completed";

export interface IStudentBatchEnrollment extends Document {
  ownerId: string;
  branchId?: string;
  batchId: string;
  studentId: string;
  status: StudentBatchEnrollmentStatus;
  allowedSessions: number;
  attendedSessions: number;
  enrolledAt: Date;
  leftAt?: Date;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
