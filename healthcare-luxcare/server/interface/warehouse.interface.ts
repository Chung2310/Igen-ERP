import type { Document } from "mongoose";

export interface IWarehouse extends Document {
  companyCode: string;
  branchId?: string;
  code: string;
  name: string;
  location?: string;
  managerName?: string;
  managerPhone?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
