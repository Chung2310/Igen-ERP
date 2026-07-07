import { Document } from "mongoose";

export type CourseCategory = string;
export type CourseStatus = 'Hoạt động' | 'Tạm dừng';

export interface ICourse extends Document {
  code: string;
  title: string;
  category: CourseCategory;
  fee: string;
  duration: string;
  maxLearners: number;
  activeBatches: number;
  status: CourseStatus;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
