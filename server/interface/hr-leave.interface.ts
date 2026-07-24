import { Document } from "mongoose";

export interface IHRLeaveTemplate extends Document {
  companyCode: string;
  name: string;
  fileUrl: string;
  fileName: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHRLeaveApplication extends Document {
  companyCode: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  status: "pending" | "approved" | "rejected";
  rejectReason?: string;
  note?: string;
  approvedBy?: string;
  chargeableDays?: number;
  chargeableDates?: string[];
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
