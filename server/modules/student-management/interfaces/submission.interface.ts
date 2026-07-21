import { Document } from "mongoose";
import { IAttachment } from "./assignment.interface";

export type SubmissionStatus = "submitted" | "graded" | "late";

export interface ISubmission extends Document {
  assignmentId: string;
  studentId: string;
  attachments: IAttachment[];
  studentNotes?: string;
  status: SubmissionStatus;
  score?: number;
  feedback?: string;
  submittedAt: Date;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
