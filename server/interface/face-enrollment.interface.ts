import type { Document, Types } from "mongoose";

export type FaceEnrollmentAction = "register" | "replace" | "delete";
export type FaceEnrollmentOutcome = "success" | "rejected" | "error";

export interface FaceEnrollmentEvidence {
  publicId: string;
  resourceType: string;
  type: string;
  format?: string;
  bytes?: number;
}

export interface IFaceEnrollmentAudit extends Document {
  actorId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  companyCode: string;
  action: FaceEnrollmentAction;
  outcome: FaceEnrollmentOutcome;
  reasonCode?: string;
  evidence?: FaceEnrollmentEvidence;
  attemptedAt: Date;
}