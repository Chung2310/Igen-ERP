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
  attendanceLocations?: BranchAttendanceLocation[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchAttendanceLocation extends BranchAttendanceConfig {
  id: string;
  name: string;
  type: "office" | "business_trip";
  isActive: boolean;
}

export interface BranchAttendanceConfig {
  latitude: number;
  longitude: number;
  allowedRadius: number;
  allowedPublicIps: string[];
}
