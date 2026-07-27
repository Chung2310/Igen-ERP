import { Document } from "mongoose";

export interface IBranch extends Document {
  companyCode: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  locationConfig?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
