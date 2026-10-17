export type HrDashboardPeriod = "today" | "week" | "month" | "year" | "date";

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getHrDashboardPeriodRange(period: HrDashboardPeriod, selectedDate: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = today;
  let end = now;

  if (period === "week") {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
  } else if (period === "date") {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const chosen = new Date(year, month - 1, day);
    if (year && month && day && !Number.isNaN(chosen.getTime()) && localDateKey(chosen) === selectedDate) {
      start = chosen;
      end = new Date(year, month - 1, day, 23, 59, 59, 999);
    }
  }

  return { start, end };
}

export function countNewEmployeesInPeriod(
  employees: Array<{ createdAt?: unknown }> | null,
  period: HrDashboardPeriod,
  selectedDate: string,
  now = new Date(),
): number | null {
  if (!employees) return null;
  if (employees.length === 0) return 0;
  const { start, end } = getHrDashboardPeriodRange(period, selectedDate, now);
  let count = 0;
  for (const employee of employees) {
    const date = new Date(employee.createdAt as string);
    if (Number.isNaN(date.getTime())) return null;
    if (date >= start && date <= end) count += 1;
  }
  return count;
}
