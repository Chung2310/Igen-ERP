import { businessCalendarRange, businessDateKey } from '../../../shared/business-calendar';

export type DashboardPeriod = "today" | "week" | "month" | "quarter" | "year" | "custom";

export function localDateKey(date: Date): string {
  return businessDateKey(date);
}

export function getDashboardRange(period: DashboardPeriod, from: string, to: string, now = new Date()) {
  const range = businessCalendarRange(period, from, to, now);
  return { start: range?.start || new Date(NaN), end: range?.end || new Date(NaN), valid: Boolean(range) };
}

export function countCreatedInRange(records: Array<{ createdAt?: unknown }> | null, start: Date, end: Date): number | null {
  if (!records) return null;
  let count = 0;
  for (const record of records) {
    const created = new Date(record.createdAt as string);
    if (Number.isNaN(created.getTime())) return null;
    if (created >= start && created <= end) count += 1;
  }
  return count;
}
