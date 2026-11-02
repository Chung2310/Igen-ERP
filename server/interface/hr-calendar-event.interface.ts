import { Document } from "mongoose";

export interface IHRCalendarEvent extends Document {
  companyCode: string;
  branchId?: string;
  type: "event" | "leave" | "wfh" | "exception" | "reminder" | "meeting";
  title: string;
  description?: string;
  location?: string;
  meetingLink?: string;
  participants?: string[];
  participantNames?: string[];
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
