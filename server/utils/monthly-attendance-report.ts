export interface MonthlyAttendanceEmployee {
  id: string;
  displayName: string;
  createdAt?: Date | string;
}

export interface MonthlyAttendanceLog {
  uid: string;
  status: string;
  date?: string;
}

export interface MonthlyAttendanceRow {
  employeeName: string;
  workedDays: number;
  absentDays: number;
  leaveDays: number;
  daysOff: number;
  lateDays: number;
  leftEarlyDays: number;
  unrecordedDays: number;
}

const fullWorkDayStatuses = new Set(["present", "late", "left-early", "late-left-early"]);
function localCreatedDate(value: Date | string | undefined) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(parsed);
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
}

export function buildMonthlyAttendanceReport(
  year: number,
  month: number,
  employees: MonthlyAttendanceEmployee[],
  logs: MonthlyAttendanceLog[],
  workingDates: string[] = [],
): MonthlyAttendanceRow[] {
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Tháng hoặc năm báo cáo chấm công không hợp lệ.");
  }

  const counts = new Map<string, MonthlyAttendanceRow>();
  const countedDates = new Map<string, Set<string>>();
  for (const employee of employees) {
    countedDates.set(employee.id, new Set());
    counts.set(employee.id, {
      employeeName: employee.displayName,
      workedDays: 0,
      absentDays: 0,
      leaveDays: 0,
      daysOff: 0,
      lateDays: 0,
      leftEarlyDays: 0,
      unrecordedDays: 0,
    });
  }

  for (const log of logs) {
    const row = counts.get(log.uid);
    if (!row) continue;
    if (typeof log.date === "string") countedDates.get(log.uid)?.add(log.date.slice(0, 10));
    const status = String(log.status || "").toLowerCase();
    if (fullWorkDayStatuses.has(status)) row.workedDays += 1;
    else if (status === "half-day") row.workedDays += 0.5;
    else if (status === "absent") row.absentDays += 1;
    else if (status === "approved-leave") row.leaveDays += 1;

    if (status === "late" || status === "late-left-early") row.lateDays += 1;
    if (status === "left-early" || status === "late-left-early") row.leftEarlyDays += 1;
  }

  return [...counts.entries()]
    .map(([employeeId, row]) => {
      const employee = employees.find(candidate => candidate.id === employeeId);
      const createdAt = localCreatedDate(employee?.createdAt);
      const counted = countedDates.get(employeeId) || new Set<string>();
      row.unrecordedDays = workingDates.filter(date => (!createdAt || createdAt <= date.slice(0, 10)) && !counted.has(date.slice(0, 10))).length;
      return row;
    })
    .map((row) => ({ ...row, daysOff: row.absentDays + row.leaveDays }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName, "vi"));
}
