import { Schema, model } from "mongoose";
import { IHRCalendarEvent } from "../interface/hr-calendar-event.interface";

const HRCalendarEventSchema = new Schema<IHRCalendarEvent>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    type: { type: String, enum: ["event", "leave", "wfh", "exception", "reminder", "meeting"], required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String },
    location: { type: String, trim: true },
    meetingLink: { type: String, trim: true },
    participants: [{ type: String }],
    participantNames: [{ type: String }],
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    employeeId: { type: String, index: true },
    employeeName: { type: String },
    assigneeId: { type: String, index: true },
    status: { type: String, enum: ["pending", "approved", "completed", "active"], default: "active", index: true },
    creatorId: { type: String, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

export const HRCalendarEventModel = model<IHRCalendarEvent>("HRCalendarEvent", HRCalendarEventSchema);
