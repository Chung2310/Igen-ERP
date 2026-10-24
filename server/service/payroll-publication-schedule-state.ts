import type { PayrollPublicationSchedule } from "../../src/shared/payrollPublicationSchedule";
import { reconciliationError } from "./payroll-reconciliation-state";

export function validatePublicationSchedule(input: any): PayrollPublicationSchedule {
  if (typeof input?.enabled !== "boolean"
    || !Number.isInteger(input.day) || input.day < 1 || input.day > 31
    || !Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23
    || !Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59
    || ![0, -1].includes(input.periodOffset)
    || !Number.isSafeInteger(input.version) || input.version < 0) {
    throw reconciliationError("Lịch không hợp lệ: ngày 1–31, giờ 0–23, phút 0–59 và kỳ tháng hiện tại/tháng trước.", 400);
  }
  return { enabled: input.enabled, day: input.day, hour: input.hour, minute: input.minute, periodOffset: input.periodOffset, version: input.version };
}

// Vietnam uses UTC+07:00 year round. Never depend on the server's local timezone.
const vietnamDate = (date: Date) => new Date(date.getTime() + 7 * 60 * 60 * 1000);
export function duePublicationPeriods(schedule: Pick<PayrollPublicationSchedule, "enabled" | "day" | "hour" | "minute" | "periodOffset"> & { effectiveFrom: Date | string }, now: Date): string[] {
  if (!schedule.enabled) return [];
  const start = vietnamDate(new Date(schedule.effectiveFrom));
  const current = vietnamDate(now);
  if (!Number.isFinite(start.getTime()) || now < new Date(schedule.effectiveFrom)) return [];
  const result: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor.getTime() <= current.getTime()) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const due = Date.UTC(year, month, Math.min(schedule.day, lastDay), schedule.hour - 7, schedule.minute);
    if (due <= now.getTime()) {
      const target = new Date(Date.UTC(year, month + schedule.periodOffset, 1));
      result.push(`${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    cursor.setUTCMonth(month + 1);
  }
  return result;
}
