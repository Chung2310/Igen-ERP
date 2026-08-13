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
  isWorkingDay: (uid: string, date: string) => boolean;
  isHoliday: (date: string) => boolean;
}

export interface AttendanceDailyOverviewResult {
  all: AttendanceOverviewEmployee[];
  groups: Record<AttendanceOverviewCategory, AttendanceOverviewEmployee[]>;
  counts: Record<AttendanceOverviewFilter, number>;
}

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
  return { all, groups, counts };
};
