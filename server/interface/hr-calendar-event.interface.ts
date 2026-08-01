import { Document } from "mongoose";

export interface IHRCalendarEvent extends Document {
  companyCode: string;
  branchId?: string;
  type: "event" | "leave" | "wfh" | "exception" | "reminder";
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  employeeId?: string;
  employeeName?: string;
  assigneeId?: string;
  status: "pending" | "approved" | "completed" | "active";
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}
