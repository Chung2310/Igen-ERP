import { Document } from "mongoose";

export interface IMiniTestResult {
  id: string;
  title: string;
  date: string;
  score: number;
  maxScore: number;
  note?: string;
  assessedBy: string;
  assessedAt: Date;
}

export interface IStudentQualityRecord extends Document {
  ownerId: string;
  branchId?: string;
  batchId: string;
  studentId: string;
  attitudeNote: string;
  teacherAssessment: string;
  miniTests: IMiniTestResult[];
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
