import type { Document } from "mongoose";

export interface IDepartment extends Document {
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  managerUid?: string;
  managerName?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
