import { CompanyModel } from "../model/company.model";
import { CompanyWorkCalendarAuditModel } from "../model/company-work-calendar-audit.model";
import { CompanyWorkCalendarDayModel } from "../model/company-work-calendar.model";
import type { CompanyWorkCalendarDayType } from "../interface/company-work-calendar.interface";
import { getVietnamHolidayBaseline } from "./vietnam-holiday-provider";
import type { AnyBulkWriteOperation } from "mongoose";
import type { ICompanyWorkCalendarDay } from "../interface/company-work-calendar.interface";

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
const MAX_RANGE_DAYS = 3660;

export class CalendarValidationError extends Error {}
export class CalendarConflictError extends Error {}
export class CalendarNotFoundError extends Error {}

type CalendarRule = { dayType: CompanyWorkCalendarDayType; isApplied: boolean; name?: string };

function assertLocalDate(value: string): void {
  if (!LOCAL_DATE_PATTERN.test(value)) throw new CalendarValidationError("Ngày phải đúng định dạng YYYY-MM-DD.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new CalendarValidationError("Ngày không hợp lệ.");
  }
}

export function addDaysToLocalDate(value: string, days: number): string {
  assertLocalDate(value);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function listLocalDates(start: string, end: string): string[] {
  assertLocalDate(start);
  assertLocalDate(end);
  if (end < start) throw new CalendarValidationError("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
  const output: string[] = [];
  for (let current = start; current <= end; current = addDaysToLocalDate(current, 1)) {
    output.push(current);
    if (output.length > MAX_RANGE_DAYS) throw new CalendarValidationError("Khoảng ngày không được vượt quá 3660 ngày.");
  }
  return output;
}

export function toVietnamDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function evaluateWorkingDate(date: string, rules: CalendarRule[], workingDays: number[]): boolean {
  assertLocalDate(date);
  if (rules.some((rule) => rule.isApplied && rule.dayType === "working_override")) return true;
  if (rules.some((rule) => rule.isApplied && rule.dayType !== "working_override")) return false;
  return workingDays.includes(new Date(`${date}T00:00:00.000Z`).getUTCDay());
}

async function getCompanyWorkingDays(companyCode: string): Promise<number[]> {
  const company = await CompanyModel.findOne({ code: companyCode }).select("locationConfig.workingDays").lean();
  return company?.locationConfig?.workingDays?.length ? company.locationConfig.workingDays : DEFAULT_WORKING_DAYS;
}

async function getRulesByRange(companyCode: string, start: string, end: string) {
  return CompanyWorkCalendarDayModel.find({ companyCode, date: { $gte: start, $lte: end } }).lean();
}

function groupRules<T extends CalendarRule & { date: string }>(rules: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const rule of rules) grouped.set(rule.date, [...(grouped.get(rule.date) || []), rule]);
  return grouped;
}

export async function listWorkingDates(companyCode: string, start: string, end: string): Promise<string[]> {
  const dates = listLocalDates(start, end);
  const [workingDays, rules] = await Promise.all([getCompanyWorkingDays(companyCode), getRulesByRange(companyCode, start, end)]);
  const grouped = groupRules(rules);
  return dates.filter((date) => evaluateWorkingDate(date, grouped.get(date) || [], workingDays));
}

export async function countWorkingDays(companyCode: string, start: string, end: string): Promise<number> {
  return (await listWorkingDates(companyCode, start, end)).length;
}

export async function isWorkingDay(companyCode: string, date: string): Promise<boolean> {
  return (await listWorkingDates(companyCode, date, date)).length === 1;
}

export async function addWorkingDays(companyCode: string, start: string, days: number): Promise<string> {
  assertLocalDate(start);
  if (!Number.isInteger(days) || days < 0 || days > MAX_RANGE_DAYS) throw new CalendarValidationError("Số ngày làm việc không hợp lệ.");
  let current = start;
  while (!(await isWorkingDay(companyCode, current))) current = addDaysToLocalDate(current, 1);
  for (let remaining = days; remaining > 0;) {
    current = addDaysToLocalDate(current, 1);
    if (await isWorkingDay(companyCode, current)) remaining -= 1;
  }
  return current;
}

export async function getDayContext(companyCode: string, date: string) {
  assertLocalDate(date);
  const [working, rules] = await Promise.all([
    isWorkingDay(companyCode, date),
    CompanyWorkCalendarDayModel.find({ companyCode, date, isApplied: true }).lean(),
  ]);
  const preferred = rules.find((rule) => rule.dayType === "working_override") || rules[0];
  return { date, isWorkingDay: working, label: preferred?.name, dayType: preferred?.dayType };
}

export async function listCalendarDays(companyCode: string, year: number, appliedOnly = false) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new CalendarValidationError("Năm không hợp lệ.");
  return CompanyWorkCalendarDayModel.find({ companyCode, sourceYear: year, ...(appliedOnly ? { isApplied: true } : {}) }).sort({ date: 1, name: 1 }).lean();
}

async function assertNoConflict(companyCode: string, date: string, dayType: CompanyWorkCalendarDayType, excludeId?: string) {
  const opposite: CompanyWorkCalendarDayType[] = dayType === "working_override"
    ? ["holiday", "substitute_holiday"]
    : ["working_override"];
  const conflict = await CompanyWorkCalendarDayModel.exists({
    companyCode, date, isApplied: true, dayType: { $in: opposite }, ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (conflict) throw new CalendarConflictError("Ngày này đang có quy tắc ngày làm việc/ngày nghỉ đối nghịch được áp dụng.");
}

export async function syncYear(companyCode: string, year: number, actorId: string) {
  const baseline = getVietnamHolidayBaseline(year);
  const operations: AnyBulkWriteOperation<ICompanyWorkCalendarDay>[] = baseline.map((day) => ({
    updateOne: {
      filter: { companyCode, sourceYear: year, sourceKey: day.sourceKey, source: "system" },
      update: { $set: { date: day.date, name: day.name, dayType: day.dayType }, $setOnInsert: { companyCode, source: "system" as const, sourceYear: year, sourceKey: day.sourceKey, isApplied: true } },
      upsert: true,
    },
  }));
  await CompanyWorkCalendarDayModel.bulkWrite(operations);
  await CompanyWorkCalendarAuditModel.create({ companyCode, calendarDayId: `year:${year}`, action: "synced", actorId, after: { year, count: baseline.length } });
  return listCalendarDays(companyCode, year);
}

export async function createAdminDay(companyCode: string, actorId: string, input: { date: string; name: string; dayType: CompanyWorkCalendarDayType; isApplied?: boolean }) {
  assertLocalDate(input.date);
  if (!input.name?.trim()) throw new CalendarValidationError("Tên ngày là bắt buộc.");
  if (input.isApplied !== false) await assertNoConflict(companyCode, input.date, input.dayType);
  const created = await CompanyWorkCalendarDayModel.create({ ...input, name: input.name.trim(), companyCode, source: "admin", sourceYear: Number(input.date.slice(0, 4)), isApplied: input.isApplied !== false, lastAdminAction: "created", lastAdminBy: actorId, lastAdminAt: new Date() });
  await CompanyWorkCalendarAuditModel.create({ companyCode, calendarDayId: String(created._id), action: "created", actorId, after: JSON.parse(JSON.stringify(created.toObject())) });
  return created.toObject();
}

export async function updateDay(companyCode: string, id: string, actorId: string, input: { date?: string; name?: string; dayType?: CompanyWorkCalendarDayType; isApplied?: boolean; adminReason?: string }) {
  const existing = await CompanyWorkCalendarDayModel.findOne({ _id: id, companyCode });
  if (!existing) throw new CalendarNotFoundError("Không tìm thấy ngày lịch làm việc.");
  if (input.isApplied === false && !input.adminReason?.trim()) throw new CalendarValidationError("Cần nhập lý do khi tắt áp dụng.");
  const before = JSON.parse(JSON.stringify(existing.toObject())) as Record<string, unknown>;
  const patch = existing.source === "system"
    ? { isApplied: input.isApplied, adminReason: input.adminReason }
    : input;
  const nextDate = patch.date || existing.date;
  const nextType = patch.dayType || existing.dayType;
  if (patch.date) assertLocalDate(patch.date);
  if (patch.name !== undefined && !patch.name.trim()) throw new CalendarValidationError("Tên ngày là bắt buộc.");
  if (patch.isApplied !== false && (patch.isApplied === true || existing.isApplied)) await assertNoConflict(companyCode, nextDate, nextType, id);
  Object.assign(existing, patch, patch.name ? { name: patch.name.trim() } : {}, {
    sourceYear: Number(nextDate.slice(0, 4)),
    lastAdminAction: patch.isApplied === false ? "disabled" : patch.isApplied === true ? "enabled" : "updated",
    lastAdminBy: actorId,
    lastAdminAt: new Date(),
  });
  await existing.save();
  const after = JSON.parse(JSON.stringify(existing.toObject())) as Record<string, unknown>;
  await CompanyWorkCalendarAuditModel.create({ companyCode, calendarDayId: id, action: existing.lastAdminAction, actorId, reason: input.adminReason?.trim(), before, after });
  return after;
}

export async function listAudit(companyCode: string, calendarDayId: string) {
  return CompanyWorkCalendarAuditModel.find({ companyCode, calendarDayId }).sort({ createdAt: -1 }).lean();
}
