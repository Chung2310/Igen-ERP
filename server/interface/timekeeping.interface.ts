import { Document } from "mongoose";

export interface ITimekeepingDetail {
  time: Date;
  latitude: number;
  longitude: number;
  distance: number;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface ITimekeepingLog extends Document {
  uid: string;
  companyCode: string;
  date: string; // YYYY-MM-DD
  checkIn?: ITimekeepingDetail;
  checkOut?: ITimekeepingDetail;
  status: "Present" | "Late" | "Absent" | "Approved-Leave";
  note?: string;
}
