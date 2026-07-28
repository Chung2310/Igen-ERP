import { Document } from "mongoose";

export interface IResourceCategory extends Document {
  name: string;
  ownerId: string;
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
