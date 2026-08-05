import { Document } from "mongoose";

export interface IBatchMiniTestResult {
  studentId: string;
  score?: number;
  note?: string;
  assessedBy?: string;
  assessedAt?: Date;
}

export interface IBatchMiniTest extends Document {
  ownerId: string;
  branchId?: string;
  batchId: string;
  title: string;
  date: string;
  maxScore: number;
  createdBy: string;
  results: IBatchMiniTestResult[];
  createdAt?: Date;
  updatedAt?: Date;
}
