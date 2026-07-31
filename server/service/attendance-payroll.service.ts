export interface PayrollAttendanceLog { date: string; checkIn?: string; checkOut?: string; status: "Present" | "Late" | "Left-Early" | "Half-Day" | "Late-Left-Early" | "Absent" | "Approved-Leave"; }
export interface PayrollPaidLeave { date: string; payRate: number; }
export interface PayrollOvertime { minutes: number; category: "weekday" | "restDay" | "holiday"; night?: boolean; }
export interface AttendancePayrollSummary { workedMinutes: number; shortageMinutes: number; workedDays: number; shortageDays: number; paidLeaveMinutesByRate: { minutes: number; payRate: number }[]; overtime: PayrollOvertime[]; }

function timeToMinutes(value: string): number { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }

function elapsedMinutes(checkIn: string, checkOut: string): number {
  const start = timeToMinutes(checkIn);
  let end = timeToMinutes(checkOut);
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
}

function overlappingBreakMinutes(checkIn: string, checkOut: string, breakStart?: string, breakEnd?: string): number {
  if (!breakStart || !breakEnd) return 0;
  const start = timeToMinutes(checkIn);
  let end = timeToMinutes(checkOut);
  if (end < start) end += 24 * 60;
  const lunchStart = timeToMinutes(breakStart);
  let lunchEnd = timeToMinutes(breakEnd);
  if (lunchEnd < lunchStart) lunchEnd += 24 * 60;
  return Math.max(0, Math.min(end, lunchEnd) - Math.max(start, lunchStart));
}

export function summarizeAttendanceForPayroll(input: { standardDailyMinutes: number; lunchBreakStart?: string; lunchBreakEnd?: string; logs: PayrollAttendanceLog[]; paidLeaves: PayrollPaidLeave[]; overtime: PayrollOvertime[] }): AttendancePayrollSummary {
  const paidLeaveByDate = new Map(input.paidLeaves.map((leave) => [leave.date, leave]));
  let workedMinutes = 0;
  let shortageMinutes = 0;
  const paidLeaveMinutesByRate: { minutes: number; payRate: number }[] = [];
  for (const log of input.logs) {
    const leave = paidLeaveByDate.get(log.date);
    if (leave) { paidLeaveMinutesByRate.push({ minutes: input.standardDailyMinutes, payRate: leave.payRate }); continue; }
    const rawWorked = log.checkIn && log.checkOut ? elapsedMinutes(log.checkIn, log.checkOut) : 0;
    const breakMinutes = log.checkIn && log.checkOut && log.status !== "Half-Day"
      ? overlappingBreakMinutes(log.checkIn, log.checkOut, input.lunchBreakStart, input.lunchBreakEnd)
      : 0;
    const worked = Math.max(0, rawWorked - breakMinutes);
    workedMinutes += worked;
    shortageMinutes += Math.max(0, input.standardDailyMinutes - worked);
  }
  const roundDays = (minutes: number) => Math.round((minutes / input.standardDailyMinutes) * 100) / 100;
  return { workedMinutes, shortageMinutes, workedDays: roundDays(workedMinutes), shortageDays: roundDays(shortageMinutes), paidLeaveMinutesByRate, overtime: input.overtime };
}
