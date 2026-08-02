import { Document } from "mongoose";

export interface ICourseCategory extends Document {
  name: string;
  ownerId: string;
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
