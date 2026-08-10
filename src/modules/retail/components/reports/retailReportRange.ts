const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function inclusiveDayCount(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  return Math.floor((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000) + 1;
}

export function validateRetailReportRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to || !isCalendarDate(from) || !isCalendarDate(to)) {
    return "Vui lòng chọn đầy đủ khoảng ngày hợp lệ.";
  }
  const days = inclusiveDayCount(from, to);
  if (days < 1) return "Ngày bắt đầu không được sau ngày kết thúc.";
  if (days > 366) return "Khoảng báo cáo tối đa 366 ngày.";
  return "";
}
