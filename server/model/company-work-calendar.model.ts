import { model, Schema } from "mongoose";
import type { ICompanyWorkCalendarDay } from "../interface/company-work-calendar.interface";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const CompanyWorkCalendarDaySchema = new Schema<ICompanyWorkCalendarDay>({
  companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  date: { type: String, required: true, match: LOCAL_DATE_PATTERN, index: true },
  name: { type: String, required: true, trim: true },
  dayType: { type: String, enum: ["holiday", "substitute_holiday", "working_override"], required: true },
  source: { type: String, enum: ["system", "admin"], required: true, index: true },
  sourceKey: { type: String, trim: true },
  sourceYear: { type: Number, required: true, min: 2000, max: 2200, index: true },
  isApplied: { type: Boolean, default: true, index: true },
  adminReason: { type: String, trim: true },
  lastAdminAction: { type: String, enum: ["created", "updated", "enabled", "disabled"] },
  lastAdminBy: { type: String },
  lastAdminAt: { type: Date },
}, { timestamps: true });

CompanyWorkCalendarDaySchema.index(
  { companyCode: 1, sourceYear: 1, sourceKey: 1 },
  { unique: true, partialFilterExpression: { source: "system", sourceKey: { $type: "string" } } },
);
CompanyWorkCalendarDaySchema.index({ companyCode: 1, date: 1, isApplied: 1 });

export const CompanyWorkCalendarDayModel = model<ICompanyWorkCalendarDay>("CompanyWorkCalendarDay", CompanyWorkCalendarDaySchema);
