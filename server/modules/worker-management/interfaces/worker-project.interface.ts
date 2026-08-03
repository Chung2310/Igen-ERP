import { Document, Types } from "mongoose";

export interface IWorkerProject extends Document {
  companyCode: string;
  branchId?: Types.ObjectId;
  code: string;
  name: string;
  quota: number;
  workerIds: Types.ObjectId[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  location?: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  startDate: string;
  endDate: string;
  status: "planned" | "active" | "completed";
  note?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkerScope {
  companyCode: string;
  branchId?: string;
}

export interface WorkerProjectInput {
  code?: string;
  name: string;
  quota?: number | "";
  workerIds?: string[];
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  location?: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  } | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  note?: string;
}
