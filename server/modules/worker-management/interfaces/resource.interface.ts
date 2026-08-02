import { Document } from "mongoose";
import type { CustomFieldValues } from "./custom-field.interface";

// Phân loại tài nguyên là chuỗi động (quản lý qua ResourceCategory);
// các giá trị cũ 'ROOM' | 'VEHICLE' | 'EQUIPMENT' vẫn hợp lệ.
export type ResourceType = string;
export type ResourceStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

export interface IResourceBooking {
  _id?: string;
  purpose: string;
  by: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface IResource extends Document {
  customFields?: CustomFieldValues;
  name: string;
  type: ResourceType;
  identifier: string; // Số phòng, Biển số xe, Serial thiết bị
  capacity: string;
  status: ResourceStatus;
  bookings: IResourceBooking[];
  ownerId: string;
  branchId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
