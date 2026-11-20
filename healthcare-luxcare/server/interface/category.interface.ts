import type { Document } from "mongoose";

export interface ICategory extends Document {
  companyCode: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
