import { Document } from "mongoose";

export interface ITrainingEnrollment extends Document {
  courseId: string;
  courseTitle: string;
  uid: string;
  userName: string;
  companyCode: string;
  progress: number;
  status: "not_started" | "in_progress" | "completed";
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  completedLessons: string[];
  quizPassed: boolean;
}
