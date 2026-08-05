import { Document } from "mongoose";

export type ProgressionIntent = "continue" | "pending" | "stop" | "preserve" | "repeat";

export interface IStudentProgressionDecision extends Document {
  ownerId: string;
  branchId?: string;
  roadmapId: string;
  sourceStepId: string;
  targetStepId?: string;
  sourceBatchId: string;
  sourceEnrollmentId?: string;
  studentId: string;
  intent: ProgressionIntent;
  teacherConfirmed: boolean;
  teacherNote: string;
  eligible: boolean;
  eligibilityReasons: string[];
  eligibilitySnapshot: Record<string, unknown>;
  overrideEligible?: boolean | null;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
