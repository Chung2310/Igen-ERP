export interface AttendanceWorkSchedule {
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
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
  const endDate = new Date(checkOut);
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
