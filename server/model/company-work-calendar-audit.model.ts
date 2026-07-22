import { model, Schema } from "mongoose";
import type { ICompanyWorkCalendarAudit } from "../interface/company-work-calendar.interface";

const CompanyWorkCalendarAuditSchema = new Schema<ICompanyWorkCalendarAudit>({
  companyCode: { type: String, required: true, index: true },
  calendarDayId: { type: String, required: true, index: true },
  action: { type: String, enum: ["created", "updated", "enabled", "disabled", "synced"], required: true },
  actorId: { type: String, required: true, index: true },
  reason: { type: String, trim: true },
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const CompanyWorkCalendarAuditModel = model<ICompanyWorkCalendarAudit>("CompanyWorkCalendarAudit", CompanyWorkCalendarAuditSchema);
