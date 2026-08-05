import { Document } from "mongoose";

export type ClassWaitlistStatus = "waiting" | "assigned" | "cancelled" | "paused";

export interface IClassWaitlistEntry extends Document {
  ownerId: string;
  branchId?: string;
  studentId: string;
  roadmapId: string;
  targetStepId: string;
  sourceBatchId: string;
  sourceEnrollmentId?: string;
  progressionDecisionId: string;
  status: ClassWaitlistStatus;
  learningFormat: string;
  preferredTimeSlot: string;
  queuedAt: Date;
  assignedAt?: Date | null;
  assignedBatchId?: string;
  assignedEnrollmentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
