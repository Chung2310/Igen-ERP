import { Document } from "mongoose";

export interface IBranch extends Document {
  companyCode: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  managerId?: string;
  pendingOwnerSetup?: boolean;
  locationConfig?: BranchAttendanceConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchAttendanceConfig {
  latitude: number;
  longitude: number;
  allowedRadius: number;
  allowedPublicIps: string[];
}
