import { Schema, model } from "mongoose";
import { ITrainingCourse } from "../interface/training-course.interface";

const LessonSchema = new Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: false },
    type: { type: String, enum: ["youtube", "document", "other", "text", "video"], required: true },
    content: { type: String },
    fileName: { type: String },
    uploadToken: { type: String },
  },
  { _id: false }
);

const QuizQuestionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
  },
  { _id: false }
);

const TrainingCourseSchema = new Schema<ITrainingCourse>({
  title: { type: String, required: true, index: true },
  description: { type: String, required: false },
  category: { type: String, required: true, index: true },
  tags: { type: [String], default: [] },
  isRequired: { type: Boolean, default: false },
  icon: { type: String, required: true },
  imageUrl: { type: String },
  duration: { type: String, required: true },
  instructor: { type: String, required: true },
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, index: true },
  creatorUid: { type: String, required: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  enrolledCount: { type: Number, default: 0 },
  companyProgress: { type: Number, default: 0 },
  autoAssignOnboarding: { type: Boolean, default: false },
  lessons: { type: [LessonSchema], default: [] },
  quizzes: { type: [QuizQuestionSchema], default: [] },
});

export const TrainingCourseModel = model<ITrainingCourse>("TrainingCourse", TrainingCourseSchema);
