export interface AttendanceWorkSchedule {
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
}

export interface PayrollApprovedLeave {
  employeeId: string;
  status: string;
  startDate: string | Date;
  endDate: string | Date;
}

const clockMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const calculateAttendanceWorkedMinutes = (
  checkIn: string | Date | undefined,
  checkOut: string | Date | undefined,
  schedule: AttendanceWorkSchedule,
  timeZone = "Asia/Ho_Chi_Minh",
) => {
  // Payroll treats an incomplete attendance log as zero worked minutes.
  if (!checkIn || !checkOut) return 0;

  const startDate = new Date(checkIn);
  let endDate = new Date(checkOut);
  // Manual attendance created before shift support may store an overnight
  // checkout on the same calendar date. Interpret it as the following day.
  if (endDate.getTime() < startDate.getTime()) {
    const corrected = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    if (corrected.getTime() >= startDate.getTime()) endDate = corrected;
  }
  const rawMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
  if (!schedule.lunchBreakStart || !schedule.lunchBreakEnd) return rawMinutes;

  const localClock = (value: Date) => new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);

  const start = clockMinutes(localClock(startDate));
  let end = clockMinutes(localClock(endDate));
  if (end < start) end += 24 * 60;

  const breakStart = clockMinutes(schedule.lunchBreakStart);
  let breakEnd = clockMinutes(schedule.lunchBreakEnd);
  if (breakEnd < breakStart) breakEnd += 24 * 60;
  const breakMinutes = Math.max(0, Math.min(end, breakEnd) - Math.max(start, breakStart));

  return Math.max(0, rawMinutes - breakMinutes);
};

export const attendanceTotalsFromMinutes = (workedMinutes: number, standardDailyMinutes: number) => ({
  totalHours: Math.round((workedMinutes / 60) * 10) / 10,
  totalDays: Math.round((workedMinutes / standardDailyMinutes) * 100) / 100,
});

/** Điểm công một ngày nằm trong khoảng 0..1; giờ vượt chuẩn được giữ cho báo cáo/tăng ca. */
export const attendanceDayCoefficient = (workedMinutes: number, standardDailyMinutes: number) => {
  if (standardDailyMinutes <= 0) return 0;
  return Math.min(1, Math.max(0, workedMinutes / standardDailyMinutes));
};

const formatDateInTimeZone = (value: string | Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const hasApprovedPayrollLeave = (
  applications: PayrollApprovedLeave[],
  employeeId: string,
  date: string,
  timeZone = "Asia/Ho_Chi_Minh",
) => applications.some((application) =>
  application.status === "approved"
  && application.employeeId === employeeId
  && date >= formatDateInTimeZone(application.startDate, timeZone)
  && date <= formatDateInTimeZone(application.endDate, timeZone),
);

export const attendanceDisplayStatus = (
  storedStatus: string,
  hasCheckIn: boolean,
  hasCheckOut: boolean,
  workedMinutes: number,
  standardDailyMinutes: number,
) => {
  if (!hasCheckIn || !hasCheckOut) return "Incomplete";
  if (workedMinutes < standardDailyMinutes) return "Partial";
  return storedStatus;
};
