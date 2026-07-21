import type { Document } from "mongoose";

export type CompanyWorkCalendarDayType = "holiday" | "substitute_holiday" | "working_override";
export type CompanyWorkCalendarSource = "system" | "admin";
export type CompanyWorkCalendarAction = "created" | "updated" | "enabled" | "disabled" | "synced";

export interface ICompanyWorkCalendarDay extends Document {
  companyCode: string;
  date: string;
  name: string;
  dayType: CompanyWorkCalendarDayType;
  source: CompanyWorkCalendarSource;
  sourceKey?: string;
  sourceYear: number;
  isApplied: boolean;
  adminReason?: string;
  lastAdminAction?: Exclude<CompanyWorkCalendarAction, "synced">;
  lastAdminBy?: string;
  lastAdminAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompanyWorkCalendarAudit extends Document {
  companyCode: string;
  calendarDayId: string;
  action: CompanyWorkCalendarAction;
  actorId: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Date;
}

export type HolidayBaselineDay = Pick<ICompanyWorkCalendarDay, "date" | "name" | "dayType" | "sourceKey" | "sourceYear">;
