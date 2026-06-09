import { Document } from "mongoose";

export interface IRolePermission extends Document {
  companyCode: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}
