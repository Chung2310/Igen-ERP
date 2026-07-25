export interface PayrollAttendanceLog { date: string; checkIn?: string; checkOut?: string; status: "Present" | "Late" | "Left-Early" | "Half-Day" | "Late-Left-Early" | "Absent" | "Approved-Leave"; }
export interface PayrollPaidLeave { date: string; payRate: number; }
export interface PayrollOvertime { minutes: number; category: "weekday" | "restDay" | "holiday"; }
export interface AttendancePayrollSummary { workedMinutes: number; shortageMinutes: number; paidLeaveMinutesByRate: { minutes: number; payRate: number }[]; overtime: PayrollOvertime[]; }

function timeToMinutes(value: string): number { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }

export function summarizeAttendanceForPayroll(input: { standardDailyMinutes: number; logs: PayrollAttendanceLog[]; paidLeaves: PayrollPaidLeave[]; overtime: PayrollOvertime[] }): AttendancePayrollSummary {
  const paidLeaveByDate = new Map(input.paidLeaves.map((leave) => [leave.date, leave]));
  let workedMinutes = 0;
  let shortageMinutes = 0;
  const paidLeaveMinutesByRate: { minutes: number; payRate: number }[] = [];
  for (const log of input.logs) {
    const leave = paidLeaveByDate.get(log.date);
    if (leave) { paidLeaveMinutesByRate.push({ minutes: input.standardDailyMinutes, payRate: leave.payRate }); continue; }
    const rawWorked = log.checkIn && log.checkOut ? Math.max(0, timeToMinutes(log.checkOut) - timeToMinutes(log.checkIn)) : 0;
    const worked = log.status === "Half-Day" ? rawWorked : Math.max(0, rawWorked - (rawWorked > 360 ? 60 : 0));
    workedMinutes += worked;
    shortageMinutes += Math.max(0, input.standardDailyMinutes - worked);
  }
  return { workedMinutes, shortageMinutes, paidLeaveMinutesByRate, overtime: input.overtime };
}
