type AttendanceReportEmployee = {
  _id?: unknown;
  uid?: unknown;
  displayName?: string | null;
};

type AttendanceReportLog = {
  uid?: unknown;
  status?: string | null;
  checkIn?: { time?: unknown } | null;
  checkOut?: { time?: unknown } | null;
};

const statusLabels: Record<string, string> = {
  Present: "Đúng giờ",
  Late: "Đi muộn",
  "Left-Early": "Về sớm",
  "Half-Day": "Nửa ngày",
  "Late-Left-Early": "Đi muộn, về sớm",
  Absent: "Vắng",
  "Approved-Leave": "Nghỉ phép",
};

function attendanceStatus(log: AttendanceReportLog | undefined): string {
  if (!log) return "Chưa ghi nhận";
  if (log.status === "Approved-Leave") return statusLabels[log.status];
  if (log.status === "Absent") return statusLabels[log.status];
  if (log.checkIn && !log.checkOut) {
    return log.status === "Late" || log.status === "Late-Left-Early" ? "Đã vào ca, đi muộn" : "Đã vào ca";
  }
  if (log.checkIn && log.checkOut && log.status === "Present") return "Đã vào và ra ca";
  return statusLabels[String(log.status)] || "Đã ghi nhận";
}

/** Build a chat-safe, name-based daily report without exposing internal user or log IDs. */
export function buildAttendanceReportRows(
  date: string,
  employees: readonly AttendanceReportEmployee[],
  logs: readonly AttendanceReportLog[],
) {
  const logsByEmployee = new Map(logs.map(log => [String(log.uid || ""), log]));

  return employees.map(employee => {
    const uid = String(employee._id || employee.uid || "");
    const log = logsByEmployee.get(uid);
    return {
      date,
      employeeName: String(employee.displayName || "Chưa cập nhật tên"),
      attendanceStatus: attendanceStatus(log),
      checkIn: log?.checkIn?.time ?? null,
      checkOut: log?.checkOut?.time ?? null,
    };
  });
}
