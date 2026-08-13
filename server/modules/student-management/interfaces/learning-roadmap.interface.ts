import { Document } from "mongoose";

export type ProgressionMatchMode = "all" | "any";

export interface IProgressionPolicy {
  matchMode: ProgressionMatchMode;
  minAttendanceRate?: number | null;
  minAssignmentRate?: number | null;
  minMiniTestRate?: number | null;
  minExamRate?: number | null;
}

export interface ILearningRoadmapStep {
  id: string;
  courseId: string;
  order: number;
  minClassSize: number;
  maxClassSize: number;
  eligibilityPolicy: IProgressionPolicy;
}

export interface ILearningRoadmap extends Document {
  ownerId: string;
  branchId?: string;
  code: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  steps: ILearningRoadmapStep[];
  createdAt?: Date;
  updatedAt?: Date;
}
