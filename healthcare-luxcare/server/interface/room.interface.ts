import type { Document } from "mongoose";

export type RoomType = "clinic" | "office" | "storage" | "treatment" | "meeting" | "other";

export interface IRoom extends Document {
  companyCode: string;
  branchId: string;
  code: string;
  name: string;
  type: RoomType;
  floor?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
