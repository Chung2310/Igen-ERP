import { Document } from "mongoose";

export interface ICourseCategory extends Document {
  name: string;
  ownerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}
