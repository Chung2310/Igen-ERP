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
  /** Thang điểm được chốt tại lúc giao bài, không bị ảnh hưởng khi trung tâm đổi cấu hình sau này. */
  maxScore: number;
  instructorId: string;
  ownerId: string;
  branchId?: string;
  createdAt: Date;
  updatedAt: Date;
}
