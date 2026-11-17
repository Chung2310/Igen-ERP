export interface MonthlyAttendanceEmployee {
  id: string;
  displayName: string;
}

export interface MonthlyAttendanceLog {
  uid: string;
  status: string;
}

export interface MonthlyAttendanceRow {
  employeeName: string;
  workedDays: number;
  absentDays: number;
  leaveDays: number;
  daysOff: number;
  lateDays: number;
  leftEarlyDays: number;
}

const fullWorkDayStatuses = new Set(["present", "late", "left-early", "late-left-early"]);

export function buildMonthlyAttendanceReport(
  year: number,
  month: number,
  employees: MonthlyAttendanceEmployee[],
  logs: MonthlyAttendanceLog[],
): MonthlyAttendanceRow[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Tháng hoặc năm báo cáo chấm công không hợp lệ.");
  }

  const counts = new Map<string, MonthlyAttendanceRow>();
  for (const employee of employees) {
    counts.set(employee.id, {
      employeeName: employee.displayName,
      workedDays: 0,
      absentDays: 0,
      leaveDays: 0,
      daysOff: 0,
      lateDays: 0,
      leftEarlyDays: 0,
    });
  }

  for (const log of logs) {
    const row = counts.get(log.uid);
    if (!row) continue;
    const status = String(log.status || "").toLowerCase();
    if (fullWorkDayStatuses.has(status)) row.workedDays += 1;
    else if (status === "half-day") row.workedDays += 0.5;
    else if (status === "absent") row.absentDays += 1;
    else if (status === "approved-leave") row.leaveDays += 1;

    if (status === "late" || status === "late-left-early") row.lateDays += 1;
    if (status === "left-early" || status === "late-left-early") row.leftEarlyDays += 1;
  }

  return [...counts.values()]
    .map((row) => ({ ...row, daysOff: row.absentDays + row.leaveDays }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName, "vi"));
}
