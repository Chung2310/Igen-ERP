export type AttendanceOverviewCategory =
  | "on_time"
  | "late"
  | "early"
  | "late_early"
  | "leave"
  | "wfh"
  | "absent"
  | "incomplete";

export type AttendanceOverviewFilter = "all" | AttendanceOverviewCategory;

export interface AttendanceOverviewEmployeeInput {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export interface AttendanceOverviewLog {
  uid: string;
  date: string;
  status?: string;
  checkIn?: { time?: string | Date } | null;
  checkOut?: { time?: string | Date } | null;
}

export interface AttendanceOverviewApplication {
  employeeId: string;
  status: string;
  type?: string;
  startDate: string | Date;
  endDate: string | Date;
}

export interface AttendanceOverviewEmployee extends AttendanceOverviewEmployeeInput {
  category: AttendanceOverviewCategory | "not_scheduled";
  checkIn: string;
  checkOut: string;
  status: string;
}

export interface AttendanceDailyOverviewInput {
  date: string;
  today: string;
  employees: AttendanceOverviewEmployeeInput[];
  logs: AttendanceOverviewLog[];
  applications?: AttendanceOverviewApplication[];
  attempts?: AttendanceOverviewAttempt[];
  currentMinutes?: number;
  checkInDeadline?: (uid: string) => number;
  checkOutDeadline?: (uid: string) => number;
  isWorkingDay: (uid: string, date: string) => boolean;
  isHoliday: (date: string) => boolean;
}

export type AttendanceErrorCategory = "location" | "network" | "face" | "forgot_checkin" | "forgot_checkout";
export interface AttendanceOverviewAttempt { uid: string; action: "check-in" | "check-out"; reasonCode: string; attemptedAt: string | Date; distance?: number; ipAddress?: string; displayName?: string; email?: string; }
export interface AttendanceErrorEmployee extends AttendanceOverviewEmployeeInput { category: AttendanceErrorCategory; reasonCode: string; action: string; attemptedAt?: string | Date; attemptCount: number; distance?: number; ipAddress?: string; }

export interface AttendanceDailyOverviewResult {
  all: AttendanceOverviewEmployee[];
  groups: Record<AttendanceOverviewCategory, AttendanceOverviewEmployee[]>;
  counts: Record<AttendanceOverviewFilter, number>;
  errors: Record<AttendanceErrorCategory, AttendanceErrorEmployee[]>;
  errorCounts: Record<AttendanceErrorCategory, number>;
}

export const attendanceErrorLabels: Record<AttendanceErrorCategory, string> = { location: "Sai vị trí", network: "Sai mạng Wi-Fi", face: "Lỗi khuôn mặt", forgot_checkin: "Quên check-in", forgot_checkout: "Quên check-out" };

export const attendanceOverviewCategories: AttendanceOverviewCategory[] = [
  "on_time", "late", "early", "late_early", "leave", "wfh", "absent", "incomplete",
];

export const attendanceOverviewLabels: Record<AttendanceOverviewFilter, string> = {
  all: "Tổng nhân sự",
  on_time: "Đúng giờ",
  late: "Đi muộn",
  early: "Về sớm",
  late_early: "Muộn và về sớm",
  leave: "Nghỉ phép",
  wfh: "Làm tại nhà",
  absent: "Vắng không phép",
  incomplete: "Thiếu chấm công",
};

const dateOnly = (value: string | Date) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
};

const formatTime = (value?: string | Date) => value
  ? new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date(value))
  : "--:--";

const approvedApplicationCategory = (
  applications: AttendanceOverviewApplication[], uid: string, date: string,
): AttendanceOverviewCategory | undefined => {
  const application = applications.find((item) =>
    item.status === "approved"
    && item.employeeId === uid
    && date >= dateOnly(item.startDate)
    && date <= dateOnly(item.endDate),
  );
  if (!application) return undefined;
  return application.type?.toLowerCase().includes("wfh") ? "wfh" : "leave";
};

const logCategory = (log: AttendanceOverviewLog): AttendanceOverviewCategory => {
  if (log.status === "Approved-Leave") return "leave";
  if (log.status === "Approved-WFH") return "wfh";
  if (log.status === "Late-Left-Early") return "late_early";
  if (log.status === "Late") return "late";
  if (log.status === "Left-Early") return "early";
  if (log.status === "Absent") return "absent";
  if (!log.checkIn?.time || !log.checkOut?.time || log.status === "Incomplete" || log.status === "Partial") return "incomplete";
  return "on_time";
};

export const buildAttendanceDailyOverview = (input: AttendanceDailyOverviewInput): AttendanceDailyOverviewResult => {
  const groups = Object.fromEntries(attendanceOverviewCategories.map((key) => [key, []])) as Record<AttendanceOverviewCategory, AttendanceOverviewEmployee[]>;
  const all = input.employees.map((employee): AttendanceOverviewEmployee => {
    const log = input.logs.find((item) => item.uid === employee.uid && item.date === input.date);
    const approved = approvedApplicationCategory(input.applications || [], employee.uid, input.date);
    const scheduled = input.date <= input.today && input.isWorkingDay(employee.uid, input.date) && !input.isHoliday(input.date);
    const category: AttendanceOverviewEmployee["category"] = approved || (log ? logCategory(log) : scheduled ? "absent" : "not_scheduled");
    const item: AttendanceOverviewEmployee = {
      ...employee,
      category,
      checkIn: formatTime(log?.checkIn?.time),
      checkOut: formatTime(log?.checkOut?.time),
      status: category === "not_scheduled" ? "Không có lịch làm việc" : attendanceOverviewLabels[category],
    };
    if (category !== "not_scheduled") groups[category].push(item);
    return item;
  });
  const counts = { all: all.length } as Record<AttendanceOverviewFilter, number>;
  attendanceOverviewCategories.forEach((category) => { counts[category] = groups[category].length; });
  const errors = Object.fromEntries(["location", "network", "face", "forgot_checkin", "forgot_checkout"].map((key) => [key, []])) as Record<AttendanceErrorCategory, AttendanceErrorEmployee[]>;
  const faceCodes = new Set(["invalid_image", "not_registered", "no_face", "multiple_faces", "spoof_detected", "face_mismatch", "model_unavailable"]);
  const attemptsByCategory = new Map<string, AttendanceOverviewAttempt[]>();
  for (const attempt of input.attempts || []) {
    const category: AttendanceErrorCategory | undefined = attempt.reasonCode === "outside_radius" ? "location" : attempt.reasonCode === "network_not_allowed" ? "network" : faceCodes.has(attempt.reasonCode) ? "face" : undefined;
    if (!category) continue;
    const key = `${category}:${attempt.uid}`;
    attemptsByCategory.set(key, [...(attemptsByCategory.get(key) || []), attempt]);
  }
  for (const [key, attempts] of attemptsByCategory) {
    const category = key.split(":")[0] as AttendanceErrorCategory;
    const latest = attempts.sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())[0];
    const employee = input.employees.find((item) => item.uid === latest.uid);
    errors[category].push({ ...employee, uid: latest.uid, displayName: latest.displayName || employee?.displayName, email: latest.email || employee?.email, category, reasonCode: latest.reasonCode, action: latest.action, attemptedAt: latest.attemptedAt, attemptCount: attempts.length, distance: latest.distance, ipAddress: latest.ipAddress });
  }
  if (input.date <= input.today) {
    for (const employee of all) {
      const past = input.date < input.today;
      const afterCheckIn = past || (input.currentMinutes ?? -1) > (input.checkInDeadline?.(employee.uid) ?? Number.POSITIVE_INFINITY);
      const afterCheckOut = past || (input.currentMinutes ?? -1) > (input.checkOutDeadline?.(employee.uid) ?? Number.POSITIVE_INFINITY);
      if (employee.category === "absent" && afterCheckIn) errors.forgot_checkin.push({ ...employee, category: "forgot_checkin", reasonCode: "forgot_checkin", action: "check-in", attemptCount: 0 });
      else if (employee.category === "incomplete" && employee.checkIn !== "--:--" && employee.checkOut === "--:--" && afterCheckOut) errors.forgot_checkout.push({ ...employee, category: "forgot_checkout", reasonCode: "forgot_checkout", action: "check-out", attemptCount: 0 });
    }
  }
  const errorCounts = Object.fromEntries(Object.entries(errors).map(([key, values]) => [key, values.length])) as Record<AttendanceErrorCategory, number>;
  return { all, groups, counts, errors, errorCounts };
};
