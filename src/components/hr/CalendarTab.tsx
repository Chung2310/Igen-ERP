import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { ModuleNavigation, ModuleNavigationButton } from "../common/ModuleNavigation";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Users,
  Clock,
  Info,
  CheckCircle,
  X,
  Check,
  RefreshCw,
  Eye,
  ChevronDown
} from "lucide-react";
import { UserProfile, EmployeeNode } from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { companyWorkCalendarService, WorkCalendarDay } from "../../services/companyWorkCalendarService";
import { HrFormSelect } from "./HrFormSelect";
import { DateInput24 } from "../common/TimeInput24";
import AttendanceUtilityMenu from "./AttendanceUtilityMenu";
import AttendanceDailyOverview from "./AttendanceDailyOverview";
import { buildAttendanceDailyOverview } from "../../utils/attendanceDailyOverview";
import {
  exportAttendanceExcel,
  type AttendanceExportKind,
} from "../../utils/attendanceExcel";
import {
  attendanceDisplayStatus,
  attendanceDayCoefficient,
  attendanceTotalsFromMinutes,
  calculateAttendanceWorkedMinutes,
  hasApprovedPayrollLeave,
} from "../../utils/attendancePayroll";

interface CalendarTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  isManager: boolean;
  /** True when the user can approve/create leave, wfh, and exception entries for others. */
  canManage?: boolean;
  /** Allows editing existing attendance logs without granting leave-management rights. */
  canEditAttendance?: boolean;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  /** True when the user can approve leave applications and manage request templates. */
  canApproveLeave?: boolean;
}

interface CalendarItem {
  _id?: string;
  id?: string;
  companyCode: string;
  type: "event" | "leave" | "wfh" | "exception" | "reminder";
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  employeeId?: string;
  employeeName?: string;
  assigneeId?: string;
  status: "pending" | "approved" | "completed" | "active";
  creatorId: string;
  createdAt?: string;
}

interface EffectiveWorkHours {
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
}

const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];

const LeaveRequestsTab = lazy(() => import("./LeaveRequestsTab"));

export default function CalendarTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  canManage,
  canEditAttendance = false,
  employees,
  usersList = [],
  canApproveLeave
}: CalendarTabProps) {
  // Fall back to role-string checks only when the caller doesn't pass canManage,
  // so other embedders of this component keep working unchanged.
  const canManageAttendance = canManage ?? (isManager || userProfile?.role === "admin" || userProfile?.role === "superadmin");
  // Same fix as canManageAttendance: a custom role granted timekeeping:manage
  // must be able to see/approve everyone's leave requests, not just their own.
  const isLeaveAdmin = canManageAttendance;
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "superadmin";
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  // Sub-tab Navigation
  const [currentSubTab, setCurrentSubTab] = useState<"schedule" | "attendance" | "requests">(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    return section === "attendance" || section === "requests" ? section : "schedule";
  });

  // Đơn nghỉ đã duyệt được dùng để tính công trong tab Lịch sử chấm công.
  const [applications, setApplications] = useState<any[]>([]);


  // Time States
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  // Data States
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [appliedHolidays, setAppliedHolidays] = useState<WorkCalendarDay[]>([]);
  const [workingDaysByUid, setWorkingDaysByUid] = useState<Record<string, number[]>>({});
  const [companyWorkingDays, setCompanyWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workHoursByUid, setWorkHoursByUid] = useState<Record<string, EffectiveWorkHours>>({});
  const [companyWorkHours, setCompanyWorkHours] = useState<EffectiveWorkHours>({
    checkInLimit: "08:30", checkOutLimit: "17:30", lunchBreakStart: "12:00", lunchBreakEnd: "13:00",
  });

  // Timekeeping logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit] = useState(10);
  const [logFilterEmployee, setLogFilterEmployee] = useState(userProfile?.uid || "all");
  const [expandedEmployeeUid, setExpandedEmployeeUid] = useState<string | null>(null);
  const [mobileAttendanceViewMode, setMobileAttendanceViewMode] = useState<"table" | "list">("list");
  const [logFilterStatus, setLogFilterStatus] = useState("all");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [attendanceLogsLoadedSuccessfully, setAttendanceLogsLoadedSuccessfully] = useState(false);
  const [attendanceAttempts, setAttendanceAttempts] = useState<any[]>([]);
  const [attendanceAttemptsLoading, setAttendanceAttemptsLoading] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editAttendanceStatus, setEditAttendanceStatus] = useState("Present");
  const [editAttendanceNote, setEditAttendanceNote] = useState("");
  const [editAttendanceReason, setEditAttendanceReason] = useState("");
  const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);
  const [attendanceSectionMode, setAttendanceSectionMode] = useState<"overview" | "detail">("overview");
  const attendancePanelRef = useRef<HTMLDivElement>(null);
  const attendanceTableScrollRef = useRef<HTMLDivElement>(null);
  const [isAttendanceFullscreen, setIsAttendanceFullscreen] = useState(false);
  const [fullscreenWidth, setFullscreenWidth] = useState(() => typeof window === "undefined" ? 0 : window.innerWidth);
  useEffect(() => {
    const syncFullscreen = () => setIsAttendanceFullscreen(document.fullscreenElement === attendancePanelRef.current);
    const syncWidth = () => setFullscreenWidth(window.innerWidth);
    document.addEventListener("fullscreenchange", syncFullscreen);
    window.addEventListener("resize", syncWidth);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      window.removeEventListener("resize", syncWidth);
    };
  }, []);
  const scrollAttendanceTable = (direction: -1 | 1) => {
    const container = attendanceTableScrollRef.current;
    if (container) container.scrollBy({ left: direction * Math.max(280, container.clientWidth * 0.7), behavior: "smooth" });
  };
  const toggleAttendanceFullscreen = async () => {
    try {
      if (document.fullscreenElement === attendancePanelRef.current) await document.exitFullscreen();
      else await attendancePanelRef.current?.requestFullscreen();
    } catch {
      toast.error("Không thể mở toàn màn hình trên trình duyệt này.");
    }
  };
  const [attendanceOverviewDate, setAttendanceOverviewDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  // Attendance View Mode & Week selection states
  const [attendanceViewMode, setAttendanceViewMode] = useState<"table" | "week">("table");
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());

  // Monthly timesheet states
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [empSearchQuery, setEmpSearchQuery] = useState<string>("");
  const [cellDisplayMode, setCellDisplayMode] = useState<"coeff" | "hours">("coeff");
  const [isDisplayModeDropdownOpen, setIsDisplayModeDropdownOpen] = useState<boolean>(false);
  const [isScheduleMode, setIsScheduleMode] = useState<boolean>(false);

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const selectedAttendanceMonthRange = () => {
    const month = String(selectedMonth).padStart(2, "0");
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    return {
      start: `${selectedYear}-${month}-01`,
      end: `${selectedYear}-${month}-${String(lastDay).padStart(2, "0")}`,
    };
  };

  const getStartAndEndOfWeek = (date: Date) => {
    const tempDate = new Date(date);
    const day = tempDate.getDay();
    const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(tempDate.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const getWeekDates = (date: Date) => {
    const { monday } = getStartAndEndOfWeek(date);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const getWeeksOfYear = (year: number) => {
    const d = new Date(year, 0, 1);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const firstMonday = new Date(d.setDate(diff));

    const weeks = [];
    const current = new Date(firstMonday);

    while (current.getFullYear() === year || (current.getFullYear() === year - 1 && weeks.length === 0)) {
      const mon = new Date(current);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      weeks.push({
        monday: mon,
        sunday: sun,
      });

      current.setDate(current.getDate() + 7);
    }
    return weeks;
  };

  const formatWeekOption = (monday: Date, sunday: Date) => {
    const formatD = (d: Date) => String(d.getDate()).padStart(2, "0");
    const formatM = (d: Date) => String(d.getMonth() + 1).padStart(2, "0");
    return `${formatD(monday)}/${formatM(monday)} tới ${formatD(sunday)}/${formatM(sunday)}`;
  };

  useEffect(() => {
    if (attendanceViewMode === "week") {
      const { monday, sunday } = getStartAndEndOfWeek(currentWeekDate);
      setLogStartDate(formatLocalDate(monday));
      setLogEndDate(formatLocalDate(sunday));
      setLogsPage(1);
    } else {
      setLogStartDate("");
      setLogEndDate("");
      setLogsPage(1);
    }
  }, [attendanceViewMode, currentWeekDate]);

  // Filters State
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals States
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);

  // Fetch Items
  const fetchCalendarItems = async () => {
    if (!selectedCompanyCode) return;
    setLoading(true);
    try {
      const url = `/api/v1/crud/hr-calendar-events?companyCode=${encodeURIComponent(selectedCompanyCode)}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        throw new Error("Không thể tải danh sách lịch.");
      }

      const json = await res.json();
      const list: CalendarItem[] = (json.data || []).map((item: any) => ({
        ...item,
        id: item._id,
      }));
      setItems(list);
    } catch (err: any) {
      console.error("Lỗi khi tải lịch:", err);
      toast.error(getApiErrorMessage(err, "Không thể tải dữ liệu lịch trình."));
    } finally {
      setLoading(false);
    }
  };

  const fetchTimekeepingLogs = async () => {
    setIsLogsLoading(true);
    setAttendanceLogsLoadedSuccessfully(false);
    try {
      const monthRange = selectedAttendanceMonthRange();
      let startDate = logStartDate || monthRange.start;
      let endDate = logEndDate || monthRange.end;
      if (attendanceSectionMode === "overview") {
        startDate = attendanceOverviewDate;
        endDate = attendanceOverviewDate;
      }
      let url = `/api/v1/crud/timekeeping-logs?companyCode=${encodeURIComponent(selectedCompanyCode)}&limit=10000&sort=date`;

      if (!isManager) {
        url += `&uid=${userProfile?.uid}`;
      } else if (attendanceViewMode === "week" && logFilterEmployee !== "all") {
        url += `&uid=${logFilterEmployee}`;
      }

      url += `&date[$gte]=${startDate}&date[$lte]=${endDate}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });
      if (res.ok) {
        const result = await res.json();
        setLogs(result.data || []);
        setAttendanceLogsLoadedSuccessfully(true);
      } else {
        throw new Error("Không thể tải lịch sử chấm công.");
      }
    } catch (err) {
      console.error("Lỗi khi tải lịch sử chấm công:", err);
      toast.error(getApiErrorMessage(err, "Không thể tải lịch sử chấm công."));
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchApplications = async () => {
    if (!selectedCompanyCode) return;
    try {
      const res = await fetch(`/api/v1/crud/hr-leave-applications?companyCode=${encodeURIComponent(selectedCompanyCode)}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setApplications(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };


  useEffect(() => {
    if (currentSubTab === "attendance" && selectedCompanyCode) fetchApplications();
  }, [currentSubTab, selectedCompanyCode]);


  useEffect(() => {
    fetchCalendarItems();
  }, [selectedCompanyCode]);

  useEffect(() => {
    if (userProfile?.uid) {
      setLogFilterEmployee(userProfile.uid);
    }
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!selectedCompanyCode) return;
    const activeYear = currentSubTab === "attendance"
      ? attendanceSectionMode === "overview"
        ? Number(attendanceOverviewDate.slice(0, 4))
        : selectedYear
      : year;
    companyWorkCalendarService
      .list(activeYear, true)
      .then(setAppliedHolidays)
      .catch(() => setAppliedHolidays([]));
  }, [selectedCompanyCode, year, selectedYear, currentSubTab, attendanceSectionMode, attendanceOverviewDate]);

  const holidayByDate = new Map(appliedHolidays.map((h) => [h.date, h]));

  useEffect(() => {
    if (!selectedCompanyCode) return;
    fetch("/api/v1/timekeeping/work-hours", {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    })
      .then((res) => res.json())
      .then((result) => {
        const map: Record<string, number[]> = {};
        const hoursMap: Record<string, EffectiveWorkHours> = {};
        (result?.data || []).forEach((u: any) => {
          if (u.workHoursConfig?.useCustom && Array.isArray(u.workHoursConfig.workingDays) && u.workHoursConfig.workingDays.length) {
            map[u._id] = u.workHoursConfig.workingDays;
            hoursMap[u._id] = u.workHoursConfig;
          }
        });
        setWorkingDaysByUid(map);
        setWorkHoursByUid(hoursMap);
      })
      .catch(() => { setWorkingDaysByUid({}); setWorkHoursByUid({}); });

    fetch("/api/v1/timekeeping/company-location", {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    })
      .then((res) => res.json())
      .then((result) => {
        setCompanyWorkHours(result?.data || {});
        setCompanyWorkingDays(
          Array.isArray(result?.data?.workingDays) && result.data.workingDays.length
            ? result.data.workingDays
            : [1, 2, 3, 4, 5]
        );
      })
      .catch(() => {
        setCompanyWorkingDays([1, 2, 3, 4, 5]);
        setCompanyWorkHours({ checkInLimit: "08:30", checkOutLimit: "17:30", lunchBreakStart: "12:00", lunchBreakEnd: "13:00" });
      });
  }, [selectedCompanyCode]);

  const isCustomWorkingDay = (uid: string, dow: number) => {
    const customDays = workingDaysByUid[uid];
    return (customDays || companyWorkingDays).includes(dow);
  };

  useEffect(() => {
    if (currentSubTab === "attendance" && selectedCompanyCode) {
      fetchTimekeepingLogs();
    }
  }, [currentSubTab, logFilterEmployee, logStartDate, logEndDate, selectedCompanyCode, selectedMonth, selectedYear, attendanceSectionMode, attendanceOverviewDate]);

  useEffect(() => {
    if (currentSubTab !== "attendance" || attendanceSectionMode !== "overview" || !canManageAttendance) return;
    setAttendanceAttemptsLoading(true);
    fetch(`/api/v1/timekeeping/attempts?date=${attendanceOverviewDate}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
      .then(async (response) => { if (!response.ok) throw new Error("Không thể tải lỗi chấm công."); return response.json(); })
      .then((result) => setAttendanceAttempts(result.data || []))
      .catch((error) => { setAttendanceAttempts([]); toast.error(getApiErrorMessage(error, "Không thể tải lỗi chấm công.")); })
      .finally(() => setAttendanceAttemptsLoading(false));
  }, [currentSubTab, attendanceSectionMode, attendanceOverviewDate, canManageAttendance, selectedCompanyCode]);

  const renderAttendanceTab = () => {
    const getUserDetail = (uid: string) => {
      const uDetail = usersList.find((u) => u.uid === uid || (u as any)._id === uid);
      return {
        displayName: uDetail?.displayName || "Nhân viên iGen",
        photoURL: uDetail?.photoURL || "",
        email: uDetail?.email || "",
      };
    };

    const formatLogTime = (timeStr: any) => {
      if (!timeStr) return "--:--";
      const date = new Date(timeStr);
      return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    };

    const todayStr = formatLocalDate(new Date());

    // Danh sách nhân viên hiển thị trên sidebar và lưới
    const targetEmployees = isManager
      ? usersList
      : (userProfile ? [userProfile] : []);

    // Lọc theo thanh search sidebar
    const sidebarEmployees = targetEmployees.filter(emp => {
      if (!empSearchQuery) return true;
      const q = empSearchQuery.toLowerCase();
      return (
        (emp.displayName || "").toLowerCase().includes(q) ||
        (emp.email || "").toLowerCase().includes(q)
      );
    });

    const overviewResult = buildAttendanceDailyOverview({
      date: attendanceOverviewDate,
      today: todayStr,
      employees: (attendanceLogsLoadedSuccessfully ? targetEmployees : []).map((employee) => ({
        uid: employee.uid,
        displayName: employee.displayName,
        email: employee.email,
        photoURL: employee.photoURL,
      })),
      logs,
      applications,
      attempts: attendanceAttempts,
      currentMinutes: new Date().getHours() * 60 + new Date().getMinutes(),
      checkInDeadline: (uid) => { const value = (workHoursByUid[uid] || companyWorkHours).checkInLimit || "08:30"; const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; },
      checkOutDeadline: (uid) => { const value = (workHoursByUid[uid] || companyWorkHours).checkOutLimit || "17:30"; const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; },
      isWorkingDay: (uid, date) => isCustomWorkingDay(uid, new Date(`${date}T00:00:00`).getDay()),
      isHoliday: (date) => {
        const holiday = holidayByDate.get(date);
        return Boolean(holiday?.isApplied && holiday.dayType !== "working_override");
      },
    });

    // Tính số ngày trong tháng đã chọn
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dayColumns: number[] = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Hàm lấy thứ của ngày (0=CN, 1=T2,..., 6=T7)
    const getDayOfWeek = (day: number) => {
      return new Date(selectedYear, selectedMonth - 1, day).getDay();
    };

    const dayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    // Hàm tính hệ số công theo trạng thái
    const clockMinutes = (value?: string) => {
      if (!value) return 0;
      const [hours, minutes] = value.split(":").map(Number);
      return hours * 60 + minutes;
    };
    const clockDuration = (start?: string, end?: string) => {
      if (!start || !end) return 0;
      let result = clockMinutes(end) - clockMinutes(start);
      if (result < 0) result += 24 * 60;
      return result;
    };
    const effectiveHours = (uid: string): EffectiveWorkHours => workHoursByUid[uid] || companyWorkHours;
    const standardDailyMinutes = (uid: string) => {
      const schedule = effectiveHours(uid);
      return Math.max(1, clockDuration(schedule.checkInLimit, schedule.checkOutLimit) - clockDuration(schedule.lunchBreakStart, schedule.lunchBreakEnd));
    };
    const scheduleFromLog = (uid: string, log?: any): EffectiveWorkHours => {
      const unpaidBreak = log?.breakPeriods?.find((item: any) => !item.paid);
      if (!log?.scheduledStartAt || !log?.scheduledEndAt) return effectiveHours(uid);
      return {
        checkInLimit: formatLogTime(log.scheduledStartAt),
        checkOutLimit: formatLogTime(log.scheduledEndAt),
        lunchBreakStart: unpaidBreak?.startTime,
        lunchBreakEnd: unpaidBreak?.endTime,
      };
    };
    const calculateWorkedMinutes = (uid: string, checkIn?: string | Date, checkOut?: string | Date, log?: any) =>
      calculateAttendanceWorkedMinutes(checkIn, checkOut, scheduleFromLog(uid, log));

    // Hàm lấy nhãn ngắn trạng thái hiển thị trong ô
    const getStatusShort = (status: string): string => {
      switch (status) {
        case "Present": return "Đúng giờ";
        case "Late": return "Muộn";
        case "Approved-Leave": return "Phép";
        case "Approved-WFH": return "WFH";
        case "Approved-Exception": return "Ngoại lệ";
        case "Left-Early": return "Về sớm";
        case "Half-Day": return "½ Công";
        case "Late-Left-Early": return "Muộn+Sớm";
        case "Incomplete": return "Thiếu chấm công";
        case "Partial": return "Thiếu công";
        case "Absent": return "Vắng";
        default: return "";
      }
    };

    // Hàm tính dữ liệu một ô ngày cho một nhân viên
    const getDayCellData = (emp: any, day: number) => {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dbLog = logs.find((l: any) => l.uid === emp.uid && l.date === dateStr);
      const holiday = holidayByDate.get(dateStr);
      const defaultWeekend = !isCustomWorkingDay(emp.uid, getDayOfWeek(day));
      const isWeekend = holiday && holiday.isApplied
        ? holiday.dayType === "working_override"
          ? false
          : true
        : defaultWeekend;
      const isFuture = dateStr > todayStr;

      if (dbLog) {
        const workedMinutes = calculateWorkedMinutes(emp.uid, dbLog.checkIn?.time, dbLog.checkOut?.time, dbLog);
        const hours = Math.round((workedMinutes / 60) * 10) / 10;
        const dailyMinutes = Number(dbLog.standardMinutes) > 0 ? Number(dbLog.standardMinutes) : standardDailyMinutes(emp.uid);
        const coeff = attendanceDayCoefficient(workedMinutes, dailyMinutes);
        const displayStatus = attendanceDisplayStatus(
          dbLog.status,
          Boolean(dbLog.checkIn?.time),
          Boolean(dbLog.checkOut?.time),
          workedMinutes,
          dailyMinutes,
        );
        return {
          status: displayStatus,
          coeff,
          hours,
          workedMinutes,
          checkIn: dbLog.checkIn ? formatLogTime(dbLog.checkIn.time) : "",
          checkOut: dbLog.checkOut ? formatLogTime(dbLog.checkOut.time) : "",
          dateStr,
          isWeekend: false,
          isFuture: false,
        };
      }

      if (isWeekend) {
        return { status: "weekend", coeff: null, checkIn: "", checkOut: "", dateStr, isWeekend: true, isFuture };
      }

      if (isFuture) {
        return { status: "", coeff: null, checkIn: "", checkOut: "", dateStr, isWeekend: false, isFuture: true };
      }

      // Payroll only credits approved leave applications, not standalone calendar events.
      if (hasApprovedPayrollLeave(applications, emp.uid, dateStr)) {
        return {
          status: "Approved-Leave",
          coeff: 1,
          workedMinutes: standardDailyMinutes(emp.uid),
          checkIn: "",
          checkOut: "",
          dateStr,
          isWeekend: false,
          isFuture: false,
        };
      }

      return {
        status: "Absent",
        coeff: 0,
        workedMinutes: 0,
        checkIn: "",
        checkOut: "",
        dateStr,
        isWeekend: false,
        isFuture: false,
      };
    };

    // Tính tổng giờ và tổng công của một nhân viên trong tháng
    const calcMonthTotals = (emp: any) => {
      let totalWorkedMinutes = 0;
      let totalCoeff = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const cell = getDayCellData(emp, day);
        if (!cell.isWeekend && !cell.isFuture && cell.coeff !== null) {
          totalWorkedMinutes += cell.workedMinutes || 0;
          totalCoeff += Math.min(1, Math.max(0, cell.coeff || 0));
        }
      }
      const totals = attendanceTotalsFromMinutes(totalWorkedMinutes, standardDailyMinutes(emp.uid));
      return { totalHours: totals.totalHours, totalCoeff: Math.round(totalCoeff * 100) / 100 };
    };

    const openAttendanceEditor = (log: any) => {
      if (!canEditAttendance || !log?._id) return;
      setEditingAttendance(log);
      setEditCheckIn(log.checkIn?.time ? formatLogTime(log.checkIn.time) : "");
      setEditCheckOut(log.checkOut?.time ? formatLogTime(log.checkOut.time) : "");
      setEditAttendanceStatus(log.status || "Present");
      setEditAttendanceNote(log.note || "");
      setEditAttendanceReason("");
    };

    const saveAttendanceEditor = async () => {
      if (!editingAttendance?._id) return;
      setIsAttendanceSaving(true);
      const detail = (existing: any, time: string, nextDay = false) => time ? {
        ...(existing || { latitude: 0, longitude: 0, distance: 0, deviceInfo: "Manual payroll edit", ipAddress: "" }),
        time: (() => {
          const value = new Date(`${editingAttendance.date}T${time}:00+07:00`);
          if (nextDay) value.setUTCDate(value.getUTCDate() + 1);
          return value.toISOString();
        })(),
      } : null;
      try {
        const response = await fetch(`/api/v1/crud/timekeeping-logs/${editingAttendance._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
          body: JSON.stringify({
            checkIn: detail(editingAttendance.checkIn, editCheckIn),
            checkOut: detail(editingAttendance.checkOut, editCheckOut, Boolean(editCheckIn && editCheckOut && editCheckOut < editCheckIn)),
            status: editAttendanceStatus,
            note: editAttendanceNote,
            editReason: editAttendanceReason,
          }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.message || "Không thể cập nhật chấm công.");
        toast.success("Đã cập nhật lịch sử chấm công.");
        setEditingAttendance(null);
        await fetchTimekeepingLogs();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không thể cập nhật lịch sử chấm công."));
      } finally {
        setIsAttendanceSaving(false);
      }
    };

    const handleAttendanceExcelExport = (kind: AttendanceExportKind) => {
      if (sidebarEmployees.length === 0) {
        toast.warning("Không có dữ liệu nhân viên phù hợp để xuất.");
        return;
      }

      try {
        const exportEmployees = sidebarEmployees.map((employee) => {
          const detail = getUserDetail(employee.uid);
          return {
            uid: employee.uid,
            displayName: detail.displayName || "",
            login: detail.email || "",
          };
        });

        exportAttendanceExcel({
          kind,
          month: selectedMonth,
          year: selectedYear,
          employees: exportEmployees,
          getCell: (employee, day) => {
            const gridEmployee = sidebarEmployees.find(
              (item) => item.uid === employee.uid
            );
            if (!gridEmployee) {
              return {
                coeff: null,
                hours: null,
                hasRecord: false,
                isAbsent: false,
                isWeekend: false,
                isFuture: false,
              };
            }

            const cell = getDayCellData(gridEmployee, day);
            const hours =
              typeof cell.hours === "number" && cell.hours > 0
                ? cell.hours
                : typeof cell.coeff === "number" && cell.coeff > 0
                  ? cell.coeff * 8
                  : cell.status === "Absent"
                    ? 0
                    : null;

            return {
              coeff: cell.coeff,
              hours,
              hasRecord:
                !cell.isWeekend &&
                !cell.isFuture &&
                Boolean(cell.status),
              isAbsent: cell.status === "Absent",
              isWeekend: cell.isWeekend,
              isFuture: cell.isFuture,
            };
          },
        });

        toast.success(
          kind === "coeff"
            ? "Đã xuất bảng số công ra Excel."
            : "Đã xuất bảng số giờ ra Excel."
        );
      } catch (error) {
        console.error("Lỗi xuất Excel chấm công:", error);
        toast.error("Không thể xuất bảng chấm công ra Excel.");
      }
    };

    // Navigation tháng
    const goToPrevMonth = () => {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(y => y - 1);
      } else {
        setSelectedMonth(m => m - 1);
      }
      setLogsPage(1);
    };

    const goToNextMonth = () => {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(y => y + 1);
      } else {
        setSelectedMonth(m => m + 1);
      }
      setLogsPage(1);
    };

    // Phân trang nhân viên trên lưới
    const gridPageSize = 15;
    const totalGridPages = Math.ceil(sidebarEmployees.length / gridPageSize) || 1;
    const paginatedGridEmployees = sidebarEmployees.slice((logsPage - 1) * gridPageSize, logsPage * gridPageSize);

    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
      "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    return (
      <div ref={attendancePanelRef} className={`flex min-h-0 flex-1 flex-col animate-fade-in overflow-hidden border border-[#dce7f4] bg-white ${isAttendanceFullscreen ? "h-screen w-screen rounded-none border-0" : "rounded-2xl"}`}>
        <div className="flex items-center justify-between border-b border-[#e5eef8] bg-white px-5 py-3 shrink-0">
          <div className="flex rounded-xl bg-[#f2f6fb] p-1">
            <button
              type="button"
              onClick={() => setAttendanceSectionMode("overview")}
              className={`rounded-lg px-4 py-2 text-sm font-normal transition-colors cursor-pointer ${attendanceSectionMode === "overview" ? "bg-white text-[#008dcc] shadow-sm" : "text-slate-600 hover:text-[#008dcc]"}`}
            >
              Tổng quan
            </button>
            <button
              type="button"
              onClick={() => setAttendanceSectionMode("detail")}
              className={`rounded-lg px-4 py-2 text-sm font-normal transition-colors cursor-pointer ${attendanceSectionMode === "detail" ? "bg-white text-[#008dcc] shadow-sm" : "text-slate-600 hover:text-[#008dcc]"}`}
            >
              Chi tiết
            </button>
          </div>
        </div>
        {attendanceSectionMode === "overview" ? (
          <AttendanceDailyOverview
            date={attendanceOverviewDate}
            onDateChange={setAttendanceOverviewDate}
            result={overviewResult}
            loading={isLogsLoading || attendanceAttemptsLoading}
          />
        ) : (
        <>
        {/* ===== HEADER CONTROLS + BẢNG CHẤM CÔNG ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Controls */}
          <div className="flex items-center justify-between gap-3 border-b border-[#e5eef8] bg-white px-5 py-3 shrink-0 flex-wrap">
            {/* Tiêu đề + chọn tháng */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-base font-normal text-slate-800">Bảng chấm công</h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f7ff] text-[#007eb8] transition-colors hover:bg-[#d7f1ff] cursor-pointer"
                  title="Tháng trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  <div className="w-28 text-xs font-normal">
                    <HrFormSelect value={String(selectedMonth)} onChange={value => { setSelectedMonth(Number(value)); setLogsPage(1); }} label="Chọn tháng" options={monthNames.map((label, index) => ({ value: String(index + 1), label }))} />
                  </div>
                  <div className="w-28 text-xs font-normal">
                    <HrFormSelect value={String(selectedYear)} onChange={value => { setSelectedYear(Number(value)); setLogsPage(1); }} label="Chọn năm" options={Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => ({ value: String(year), label: `Năm ${year}` }))} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f7ff] text-[#007eb8] transition-colors hover:bg-[#d7f1ff] cursor-pointer"
                  title="Tháng sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Ô tìm kiếm nhân viên */}
              <input
                type="text"
                placeholder="Tìm nhân viên..."
                value={empSearchQuery}
                onChange={e => { setEmpSearchQuery(e.target.value); setLogsPage(1); }}
                className="w-44 rounded-xl border border-[#dce7f4] bg-white px-3 py-2 text-xs font-normal outline-none placeholder:text-slate-400 focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10"
              />
            </div>

            {attendanceSectionMode === "detail" && (!isMobile || mobileAttendanceViewMode === "table") && (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => scrollAttendanceTable(-1)} aria-label="Cuộn bảng sang trái" title="Cuộn bảng sang trái" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f7ff] text-[#007eb8] transition-colors hover:bg-[#d7f1ff]">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => scrollAttendanceTable(1)} aria-label="Cuộn bảng sang phải" title="Cuộn bảng sang phải" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f7ff] text-[#007eb8] transition-colors hover:bg-[#d7f1ff]">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void toggleAttendanceFullscreen()} aria-label={isAttendanceFullscreen ? "Thu nhỏ bảng chấm công" : "Mở toàn màn hình bảng chấm công"} title={isAttendanceFullscreen ? "Thu nhỏ bảng" : "Xem toàn màn hình"} className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#bceaff] bg-white text-[#007eb8] transition-colors hover:bg-[#e8f7ff]">
                  {isAttendanceFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            )}

            {isMobile && (
              <div className="flex overflow-hidden rounded-xl bg-[#f2f6fb] p-1 items-center">
                <button
                  type="button"
                  onClick={() => setMobileAttendanceViewMode("table")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-normal transition-colors cursor-pointer ${
                    mobileAttendanceViewMode === "table"
                      ? "bg-white text-[#008dcc] shadow-sm"
                      : "text-slate-600 hover:text-[#008dcc]"
                  }`}
                >
                  Bảng
                </button>
                <button
                  type="button"
                  onClick={() => setMobileAttendanceViewMode("list")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-normal transition-colors cursor-pointer ${
                    mobileAttendanceViewMode === "list"
                      ? "bg-white text-[#008dcc] shadow-sm"
                      : "text-slate-600 hover:text-[#008dcc]"
                  }`}
                >
                  Danh sách
                </button>
              </div>
            )}
          </div>

          {/* Bảng Grid Chấm Công */}
          <div ref={attendanceTableScrollRef} className="min-h-0 flex-1 overflow-auto visible-scrollbar">
            {isLogsLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Đang tải dữ liệu chấm công...</span>
              </div>
            ) : isMobile && mobileAttendanceViewMode === "list" ? (
              // Collapsible Employee Card List for Mobile
              <div className="flex flex-col gap-3 p-4">
                {paginatedGridEmployees.length === 0 ? (
                  <div className="px-6 py-16 text-center text-slate-400 font-medium">
                    Không tìm thấy nhân viên nào.
                  </div>
                ) : (
                  paginatedGridEmployees.map((emp, empIdx) => {
                    const u = getUserDetail(emp.uid);
                    const { totalHours, totalCoeff } = calcMonthTotals(emp);
                    const isExpanded = expandedEmployeeUid === emp.uid;

                    return (
                      <div
                        key={emp.uid}
                        className="bg-white border border-[#dce7f4] rounded-2xl p-4 flex flex-col gap-3 transition-colors"
                      >
                        {/* Employee Row Header */}
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedEmployeeUid(isExpanded ? null : emp.uid)}
                        >
                          <div className="flex items-center gap-2.5">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#e8f7ff] text-[#007eb8] flex items-center justify-center font-normal text-xs shrink-0">
                                {u.displayName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-normal text-xs text-slate-800">{u.displayName}</span>
                              <span className="text-[10px] text-slate-500 font-normal truncate max-w-[150px]">{u.email}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                              {totalCoeff} công
                            </span>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {/* Collapsible Daily Details List */}
                        {isExpanded && (
                          <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 animate-fade-in max-h-[300px] overflow-y-auto pr-1">
                            {dayColumns.map((day) => {
                              const cell = getDayCellData(emp, day);
                              const isWeekend = cell.isWeekend;
                              const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                              const dbLog = logs.find((log: any) => log.uid === emp.uid && log.date === dateStr);
                              const cellCoeff = cell.coeff ?? 0;

                              const dow = getDayOfWeek(day);
                              const dowLabel = dayLabels[dow];

                              if (isWeekend) {
                                return (
                                  <div key={day} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl text-[10px] text-slate-400 font-semibold border border-slate-100/50">
                                    <span>Ngày {day} ({dowLabel})</span>
                                    <span className="font-bold">Cuối tuần (—)</span>
                                  </div>
                                );
                              }

                              if (cell.isFuture) {
                                return (
                                  <div key={day} className="flex justify-between items-center px-3 py-2 rounded-xl text-[10px] text-slate-350 font-semibold border border-dashed border-slate-100">
                                    <span>Ngày {day} ({dowLabel})</span>
                                    <span>·</span>
                                  </div>
                                );
                              }

                              const badgeColor =
                                cell.status === "Present" || cell.status === "Half-Day" || cell.status?.startsWith("Approved")
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : cell.status === "Late" || cell.status === "Left-Early"
                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                    : "bg-rose-50 text-rose-700 border-rose-100";

                              return (
                                <div
                                  key={day}
                                  onClick={() => canEditAttendance && dbLog && openAttendanceEditor(dbLog)}
                                  className={`flex justify-between items-center px-3 py-2 rounded-xl border border-slate-100 hover:border-cyan-200 transition-all ${
                                    canEditAttendance && dbLog ? "cursor-pointer hover:bg-cyan-50/30" : "cursor-default"
                                  }`}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-700">
                                      <span>Ngày {day} ({dowLabel})</span>
                                      {cell.status && (
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md border uppercase tracking-wider font-bold ${badgeColor}`}>
                                          {getStatusShort(cell.status)}
                                        </span>
                                      )}
                                    </div>
                                    {(cell.checkIn || cell.checkOut) && (
                                      <span className="text-[9px] font-bold text-slate-500 font-mono pl-0.5">
                                        {cell.checkIn || "--:--"} - {cell.checkOut || "--:--"}
                                      </span>
                                    )}
                                    {dbLog?.manuallyAdjusted && (
                                      <span className="text-[7.5px] font-bold text-violet-600 pl-0.5">Đã điều chỉnh</span>
                                    )}
                                  </div>

                                  <div className="text-[10px] font-black text-slate-700">
                                    {cellCoeff} công
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <table className="table-fixed border-collapse text-xs" style={{ minWidth: `${448 + daysInMonth * 50}px`, zoom: isAttendanceFullscreen ? Math.min(1, (fullscreenWidth - 16) / (448 + daysInMonth * 50)) : 1 }}>
                {/* === THEAD === */}
                <thead className="sticky top-0 z-40">
                  <tr className="border-b border-[#dce7f4] bg-[#e8f7ff]">
                    {/* Cột STT */}
                    <th className="sticky left-0 z-50 bg-[#e8f7ff] border-b border-r border-[#dce7f4] px-2 py-2 text-center font-normal text-[10px] text-[#007eb8] whitespace-nowrap min-w-[36px] w-[36px]">
                      #
                    </th>
                    {/* Cột Họ và Tên */}
                    <th className="sticky left-[36px] z-50 bg-[#e8f7ff] border-b border-r border-[#dce7f4] px-3 py-2 text-left font-normal text-[10px] text-[#007eb8] whitespace-nowrap min-w-[176px] w-[176px]">
                      Họ và Tên
                    </th>
                    {/* Cột Email */}
                    <th className="sticky left-[212px] z-50 bg-[#e8f7ff] border-b border-r border-[#c9e5f5] px-3 py-2 text-left font-normal text-[10px] text-[#007eb8] whitespace-nowrap min-w-[180px] w-[180px]">
                      Mã đăng nhập
                    </th>
                    {/* Cột Số công */}
                    <th className="sticky left-[392px] z-50 bg-[#d8f2ff] border-b border-r border-[#bceaff] px-2 py-2 text-center font-normal text-[10px] text-[#007eb8] whitespace-nowrap min-w-[56px] w-[56px]">
                      Số<br/>công
                    </th>
                    {/* Các cột ngày */}
                    {dayColumns.map(day => {
                      const dow = getDayOfWeek(day);
                      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const holiday = holidayByDate.get(dateStr);
                      const isWeekend = holiday && holiday.isApplied
                        ? holiday.dayType !== "working_override"
                        : !companyWorkingDays.includes(dow);
                      const isToday = dateStr === todayStr;
                      return (
                        <th
                          key={day}
                          className={`border-b border-r border-[#dce7f4] px-1 py-1.5 text-center font-normal whitespace-nowrap min-w-[50px] w-[50px] ${
                            isToday
                              ? "bg-[#c8eeff] text-[#007eb8]"
                              : isWeekend
                                ? "bg-[#f3f7fb] text-slate-500"
                                : "bg-[#e8f7ff] text-[#007eb8]"
                          }`}
                        >
                          <div className="text-[9px] font-normal">{dayLabels[dow]}</div>
                          <div className={`text-sm font-normal leading-tight ${isToday ? "text-[#007eb8]" : isWeekend ? "text-slate-500" : "text-slate-800"}`}>
                            {day}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* === TBODY === */}
                <tbody>
                  {paginatedGridEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={5 + daysInMonth} className="px-6 py-16 text-center text-slate-400 font-medium">
                        Không tìm thấy nhân viên nào.
                      </td>
                    </tr>
                  ) : (
                    paginatedGridEmployees.map((emp, empIdx) => {
                      const u = getUserDetail(emp.uid);
                      const { totalHours, totalCoeff } = calcMonthTotals(emp);
                      const globalIdx = (logsPage - 1) * gridPageSize + empIdx + 1;
                      const rowBg = empIdx % 2 === 0 ? "bg-white" : "bg-[#f8fbff]";
                      return (
                        <tr key={emp.uid} className={`border-b border-[#e5eef8] hover:bg-[#f0faff] transition-colors ${rowBg}`}>
                          {/* STT */}
                          <td className={`sticky left-0 z-30 border-r border-[#e5eef8] px-2 py-2.5 text-center text-[10px] font-normal text-slate-500 whitespace-nowrap min-w-[36px] w-[36px] ${rowBg}`}>
                            {globalIdx}
                          </td>
                          {/* Họ và Tên */}
                          <td className={`sticky left-[36px] z-30 border-r border-[#e5eef8] px-3 py-2.5 whitespace-nowrap min-w-[176px] w-[176px] ${rowBg}`}>
                            <div className="flex items-center gap-2">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.displayName} className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-[#e8f7ff] text-[#007eb8] flex items-center justify-center font-normal text-[9px] shrink-0">
                                  {u.displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-normal text-[#007eb8] truncate max-w-[120px] text-xs" title={u.displayName}>{u.displayName}</span>
                            </div>
                          </td>
                          {/* Email */}
                          <td className={`sticky left-[212px] z-30 border-r border-[#c9e5f5] px-3 py-2.5 whitespace-nowrap min-w-[180px] w-[180px] ${rowBg}`}>
                            <span className="text-[10px] text-slate-500 font-normal truncate block max-w-[150px]" title={u.email}>{u.email}</span>
                          </td>
                          {/* Tổng công */}
                          <td className="sticky left-[392px] z-30 border-r border-[#bceaff] px-2 py-2.5 text-center bg-[#f0faff] whitespace-nowrap min-w-[56px] w-[56px]">
                            <span className="text-xs font-normal text-[#008dcc]">{totalCoeff}</span>
                          </td>
                          {dayColumns.map(day => {
                            const cell = getDayCellData(emp, day);
                            const isWeekend = cell.isWeekend;
                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const dbLog = logs.find((log: any) => log.uid === emp.uid && log.date === dateStr);
                            const isToday = dateStr === todayStr;

                            if (isWeekend) {
                              return (
                                <td key={day} className="border-r border-[#e5eef8] px-1 py-2.5 text-center bg-[#f3f7fb] whitespace-nowrap w-12">
                                  <span className="text-slate-400 text-[10px] font-normal">—</span>
                                </td>
                              );
                            }

                            if (cell.isFuture) {
                              return (
                                <td key={day} className={`border-r border-[#e5eef8] px-1 py-2.5 text-center whitespace-nowrap w-12 ${isToday ? "bg-[#f0faff]" : ""}`}>
                                  <span className="text-slate-200 text-[10px]">·</span>
                                </td>
                              );
                            }

                            const coeff = cell.coeff ?? 0;
                            const isFullDay = coeff >= 1;
                            const isAbsent = coeff === 0;

                            return (
                              <td
                                key={day}
                                onClick={() => canEditAttendance && dbLog && openAttendanceEditor(dbLog)}
                                className={`border-r border-[#e5eef8] px-0.5 py-1.5 text-center whitespace-nowrap w-12 group ${canEditAttendance && dbLog ? "cursor-pointer hover:bg-[#e8f7ff]" : "cursor-default"} ${isToday ? "bg-[#f0faff]" : ""}`}
                                title={`${u.displayName} – ${dateStr}\nTrạng thái: ${getStatusShort(cell.status)}\nCheck-in: ${cell.checkIn || "--:--"} | Check-out: ${cell.checkOut || "--:--"}\nHệ số công: ${coeff}`}
                              >
                                {isScheduleMode ? (
                                  cell.checkIn || cell.checkOut || (cell.status && cell.status !== "Absent") ? (
                                    <div className="flex flex-col items-start px-0.5 text-left max-w-full overflow-hidden">
                                      <div className="flex items-center gap-1 text-[8.5px] font-normal leading-none truncate max-w-full text-slate-800">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                          cell.status === "Present" || cell.status === "Half-Day" || cell.status?.startsWith("Approved")
                                            ? "bg-emerald-500"
                                            : cell.status === "Late" || cell.status === "Left-Early"
                                              ? "bg-amber-500"
                                              : "bg-rose-500"
                                        }`} />
                                        <span className="truncate" title={cell.status}>
                                          {cell.status === "Incomplete"
                                            ? "Thiếu chấm công"
                                            : cell.status === "Partial"
                                              ? "Thiếu công"
                                              : cell.status === "Present"
                                            ? `HCS(${cell.checkIn || "07:30"} - ${cell.checkOut || "17:30"})`
                                            : cell.status === "Half-Day"
                                              ? `CBH2(${cell.checkIn || "08:00"} - ${cell.checkOut || "12:00"})`
                                              : cell.status === "Approved-Leave"
                                                ? "Nghỉ phép"
                                                : cell.status === "Approved-WFH"
                                                  ? "Làm tại nhà"
                                                  : cell.status === "Late"
                                                    ? `CS(${cell.checkIn || "08:00"} - ${cell.checkOut || "17:00"})`
                                                    : getStatusShort(cell.status)}
                                        </span>
                                      </div>
                                      {(cell.checkIn || cell.checkOut) && (
                                        <div className="text-[8px] font-normal text-slate-500 pl-2.5 leading-tight mt-0.5 font-mono">
                                          {cell.checkIn || "--:--"} - {cell.checkOut || "--:--"}
                                        </div>
                                      )}
                                      {dbLog?.manuallyAdjusted && <div className="pl-2.5 text-[7px] font-normal text-[#008dcc]">Đã điều chỉnh</div>}
                                    </div>
                                  ) : null
                                ) : cellDisplayMode === "coeff" ? (
                                  <>
                                    {/* Hệ số công */}
                                    <div className={`text-sm font-normal leading-none ${isAbsent ? "text-rose-500" : isFullDay ? "text-emerald-700" : "text-amber-600"}`}>
                                      {coeff === 1 ? "1" : coeff === 0 ? "0" : coeff.toFixed(2)}
                                    </div>
                                    {/* Nhãn trạng thái */}
                                    {cell.status && (
                                      <div className={`text-[8px] font-normal mt-0.5 leading-none ${isAbsent ? "text-rose-500" : isFullDay ? "text-emerald-700" : "text-amber-600"}`}>
                                        {getStatusShort(cell.status)}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* Số giờ */}
                                    <div className={`text-xs font-normal leading-none ${isAbsent ? "text-rose-500" : "text-[#008dcc]"}`}>
                                      {cell.hours && cell.hours > 0 ? `${cell.hours}h` : isFullDay ? "8h" : "0h"}
                                    </div>
                                    {cell.status && (
                                      <div className={`text-[8px] font-normal mt-0.5 leading-none ${isAbsent ? "text-rose-500" : "text-slate-500"}`}>
                                        {getStatusShort(cell.status)}
                                      </div>
                                    )}
                                  </>
                                )}
                                {dbLog?.manuallyAdjusted && !isScheduleMode && <div className="mt-0.5 text-[7px] font-normal text-[#008dcc]">Đã sửa</div>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Pagination */}
          {!isLogsLoading && sidebarEmployees.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#e5eef8] px-5 py-3 bg-white shrink-0">
              <span className="text-xs text-slate-500">
                Hiển thị {Math.min((logsPage - 1) * gridPageSize + 1, sidebarEmployees.length)}–{Math.min(logsPage * gridPageSize, sidebarEmployees.length)} / {sidebarEmployees.length} nhân viên
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={logsPage <= 1}
                  onClick={() => setLogsPage(logsPage - 1)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#dce7f4] text-xs font-normal text-[#007eb8] bg-white hover:bg-[#f0faff] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Trước
                </button>
                <span className="text-xs font-normal text-slate-700 px-2">
                  Trang {logsPage} / {totalGridPages}
                </span>
                <button
                  disabled={logsPage >= totalGridPages}
                  onClick={() => setLogsPage(logsPage + 1)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#dce7f4] text-xs font-normal text-[#007eb8] bg-white hover:bg-[#f0faff] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
        {editingAttendance && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setEditingAttendance(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <div><h3 className="font-bold text-slate-800">Sửa lịch sử chấm công</h3><p className="text-xs text-slate-500">{getUserDetail(editingAttendance.uid).displayName} · {editingAttendance.date}</p></div>
                <button onClick={() => setEditingAttendance(null)} className="rounded-lg p-1.5 hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600">Check-in<input type="time" value={editCheckIn} onChange={(e) => setEditCheckIn(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
                <label className="text-xs font-semibold text-slate-600">Check-out<input type="time" value={editCheckOut} onChange={(e) => setEditCheckOut(e.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label>
              </div>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Trạng thái<select value={editAttendanceStatus} onChange={(e) => setEditAttendanceStatus(e.target.value)} className="mt-1 w-full rounded-lg border p-2"><option value="Present">Đúng giờ</option><option value="Late">Muộn</option><option value="Left-Early">Về sớm</option><option value="Late-Left-Early">Muộn + về sớm</option><option value="Half-Day">Nửa ngày</option><option value="Absent">Vắng</option></select></label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Ghi chú<textarea value={editAttendanceNote} onChange={(e) => setEditAttendanceNote(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border p-2" /></label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Lý do chỉnh sửa <span className="text-rose-500">*</span><textarea value={editAttendanceReason} onChange={(e) => setEditAttendanceReason(e.target.value)} rows={2} placeholder="Bắt buộc nhập lý do" className="mt-1 w-full rounded-lg border p-2" /></label>
              {editingAttendance.manuallyAdjusted && <div className="mt-3 rounded-lg bg-violet-50 p-2 text-xs text-violet-700">Lần sửa trước: {editingAttendance.adjustmentReason || "Không có lý do"}</div>}
              {editingAttendance.adjustmentHistory?.length > 0 && <div className="mt-3 max-h-28 overflow-auto rounded-lg border p-2"><div className="mb-1 text-[10px] font-bold uppercase text-slate-500">Nhật ký điều chỉnh</div>{editingAttendance.adjustmentHistory.map((entry: any) => <div key={entry._id} className="border-t py-1 text-[10px] text-slate-600"><b>{entry.actorId}</b> · {new Date(entry.createdAt).toLocaleString("vi-VN")}<div>{entry.reason}</div></div>)}</div>}
              <div className="mt-5 flex justify-end gap-2"><button onClick={() => setEditingAttendance(null)} className="rounded-lg border px-4 py-2 text-sm cursor-pointer">Hủy</button><button disabled={isAttendanceSaving || editAttendanceReason.trim().length < 3} onClick={() => void saveAttendanceEditor()} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">{isAttendanceSaving ? "Đang lưu..." : "Lưu thay đổi"}</button></div>
            </div>
          </div>
        )}
      </div>
    );
  };
  // Navigate Months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  // Generate Calendar Grid
  const calendarDays = [];
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Week starts on Monday
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // Prev month filler days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i);
    calendarDays.push({ date: d, isCurrentMonth: false });
  }

  // Current month days
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    const d = new Date(year, month, i);
    calendarDays.push({ date: d, isCurrentMonth: true });
  }

  // Next month filler days (fill up to dynamic grid of 35 or 42 cells)
  const totalDaysNeeded = firstDayIndex + daysInCurrentMonth;
  const gridCellsCount = totalDaysNeeded <= 35 ? 35 : 42;
  const remainingDays = gridCellsCount - calendarDays.length;
  for (let i = 1; i <= remainingDays; i++) {
    const d = new Date(year, month + 1, i);
    calendarDays.push({ date: d, isCurrentMonth: false });
  }

  // Compare dates ignoring times
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isToday = (d: Date) => {
    return isSameDay(d, new Date());
  };

  // Check if item spans over this day
  const itemMatchesDay = (item: CalendarItem, day: Date) => {
    const sDate = new Date(item.startDate);
    const eDate = new Date(item.endDate);

    // Normalize to compare dates
    const start = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate()).getTime();
    const end = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate()).getTime();
    const current = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();

    return current >= start && current <= end;
  };

  // Filtering Logic
  const getFilteredItems = () => {
    return items.filter((item) => {
      // Đơn chưa được duyệt không xuất hiện trên lịch trình — chỉ hiển thị ở sub-tab Đơn từ.
      if (item.status === "pending") return false;

      // Type Filter
      if (filterType !== "all" && item.type !== filterType) return false;

      // Employee Filter
      if (filterEmployee !== "all") {
        if (item.type === "leave" && item.employeeId !== filterEmployee) return false;
        if (item.type === "reminder" && item.assigneeId !== filterEmployee) return false;
        if (item.type === "event" && item.creatorId !== filterEmployee && item.assigneeId !== filterEmployee) return false;
      }

      // Search term
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query) || false;
        const nameMatch = item.employeeName?.toLowerCase().includes(query) || false;
        return titleMatch || descMatch || nameMatch;
      }

      return true;
    });
  };

  const filteredItems = getFilteredItems();

  // Statistics calculations (For the current active month and selected filters)
  const getStatistics = () => {
    let events = 0;
    let leaves = 0;
    let wfhs = 0;
    let exceptions = 0;
    let reminders = 0;

    filteredItems.forEach((item) => {
      const sDate = new Date(item.startDate);
      // Check if item resides in current active month/year
      if (sDate.getMonth() === month && sDate.getFullYear() === year) {
        if (item.type === "event") events++;
        if (item.type === "leave") leaves++;
        if (item.type === "wfh") wfhs++;
        if (item.type === "exception") exceptions++;
        if (item.type === "reminder") reminders++;
      }
    });

    return { events, leaves, wfhs, exceptions, reminders };
  };

  const stats = getStatistics();

  // Lịch chỉ hiển thị: bấm vào ngày chỉ mở popup chi tiết (chỉ đọc).
  const handleDayClick = (dayDate: Date) => {
    setSelectedDayDate(dayDate);
    setIsDetailModalOpen(true);
  };


  return (
    <div
      className={`flex min-h-0 flex-col h-full bg-white p-3 md:p-4 ${
        currentSubTab === "attendance" ? "overflow-hidden" : "overflow-y-auto"
      }`}
      id="calendar_tab_wrapper"
    >
      {/* Subtab Switcher */}
      <ModuleNavigation label="Mục Lịch và chấm công" activeValue={currentSubTab} className="mb-3">
        <ModuleNavigationButton active={currentSubTab === "schedule"} icon={<CalendarIcon />} onClick={() => setCurrentSubTab("schedule")}>Lịch trình</ModuleNavigationButton>
        <ModuleNavigationButton active={currentSubTab === "attendance"} icon={<Clock />} onClick={() => setCurrentSubTab("attendance")}>Lịch sử chấm công</ModuleNavigationButton>
        <ModuleNavigationButton active={currentSubTab === "requests"} icon={<CheckCircle />} onClick={() => setCurrentSubTab("requests")}>Đơn từ</ModuleNavigationButton>
      </ModuleNavigation>

      {currentSubTab === "requests" ? (
        <Suspense
          fallback={
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-500 font-normal">Đang tải đơn từ...</span>
            </div>
          }
        >
          <LeaveRequestsTab
            userProfile={userProfile}
            selectedCompanyCode={selectedCompanyCode}
            canApprove={canApproveLeave ?? canManageAttendance}
            usersList={usersList}
            employees={employees}
            onApproved={() => {
              fetchCalendarItems();
              fetchApplications();
            }}
          />
        </Suspense>
      ) : currentSubTab === "attendance" ? (
        renderAttendanceTab()
      ) : (
        <>
          {/* Calendar controls */}
          <div className="mb-2 shrink-0 rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-left font-normal">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CalendarIcon className="h-4 w-4 shrink-0 text-[#00ADFC]" />
                <h2 className="whitespace-nowrap text-base font-normal text-slate-800">Lịch làm việc</h2>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={handlePrevMonth} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F7FF] text-[#007EB8] transition-colors hover:bg-[#D7F1FF]" title="Tháng trước" aria-label="Tháng trước"><ChevronLeft className="h-4 w-4" /></button>
                  <DateInput24 value={formatLocalDate(currentDate)} onChange={(date) => { if (date) setCurrentDate(new Date(`${date}T00:00:00`)); }} ariaLabel="Chọn ngày xem lịch" required className="!min-h-9 !w-36 !rounded-lg !px-1.5" />
                  <button type="button" onClick={handleNextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8F7FF] text-[#007EB8] transition-colors hover:bg-[#D7F1FF]" title="Tháng sau" aria-label="Tháng sau"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="ml-auto flex max-w-full flex-wrap items-center gap-1.5">
                <div className="w-36 text-xs [&>button]:min-h-8 [&>button]:rounded-lg [&>button]:px-2 [&>button]:py-1"><HrFormSelect value={filterType} onChange={setFilterType} label="Danh mục lịch" options={[{ value: "all", label: "Tất cả danh mục" }, { value: "event", label: "Sự kiện" }, { value: "leave", label: "Nghỉ phép" }, { value: "wfh", label: "Làm tại nhà" }, { value: "exception", label: "Ngoại lệ" }, { value: "reminder", label: "Nhắc hẹn" }]} /></div>
                <div className="w-36 text-xs [&>button]:min-h-8 [&>button]:rounded-lg [&>button]:px-2 [&>button]:py-1"><HrFormSelect value={filterEmployee} onChange={setFilterEmployee} label="Nhân sự" options={[{ value: "all", label: "Tất cả nhân sự" }, ...employees.map(emp => ({ value: emp.id, label: emp.name }))]} /></div>
              </div>
              {isMobile && (
                <div className="flex gap-1 rounded-lg bg-[#F3FAFF] p-1 text-xs">
                  <button onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "rounded-md bg-[#00ADFC] px-2 py-1 text-white" : "px-2 py-1 text-slate-600"}>Lịch</button>
                  <button onClick={() => setViewMode("list")} className={viewMode === "list" ? "rounded-md bg-[#00ADFC] px-2 py-1 text-white" : "px-2 py-1 text-slate-600"}>Danh sách</button>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[#E8F0F8] pt-2 text-xs font-normal">
              {[
                { label: "Sự kiện", count: stats.events, dot: "bg-sky-500", value: "bg-sky-50 text-sky-700" },
                { label: "Nghỉ phép", count: stats.leaves, dot: "bg-rose-500", value: "bg-rose-50 text-rose-700" },
                { label: "Tại nhà", count: stats.wfhs, dot: "bg-teal-500", value: "bg-teal-50 text-teal-700" },
                { label: "Ngoại lệ", count: stats.exceptions, dot: "bg-violet-500", value: "bg-violet-50 text-violet-700" },
                { label: "Nhắc hẹn", count: stats.reminders, dot: "bg-amber-500", value: "bg-amber-50 text-amber-700" },
              ].map(stat => (
                <span key={stat.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} />
                  {stat.label}
                  <span className={`min-w-5 rounded-full px-1.5 text-center ${stat.count ? stat.value : "bg-slate-100 text-slate-400"}`}>{stat.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* 2. Premium Calendar Grid */}
          <div className="flex-1 min-h-[380px] rounded-2xl bg-white p-2 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-3.5">
                <div className="w-9 h-9 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500 font-normal ">Đang tải lịch trình...</span>
              </div>
            ) : isMobile && viewMode === "list" ? (
              // Agenda List View for Mobile
              <div className="flex flex-col gap-3.5">
                {(() => {
                  const activeMonthItems = filteredItems
                    .filter((item) => {
                      const sDate = new Date(item.startDate);
                      return sDate.getMonth() === month && sDate.getFullYear() === year;
                    })
                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

                  if (activeMonthItems.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-normal">
                        <CalendarIcon className="h-10 w-10 text-slate-300 mb-3" />
                        <span className="text-xs">Không có lịch trình nào trong tháng này.</span>
                      </div>
                    );
                  }

                  return activeMonthItems.map((item) => {
                    const badgeColor =
                      item.type === "leave"
                        ? "bg-rose-50 text-rose-700 border-rose-100"
                        : item.type === "wfh"
                          ? "bg-teal-50 text-teal-700 border-teal-100"
                          : item.type === "exception"
                            ? "bg-violet-50 text-violet-700 border-violet-100"
                            : item.type === "reminder"
                              ? "bg-amber-50 text-amber-700 border-amber-100"
                              : "bg-blue-50 text-blue-700 border-blue-100";

                    const typeLabel =
                      item.type === "leave"
                        ? "Nghỉ phép"
                        : item.type === "wfh"
                          ? "Làm tại nhà"
                          : item.type === "exception"
                            ? "Ngoại lệ"
                            : item.type === "reminder"
                              ? "Nhắc hẹn"
                              : "Sự kiện";

                    const leftBorderColor =
                      item.type === "leave"
                        ? "border-l-rose-500"
                        : item.type === "wfh"
                          ? "border-l-teal-500"
                          : item.type === "exception"
                            ? "border-l-violet-500"
                            : item.type === "reminder"
                              ? "border-l-amber-500"
                              : "border-l-blue-500";

                    const itemDate = new Date(item.startDate);
                    const formattedDate = `${itemDate.getDate()}/${itemDate.getMonth() + 1}/${itemDate.getFullYear()}`;

                    return (
                      <div
                        key={item._id || item.id}
                        onClick={() => {
                          setSelectedDayDate(itemDate);
                          setIsDetailModalOpen(true);
                        }}
                        className={`border border-slate-150 bg-white border-l-4 ${leftBorderColor} rounded-2xl p-4 flex flex-col gap-2 hover:border-slate-200 hover:shadow-md transition-all duration-300 cursor-pointer`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-[9px] px-2 py-0.5 font-normal rounded-lg border   ${badgeColor}`}>
                            {typeLabel}
                          </span>
                          <span className="text-[10px] text-slate-550 font-normal bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">
                            {formattedDate}
                          </span>
                        </div>

                        <h4 className="font-normal text-xs text-slate-800 ">{item.title}</h4>
                        {item.description && (
                          <p className="text-[10px] text-slate-550 font-normal leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-y-1 items-center gap-3.5 text-[10px] text-slate-500 font-normal pt-2 border-t border-slate-100/50">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {new Date(item.startDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            {` - `}
                            {new Date(item.endDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {["leave", "wfh", "exception"].includes(item.type) && item.employeeName && (
                            <span className="flex items-center gap-1.5">
                              <Users className="h-3 w-3 text-slate-400" />
                              {item.employeeName}
                            </span>
                          )}
                          {["leave", "wfh", "exception"].includes(item.type) && (
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-normal   ${
                              item.status === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                              {item.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl bg-[#E8EDF3] p-px">
                {/* Weekdays Labels */}
                <div className="grid shrink-0 grid-cols-7 gap-px bg-[#E8EDF3]">
                  {WEEKDAYS.map((day, idx) => (
                    <div
                      key={day}
                      className="bg-[#E8F7FF] py-1.5 text-center text-[11px] font-normal text-[#007EB8]"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid min-h-[320px] flex-1 grid-cols-7 gap-px bg-[#E8EDF3] select-none" style={{ gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, minmax(64px, 1fr))` }}>
                  {calendarDays.map(({ date: dayDate, isCurrentMonth }, index) => {
                    const dayItems = filteredItems.filter((item) => itemMatchesDay(item, dayDate));
                    const dayIsToday = isToday(dayDate);
                    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                    const holiday = holidayByDate.get(formatLocalDate(dayDate));

                    return (
                      <div
                        key={index}
                        onClick={() => handleDayClick(dayDate)}
                        title={holiday?.name}
                        className={`flex min-h-0 flex-col overflow-hidden p-1.5 transition-colors hover:bg-[#F3FAFF] cursor-pointer ${isCurrentMonth ? holiday ? "bg-rose-50/40" : isWeekend ? "bg-[#F8FAFD]" : "bg-white" : "bg-[#F7FAFD]"} ${dayIsToday ? "bg-[#E8F7FF] ring-1 ring-inset ring-[#85D7FF]" : ""}`}
                      >
                        {/* Day Number */}
                        <div className="mb-1 flex shrink-0 items-center justify-between">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-normal ${dayIsToday ? "bg-[#00ADFC] text-white" : "text-slate-600"}`}
                          >
                            {isCurrentMonth ? dayDate.getDate() : null}
                          </span>
                          {dayIsToday && <span className="text-[10px] font-normal text-[#007EB8]">Hôm nay</span>}
                          {!dayIsToday && isCurrentMonth && dayItems.length > 1 && <span className="text-[10px] text-slate-500">{dayItems.length} lịch</span>}
                        </div>

                        {isCurrentMonth && holiday && (
                          <div className="text-[9px] px-2 py-0.5 rounded-lg border font-normal truncate bg-rose-50/80 text-rose-700 border-rose-100/60">
                            🎌 {holiday.name}
                          </div>
                        )}

                        {/* Day events visual list */}
                        <div className="min-h-0 flex-1 flex flex-col gap-0.5 overflow-hidden">
                          {isCurrentMonth && dayItems.slice(0, 3).map((item, idx) => {
                            const styleClass =
                              item.type === "leave"
                                ? "bg-rose-50/80 text-rose-700 border-rose-100/60 hover:bg-rose-100/60"
                                : item.type === "wfh"
                                  ? "bg-teal-50/80 text-teal-700 border-teal-100/60 hover:bg-teal-100/60"
                                  : item.type === "exception"
                                    ? "bg-violet-50/80 text-violet-700 border-violet-100/60 hover:bg-violet-100/60"
                                    : item.type === "reminder"
                                      ? "bg-amber-50/80 text-amber-700 border-amber-100/60 hover:bg-amber-100/60"
                                      : "bg-blue-50/80 text-blue-700 border-blue-100/60 hover:bg-blue-100/60";

                            return (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation(); // Avoid triggering day click
                                  setSelectedDayDate(dayDate);
                                  setIsDetailModalOpen(true);
                                }}
                                className={`truncate rounded px-1 py-0.5 text-[10px] font-normal transition-colors ${styleClass}`}
                                title={`${item.title} (${item.type === "leave" ? "Nghỉ phép" : item.type === "wfh" ? "Làm tại nhà" : item.type === "exception" ? "Ngoại lệ" : item.type === "reminder" ? "Nhắc hẹn" : "Sự kiện"
                                  })`}
                              >
                                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
                                {(["event", "reminder"].includes(item.type)) && `${new Date(item.startDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · `}
                                {item.title}
                              </div>
                            );
                          })}
                          {isCurrentMonth && dayItems.length > 3 && (
                            <div className="text-[9px] text-slate-450 font-normal pl-1.5">
                              + {dayItems.length - 3} lịch...
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 3. Detail Popover Modal */}
      {isDetailModalOpen && selectedDayDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="calendar-day-dialog-title" className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white text-slate-800 shadow-[0_20px_60px_rgba(15,45,75,0.2)] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 border-b border-[#E8EEF5] bg-[#F8FBFF] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F7FF] text-[#00A4E8]">
                  <CalendarIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 id="calendar-day-dialog-title" className="text-[15px] font-medium text-slate-800">
                    Lịch trình ngày {selectedDayDate.getDate()}/{selectedDayDate.getMonth() + 1}/{selectedDayDate.getFullYear()}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {filteredItems.filter((it) => itemMatchesDay(it, selectedDayDate)).length} lịch trình trong ngày
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                aria-label="Đóng"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow-sm transition-colors hover:bg-rose-600"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex min-h-32 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
              {filteredItems.filter((item) => itemMatchesDay(item, selectedDayDate)).length === 0 && (
                <div className="flex min-h-32 flex-col items-center justify-center rounded-xl bg-[#F8FBFF] px-4 py-6 text-center">
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F7FF] text-[#00A4E8]">
                    <CalendarIcon className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-slate-700">Chưa có lịch trình</p>
                  <p className="mt-1 text-xs text-slate-500">Ngày này chưa có lịch trình nào.</p>
                </div>
              )}
              {filteredItems
                .filter((item) => itemMatchesDay(item, selectedDayDate))
                .map((item) => {
                  const badgeColor =
                    item.type === "leave"
                      ? "bg-rose-50 text-rose-700 border-rose-100"
                      : item.type === "wfh"
                        ? "bg-teal-50 text-teal-700 border-teal-100"
                        : item.type === "exception"
                          ? "bg-violet-50 text-violet-700 border-violet-100"
                          : item.type === "reminder"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-blue-50 text-blue-700 border-blue-100";

                  const typeLabel =
                    item.type === "leave" ? "Nghỉ phép" : item.type === "wfh" ? "Làm tại nhà" : item.type === "exception" ? "Ngoại lệ" : item.type === "reminder" ? "Nhắc hẹn" : "Sự kiện";

                  return (
                    <div
                      key={item._id || item.id}
                      className="flex flex-col gap-2 rounded-xl border border-[#E7EEF6] bg-white p-3.5 transition-colors hover:border-[#B8DFF3] hover:bg-[#FBFDFF]"
                    >
                      <div className="flex justify-between items-start">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-normal ${badgeColor}`}>
                          {typeLabel}
                        </span>
                      </div>

                      <h4 className="text-sm font-medium text-slate-800">{item.title}</h4>
                      {item.description && (
                        <p className="text-xs leading-relaxed text-slate-600">{item.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#EDF2F7] pt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {new Date(item.startDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          {` - `}
                          {new Date(item.endDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {["leave", "wfh", "exception"].includes(item.type) && item.employeeName && (
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {item.employeeName}
                          </span>
                        )}
                        {["leave", "wfh", "exception"].includes(item.type) && (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] ${item.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                            }`}>
                            {item.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
