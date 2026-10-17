export type DashboardPeriod = "today" | "week" | "month" | "year" | "custom";

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDashboardRange(period: DashboardPeriod, from: string, to: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = today;
  let end = now;
  if (period === "week") {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
  } else if (period === "custom") {
    start = new Date(`${from}T00:00:00`);
    end = new Date(`${to}T23:59:59.999`);
  }
  return { start, end, valid: !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end };
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
