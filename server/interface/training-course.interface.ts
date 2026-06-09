import { Document } from "mongoose";

export interface ILesson {
  title: string;
  url: string;
  type: "youtube" | "document" | "other";
}

export interface IQuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface ITrainingCourse extends Document {
  title: string;
  description: string;
  category: string;
  tags: string[];
  isRequired: boolean;
  icon: string;
  imageUrl?: string;
  duration: string;
  instructor: string;
  companyCode: string;
  creatorUid: string;
  createdAt: Date;
  enrolledCount: number;
  companyProgress: number;
  autoAssignOnboarding: boolean;
  lessons: ILesson[];
  quizzes: IQuizQuestion[];
}
