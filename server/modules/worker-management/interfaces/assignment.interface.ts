import { Document } from "mongoose";

export interface IAttachment {
  name: string;
  url: string;
  type: string;
  uploadedAt?: Date;
}

export interface IAssignment extends Document {
  title: string;
  description?: string;
  attachments: IAttachment[];
  batchId: string;
  courseId: string;
  dueDate?: Date;
  instructorId: string;
  ownerId: string;
  branchId?: string;
  createdAt: Date;
  updatedAt: Date;
}
