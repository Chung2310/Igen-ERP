import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

export type CourseCategory = string;
export type CourseStatus = 'Hoạt động' | 'Tạm dừng';

export interface ICourse extends Document {
  customFields?: CustomFieldValues;
  code: string;
  title: string;
  category: CourseCategory;
  fee: string;
  duration: string;
  maxLearners: number;
  activeBatches: number;
  status: CourseStatus;
  ownerId: string;
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
