import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Bell,
  Clock,
  Info,
  CalendarCheck,
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
import AttendanceUtilityMenu from "./AttendanceUtilityMenu";
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

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function CalendarTab({
  userProfile,
  selectedCompanyCode,
  isManager,
  canManage,
  canEditAttendance = false,
  employees,
  usersList = []
}: CalendarTabProps) {
  // Fall back to role-string checks only when the caller doesn't pass canManage,
  // so other embedders of this component keep working unchanged.
  const canManageAttendance = canManage ?? (isManager || userProfile?.role === "admin" || userProfile?.role === "superadmin");
  // Same fix as canManageAttendance: a custom role granted timekeeping:manage
  // must be able to see/approve everyone's leave requests, not just their own.
  const isLeaveAdmin = canManageAttendance;
  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "superadmin";
  // Sub-tab Navigation
  const [currentSubTab, setCurrentSubTab] = useState<"schedule" | "attendance">("schedule");

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
  const [logFilterStatus, setLogFilterStatus] = useState("all");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editAttendanceStatus, setEditAttendanceStatus] = useState("Present");
  const [editAttendanceNote, setEditAttendanceNote] = useState("");
  const [editAttendanceReason, setEditAttendanceReason] = useState("");
  const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);

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
    try {
      const monthRange = selectedAttendanceMonthRange();
      const startDate = logStartDate || monthRange.start;
      const endDate = logEndDate || monthRange.end;
      let url = `/api/v1/crud/timekeeping-logs?companyCode=${encodeURIComponent(selectedCompanyCode)}&limit=10000&sort=date`;

      if (!isManager) {
        url += `&uid=${userProfile?.uid}`;
      } else if (logFilterEmployee !== "all") {
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
    companyWorkCalendarService
      .list(year, true)
      .then(setAppliedHolidays)
      .catch(() => setAppliedHolidays([]));
  }, [selectedCompanyCode, year]);

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
  }, [currentSubTab, logFilterEmployee, logStartDate, logEndDate, selectedCompanyCode, selectedMonth, selectedYear]);

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
      <div className="flex min-h-0 flex-1 flex-col animate-fade-in rounded-3xl overflow-hidden border border-slate-200 shadow-lg bg-white">
        {/* ===== HEADER CONTROLS + BẢNG CHẤM CÔNG ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Controls */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-white gap-3 shrink-0 flex-wrap">
            {/* Tiêu đề + chọn tháng */}
            <div className="flex items-center gap-3">
              <h1 className="text-base font-black text-slate-800 tracking-tight">Bảng chấm công</h1>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
                  title="Tháng trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={e => { setSelectedMonth(Number(e.target.value)); setLogsPage(1); }}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-cyan-50 border border-cyan-200 rounded-lg cursor-pointer outline-none focus:ring-2 focus:ring-cyan-300"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{monthNames[i]}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={e => { setSelectedYear(Number(e.target.value)); setLogsPage(1); }}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-cyan-50 border border-cyan-200 rounded-lg cursor-pointer outline-none focus:ring-2 focus:ring-cyan-300"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                      <option key={y} value={y}>Năm {y}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
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
                className="w-44 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400 placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchTimekeepingLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border-0"
                title="Tải lại dữ liệu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLogsLoading ? "animate-spin" : ""}`} />
                Tải lại
              </button>
               <button
                type="button"
                onClick={() => setIsScheduleMode(!isScheduleMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer border-0 ${
                  isScheduleMode
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 bg-slate-100 hover:bg-slate-200"
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Chế độ lịch
              </button>
              <AttendanceUtilityMenu
                disabled={isLogsLoading}
                onExportCoefficients={() => handleAttendanceExcelExport("coeff")}
              />
            </div>
          </div>

          {/* Bảng Grid Chấm Công */}
          <div className="min-h-0 flex-1 overflow-auto visible-scrollbar">
            {isLogsLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Đang tải dữ liệu chấm công...</span>
              </div>
            ) : (
              <table className="text-xs border-collapse table-fixed" style={{ minWidth: `${448 + daysInMonth * 50}px` }}>
                {/* === THEAD === */}
                <thead className="sticky top-0 z-40">
                  <tr className="bg-slate-100 border-b border-slate-300">
                    {/* Cột STT */}
                    <th className="sticky left-0 z-50 bg-slate-100 border-b border-r border-slate-300 px-2 py-2 text-center font-black text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[36px] w-[36px]">
                      #
                    </th>
                    {/* Cột Họ và Tên */}
                    <th className="sticky left-[36px] z-50 bg-slate-100 border-b border-r border-slate-300 px-3 py-2 text-left font-black text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[176px] w-[176px]">
                      Họ và Tên
                    </th>
                    {/* Cột Email */}
                    <th className="sticky left-[212px] z-50 bg-slate-100 border-b border-r-2 border-slate-400 px-3 py-2 text-left font-black text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[180px] w-[180px]">
                      Mã đăng nhập
                    </th>
                    {/* Cột Số công */}
                    <th className="sticky left-[392px] z-50 bg-emerald-700 border-b border-r-2 border-slate-400 px-2 py-2 text-center font-black text-[10px] text-white uppercase tracking-wider whitespace-nowrap min-w-[56px] w-[56px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]">
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
                          className={`border-b border-r border-slate-300 px-1 py-1.5 text-center font-bold whitespace-nowrap min-w-[50px] w-[50px] ${
                            isToday
                              ? "bg-cyan-600 text-white"
                              : isWeekend
                                ? "bg-slate-200 text-slate-500"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <div className="text-[9px] font-bold">{dayLabels[dow]}</div>
                          <div className={`text-sm font-black leading-tight ${isToday ? "text-white" : isWeekend ? "text-slate-500" : "text-slate-800"}`}>
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
                      const rowBg = empIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                      return (
                        <tr key={emp.uid} className={`border-b border-slate-200 hover:bg-cyan-50/50 transition-colors ${rowBg}`}>
                          {/* STT */}
                          <td className={`sticky left-0 z-30 border-r border-slate-200 px-2 py-2.5 text-center text-[10px] font-bold text-slate-400 whitespace-nowrap min-w-[36px] w-[36px] ${rowBg}`}>
                            {globalIdx}
                          </td>
                          {/* Họ và Tên */}
                          <td className={`sticky left-[36px] z-30 border-r border-slate-200 px-3 py-2.5 whitespace-nowrap min-w-[176px] w-[176px] ${rowBg}`}>
                            <div className="flex items-center gap-2">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.displayName} className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center font-black text-[9px] shrink-0">
                                  {u.displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <span className="font-bold text-cyan-700 truncate max-w-[120px] text-xs" title={u.displayName}>{u.displayName}</span>
                            </div>
                          </td>
                          {/* Email */}
                          <td className={`sticky left-[212px] z-30 border-r-2 border-slate-400 px-3 py-2.5 whitespace-nowrap min-w-[180px] w-[180px] ${rowBg}`}>
                            <span className="text-[10px] text-slate-500 font-medium truncate block max-w-[150px]" title={u.email}>{u.email}</span>
                          </td>
                          {/* Tổng công */}
                          <td className="sticky left-[392px] z-30 border-r-2 border-slate-400 px-2 py-2.5 text-center bg-emerald-50 whitespace-nowrap min-w-[56px] w-[56px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]">
                            <span className="text-xs font-black text-emerald-700">{totalCoeff}</span>
                          </td>
                          {dayColumns.map(day => {
                            const cell = getDayCellData(emp, day);
                            const isWeekend = cell.isWeekend;
                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const dbLog = logs.find((log: any) => log.uid === emp.uid && log.date === dateStr);
                            const isToday = dateStr === todayStr;

                            if (isWeekend) {
                              return (
                                <td key={day} className="border-r border-slate-200 px-1 py-2.5 text-center bg-slate-100 whitespace-nowrap w-12">
                                  <span className="text-slate-300 text-[10px] font-bold">—</span>
                                </td>
                              );
                            }

                            if (cell.isFuture) {
                              return (
                                <td key={day} className={`border-r border-slate-200 px-1 py-2.5 text-center whitespace-nowrap w-12 ${isToday ? "bg-cyan-50" : ""}`}>
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
                                className={`border-r border-slate-200 px-0.5 py-1.5 text-center whitespace-nowrap w-12 group ${canEditAttendance && dbLog ? "cursor-pointer hover:bg-cyan-100" : "cursor-default"} ${isToday ? "bg-cyan-50" : ""}`}
                                title={`${u.displayName} – ${dateStr}\nTrạng thái: ${getStatusShort(cell.status)}\nCheck-in: ${cell.checkIn || "--:--"} | Check-out: ${cell.checkOut || "--:--"}\nHệ số công: ${coeff}`}
                              >
                                {isScheduleMode ? (
                                  cell.checkIn || cell.checkOut || (cell.status && cell.status !== "Absent") ? (
                                    <div className="flex flex-col items-start px-0.5 text-left max-w-full overflow-hidden">
                                      <div className="flex items-center gap-1 text-[8.5px] font-extrabold leading-none truncate max-w-full text-slate-800">
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
                                        <div className="text-[8px] font-semibold text-slate-500 pl-2.5 leading-tight mt-0.5 font-mono">
                                          {cell.checkIn || "--:--"} - {cell.checkOut || "--:--"}
                                        </div>
                                      )}
                                      {dbLog?.manuallyAdjusted && <div className="pl-2.5 text-[7px] font-bold text-violet-600">Đã điều chỉnh</div>}
                                    </div>
                                  ) : null
                                ) : cellDisplayMode === "coeff" ? (
                                  <>
                                    {/* Hệ số công */}
                                    <div className={`text-sm font-black leading-none ${isAbsent ? "text-rose-500" : isFullDay ? "text-slate-800" : "text-rose-500"}`}>
                                      {coeff === 1 ? "1" : coeff === 0 ? "0" : coeff.toFixed(2)}
                                    </div>
                                    {/* Nhãn trạng thái */}
                                    {cell.status && (
                                      <div className={`text-[8px] font-bold mt-0.5 leading-none ${isAbsent ? "text-rose-400" : isFullDay ? "text-slate-400" : "text-amber-500"}`}>
                                        {getStatusShort(cell.status)}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* Số giờ */}
                                    <div className={`text-xs font-black leading-none ${isAbsent ? "text-rose-500" : "text-cyan-700"}`}>
                                      {cell.hours && cell.hours > 0 ? `${cell.hours}h` : isFullDay ? "8h" : "0h"}
                                    </div>
                                    {cell.status && (
                                      <div className={`text-[8px] font-bold mt-0.5 leading-none ${isAbsent ? "text-rose-400" : "text-slate-400"}`}>
                                        {getStatusShort(cell.status)}
                                      </div>
                                    )}
                                  </>
                                )}
                                {dbLog?.manuallyAdjusted && !isScheduleMode && <div className="mt-0.5 text-[7px] font-bold text-violet-600">Đã sửa</div>}
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
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 bg-white shrink-0">
              <span className="text-xs text-slate-500">
                Hiển thị {Math.min((logsPage - 1) * gridPageSize + 1, sidebarEmployees.length)}–{Math.min(logsPage * gridPageSize, sidebarEmployees.length)} / {sidebarEmployees.length} nhân viên
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={logsPage <= 1}
                  onClick={() => setLogsPage(logsPage - 1)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
                >
                  Trước
                </button>
                <span className="text-xs font-bold text-slate-800 px-2">
                  Trang {logsPage} / {totalGridPages}
                </span>
                <button
                  disabled={logsPage >= totalGridPages}
                  onClick={() => setLogsPage(logsPage + 1)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
        {editingAttendance && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setEditingAttendance(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
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
  const firstDayIndex = firstDayOfMonth.getDay(); // 0 = Sun
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
      className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-5 overflow-y-auto duration-500"
      id="calendar_tab_wrapper"
    >
      {/* Subtab Switcher */}
      <div className="flex border-b border-slate-200/60 pb-3 mb-5 justify-between items-center">
        <div className="flex gap-2 bg-slate-100/85 p-1 rounded-xl w-fit">
          <button
            onClick={() => setCurrentSubTab("schedule")}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentSubTab === "schedule"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/40"
                : "text-gray-500 hover:text-gray-800"
              }`}
          >
            Lịch trình
          </button>
          <button
            onClick={() => setCurrentSubTab("attendance")}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentSubTab === "attendance"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/40"
                : "text-gray-500 hover:text-gray-800"
              }`}
          >
            Lịch sử chấm công
          </button>
        </div>
      </div>

      {currentSubTab === "attendance" ? (
        renderAttendanceTab()
      ) : (
        <>
          {/* 1. Glassmorphism Header Controls & Filters & Quick Stats */}
          <div className="flex flex-col gap-5 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-100/80 shadow-md shadow-slate-100/50 mb-5 transition-all duration-300">
            {/* Navigation & Actions */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600 shadow-xs border border-indigo-100/40">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 tracking-wide uppercase">
                    Lịch trình
                  </h2>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                    Tháng {month + 1} / {year}
                  </p>
                </div>
                <div className="flex border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs ml-3 bg-white items-center">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-slate-650 cursor-pointer"
                    title="Tháng trước"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="date"
                    value={formatLocalDate(currentDate)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCurrentDate(new Date(e.target.value + "T00:00:00"));
                      }
                    }}
                    className="px-3 py-1.5 font-bold text-xs text-slate-700 border-x border-slate-200/80 bg-transparent outline-none cursor-pointer hover:bg-slate-50 transition-colors"
                    title="Chọn ngày"
                  />
                  <button
                    onClick={handleNextMonth}
                    className="p-2.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-slate-650 cursor-pointer"
                    title="Tháng sau"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>


            </div>

            {/* Filters and Stats Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pt-4 border-t border-slate-100">
              {/* Filters (6 cols) */}
              <div className="lg:col-span-6 flex flex-wrap gap-2.5">
                <div className="flex items-center gap-1.5 bg-slate-100/50 px-3 py-1.5 rounded-2xl border border-slate-200/50">
                  <Filter className="h-3.5 w-3.5 text-slate-550" />
                  <span className="text-xs text-slate-600 font-extrabold">Bộ lọc:</span>
                </div>

                {/* Type selector */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200/80 bg-slate-50 hover:bg-slate-100/50 rounded-2xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer transition-all"
                >
                  <option value="all">Tất cả danh mục</option>
                  <option value="event">📅 Sự kiện</option>
                  <option value="leave">🌴 Nghỉ phép</option>
                  <option value="wfh">🏠 Làm tại nhà</option>
                  <option value="exception">⚡ Ngoại lệ</option>
                  <option value="reminder">🔔 Nhắc hẹn</option>
                </select>

                {/* Employee selector */}
                <select
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200/80 bg-slate-50 hover:bg-slate-100/50 rounded-2xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer transition-all max-w-[180px]"
                >
                  <option value="all">Tất cả nhân sự</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Premium stats widgets (6 cols) */}
              <div className="lg:col-span-6 flex justify-end gap-3 flex-wrap">
                <div className="bg-white border-l-4 border-l-blue-500 border-y border-r border-slate-100/80 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between min-w-[130px] shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/5 transition-all duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Sự kiện</span>
                    <span className="text-sm font-extrabold text-slate-800">{stats.events}</span>
                  </div>
                  <div className="bg-blue-50 p-1.5 rounded-full text-blue-600">
                    <CalendarCheck className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white border-l-4 border-l-rose-500 border-y border-r border-slate-100/80 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between min-w-[130px] shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:shadow-rose-500/5 transition-all duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Nghỉ phép</span>
                    <span className="text-sm font-extrabold text-slate-800">{stats.leaves}</span>
                  </div>
                  <div className="bg-rose-50 p-1.5 rounded-full text-rose-600">
                    <Users className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white border-l-4 border-l-teal-500 border-y border-r border-slate-100/80 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between min-w-[130px] shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:shadow-teal-500/5 transition-all duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tại nhà</span>
                    <span className="text-sm font-extrabold text-slate-800">{stats.wfhs}</span>
                  </div>
                  <div className="bg-teal-50 p-1.5 rounded-full text-teal-600">
                    <Info className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white border-l-4 border-l-violet-500 border-y border-r border-slate-100/80 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between min-w-[130px] shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/5 transition-all duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ngoại lệ</span>
                    <span className="text-sm font-extrabold text-slate-800">{stats.exceptions}</span>
                  </div>
                  <div className="bg-violet-50 p-1.5 rounded-full text-violet-600">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                </div>

                <div className="bg-white border-l-4 border-l-amber-500 border-y border-r border-slate-100/80 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between min-w-[130px] shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Nhắc hẹn</span>
                    <span className="text-sm font-extrabold text-slate-800">{stats.reminders}</span>
                  </div>
                  <div className="bg-amber-50 p-1.5 rounded-full text-amber-600">
                    <Bell className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Premium Calendar Grid */}
          <div className="flex-1 bg-white/90 backdrop-blur-md border border-slate-100/80 rounded-3xl shadow-md shadow-slate-100/40 p-5 overflow-x-auto min-h-[550px] transition-all duration-300">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-3.5">
                <div className="w-9 h-9 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500 font-bold tracking-wider">Đang tải lịch trình...</span>
              </div>
            ) : (
              <div className="min-w-[750px] h-full flex flex-col">
                {/* Weekdays Labels */}
                <div className="grid grid-cols-7 gap-1.5 mb-3">
                  {WEEKDAYS.map((day, idx) => (
                    <div
                      key={day}
                      className={`text-center py-2.5 text-xs font-extrabold tracking-wider uppercase ${idx === 0
                          ? "text-rose-500"
                          : idx === 6
                            ? "text-blue-500"
                            : "text-slate-550"
                        }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2 flex-1 select-none">
                  {calendarDays.map(({ date: dayDate, isCurrentMonth }, index) => {
                    const dayItems = filteredItems.filter((item) => itemMatchesDay(item, dayDate));
                    const dayIsToday = isToday(dayDate);
                    const holiday = holidayByDate.get(formatLocalDate(dayDate));

                    return (
                      <div
                        key={index}
                        onClick={() => handleDayClick(dayDate)}
                        title={holiday?.name}
                        className={`min-h-[100px] p-2.5 border rounded-2xl flex flex-col justify-between transition-all hover:bg-indigo-50/20 hover:border-indigo-100 hover:shadow-md hover:-translate-y-0.5 duration-300 cursor-pointer ${holiday
                            ? "bg-rose-50/40 border-rose-100/70"
                            : isCurrentMonth
                              ? "bg-white border-slate-100/80 shadow-3xs"
                              : "bg-slate-50/30 border-slate-50/50 text-slate-350"
                          } ${dayIsToday
                            ? "ring-2 ring-indigo-500 ring-offset-2 bg-gradient-to-br from-indigo-50/20 to-violet-50/20 border-indigo-200/50 shadow-sm shadow-indigo-500/5"
                            : ""
                          }`}
                      >
                        {/* Day Number */}
                        <div className="flex justify-between items-center mb-1.5">
                          <span
                            className={`text-xs font-extrabold rounded-xl w-6 h-6 flex items-center justify-center transition-all ${dayIsToday
                                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30 font-black"
                                : isCurrentMonth
                                  ? "text-slate-700 hover:bg-slate-100"
                                  : "text-slate-400"
                              }`}
                          >
                            {dayDate.getDate()}
                          </span>
                          {dayItems.length > 0 && (
                            <span className="text-[9px] bg-slate-100/80 text-slate-650 px-1.5 py-0.5 rounded-lg font-extrabold border border-slate-200/50 shadow-3xs">
                              {dayItems.length}
                            </span>
                          )}
                        </div>

                        {holiday && (
                          <div className="text-[9px] px-2 py-0.5 rounded-lg border font-bold truncate bg-rose-50/80 text-rose-700 border-rose-100/60">
                            🎌 {holiday.name}
                          </div>
                        )}

                        {/* Day events visual list */}
                        <div className="flex-1 flex flex-col gap-1.5 overflow-hidden max-h-[75px]">
                          {dayItems.slice(0, 3).map((item, idx) => {
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
                                className={`text-[9px] px-2 py-0.5 rounded-lg border font-bold truncate transition-all duration-200 hover:scale-[1.01] active:scale-100 ${styleClass}`}
                                title={`${item.title} (${item.type === "leave" ? "Nghỉ phép" : item.type === "wfh" ? "Làm tại nhà" : item.type === "exception" ? "Ngoại lệ" : item.type === "reminder" ? "Nhắc hẹn" : "Sự kiện"
                                  })`}
                              >
                                {item.type === "leave" ? `🌴 ` : item.type === "wfh" ? `🏠 ` : item.type === "exception" ? `⚡ ` : item.type === "reminder" ? `🔔 ` : `📅 `}
                                {item.title}
                              </div>
                            );
                          })}
                          {dayItems.length > 3 && (
                            <div className="text-[9px] text-slate-450 font-extrabold pl-1.5">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Lịch trình ngày {selectedDayDate.getDate()}/{selectedDayDate.getMonth() + 1}/{selectedDayDate.getFullYear()}
                </h3>
                <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wide mt-0.5">
                  Có {filteredItems.filter((it) => itemMatchesDay(it, selectedDayDate)).length} lịch trình trong ngày
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[350px] overflow-y-auto flex flex-col gap-3">
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
                      className="border border-slate-100/80 bg-slate-50/40 rounded-2xl p-4 flex flex-col gap-2 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all duration-300 relative group"
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[9px] px-2 py-0.5 font-extrabold rounded-lg border uppercase tracking-wider ${badgeColor}`}>
                          {typeLabel}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-xs text-slate-800 tracking-wide">{item.title}</h4>
                      {item.description && (
                        <p className="text-[10px] text-slate-650 font-medium leading-relaxed">{item.description}</p>
                      )}

                      <div className="flex flex-wrap gap-y-1 items-center gap-3.5 text-[10px] text-slate-500 font-semibold pt-2 border-t border-slate-100">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {new Date(item.startDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          {` - `}
                          {new Date(item.endDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {["leave", "wfh", "exception"].includes(item.type) && item.employeeName && (
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3 w-3 text-rose-450" />
                            {item.employeeName}
                          </span>
                        )}
                        {["leave", "wfh", "exception"].includes(item.type) && (
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${item.status === "approved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
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
