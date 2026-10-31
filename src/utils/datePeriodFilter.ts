export type DatePeriodMode = "all" | "day" | "month" | "range";

export type DatePeriodFilterValue = {
  mode: DatePeriodMode;
  day: string;
  month: string;
  from: string;
  to: string;
};

export type DatePeriodRange = { from?: string; to?: string };

export const emptyDatePeriodFilter = (): DatePeriodFilterValue => ({
  mode: "all",
  day: "",
  month: "",
  from: "",
  to: "",
});

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function toIsoDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function toIsoMonthString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function getTodayDateString(): string {
  return toIsoDateString(new Date());
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toIsoDateString(d);
}

export function getCurrentMonthString(): string {
  return toIsoMonthString(new Date());
}

export function getLastMonthString(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return toIsoMonthString(d);
}

export function getDaysAgoDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIsoDateString(d);
}

export function formatDateVi(dateStr?: string): string {
  if (!dateStr) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return dateStr;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatMonthVi(monthStr?: string): string {
  if (!monthStr) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return monthStr;
  return `Tháng ${match[2]}/${match[1]}`;
}

export function getMonthDateRange(month: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${pad2(lastDay)}`,
  };
}

export function getDatePeriodRange(value: DatePeriodFilterValue): DatePeriodRange {
  if (value.mode === "day" && value.day) return { from: value.day, to: value.day };
  if (value.mode === "month") return getMonthDateRange(value.month) || {};
  if (value.mode === "range") return { from: value.from || undefined, to: value.to || undefined };
  return {};
}

export function isDateInPeriod(value: string | number | Date | undefined, range: DatePeriodRange): boolean {
  if (!range.from && !range.to) return true;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return false;
  const start = range.from ? new Date(`${range.from}T00:00:00+07:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = range.to ? new Date(`${range.to}T23:59:59.999+07:00`).getTime() : Number.POSITIVE_INFINITY;
  return timestamp >= start && timestamp <= end;
}

export function formatPeriodSummary(value: DatePeriodFilterValue): string {
  if (value.mode === "all") return "Tất cả thời gian";
  if (value.mode === "day") {
    if (value.day === getTodayDateString()) return `Hôm nay (${formatDateVi(value.day)})`;
    if (value.day === getYesterdayDateString()) return `Hôm qua (${formatDateVi(value.day)})`;
    return `Ngày ${formatDateVi(value.day)}`;
  }
  if (value.mode === "month") {
    if (value.month === getCurrentMonthString()) return `Tháng này (${value.month.slice(5, 7)}/${value.month.slice(0, 4)})`;
    if (value.month === getLastMonthString()) return `Tháng trước (${value.month.slice(5, 7)}/${value.month.slice(0, 4)})`;
    return formatMonthVi(value.month);
  }
  if (value.mode === "range") {
    if (value.from && value.to) {
      if (value.from === value.to) return `Ngày ${formatDateVi(value.from)}`;
      return `${formatDateVi(value.from)} - ${formatDateVi(value.to)}`;
    }
    if (value.from) return `Từ ${formatDateVi(value.from)}`;
    if (value.to) return `Đến ${formatDateVi(value.to)}`;
    return "Khoảng ngày";
  }
  return "Bộ lọc thời gian";
}
