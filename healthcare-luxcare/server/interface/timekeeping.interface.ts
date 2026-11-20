import { Document } from "mongoose";

export interface ITimekeepingDetail {
  time: Date;
  latitude: number;
  longitude: number;
  distance: number;
  deviceInfo?: string;
  ipAddress?: string;
  attendanceLocationId?: string;
  attendanceLocationName?: string;
  attendanceLocationType?: "office" | "business_trip";
}

export interface ITimekeepingLog extends Document {
  uid: string;
  companyCode: string;
  branchId?: string;
  date: string; // YYYY-MM-DD
  checkIn?: ITimekeepingDetail;
  checkOut?: ITimekeepingDetail;
  status: "Present" | "Late" | "Left-Early" | "Half-Day" | "Late-Left-Early" | "Absent" | "Approved-Leave" | "Paid-Holiday";
  note?: string;
  manuallyAdjusted?: boolean;
  adjustedAt?: Date;
  adjustedBy?: string;
  adjustmentReason?: string;
  shiftId?: string;
  shiftName?: string;
  shiftCode?: string;
  workDate?: string;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
  standardMinutes?: number;
  breakPeriods?: { name: string; startTime: string; endTime: string; paid: boolean }[];
  assignmentSource?: "custom" | "employee" | "company" | "legacy" | "holiday";
}
