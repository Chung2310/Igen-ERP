import { Document } from "mongoose";

export type StudentFaceEnrollmentAction = "register" | "replace" | "delete";
export type StudentFaceEnrollmentOutcome = "success" | "rejected" | "error";

export interface IStudentFaceEnrollmentEvidence {
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
}

export interface IStudentFaceEnrollmentAudit extends Document {
  actorId: string;
  studentId: string;
  ownerId: string;
  action: StudentFaceEnrollmentAction;
  outcome: StudentFaceEnrollmentOutcome;
  reasonCode?: string;
  evidence?: IStudentFaceEnrollmentEvidence;
  attemptedAt: Date;
}
