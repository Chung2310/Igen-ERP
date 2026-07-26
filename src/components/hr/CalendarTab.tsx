import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  Filter,
  Users,
  Bell,
  Clock,
  Info,
  CalendarCheck,
  CheckCircle,
  X,
  FileText,
  Upload,
  Download,
  Check,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  ChevronDown
} from "lucide-react";
import { UserProfile, EmployeeNode } from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { companyWorkCalendarService, WorkCalendarDay } from "../../services/companyWorkCalendarService";
import AttendanceUtilityMenu from "./AttendanceUtilityMenu";
import {
  exportAttendanceExcel,
  type AttendanceExportKind,
} from "../../utils/attendanceExcel";
import {
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
  employees,
  usersList = []
}: CalendarTabProps) {
  // Fall back to role-string checks only when the caller doesn't pass canManage,
  // so other embedders of this component keep working unchanged.
  const canManageAttendance = canManage ?? (isManager || userProfile?.role === "admin" || userProfile?.role === "superadmin");
  // Same fix as canManageAttendance: a custom role granted timekeeping:manage
  // must be able to see/approve everyone's leave requests, not just their own.
  const isLeaveAdmin = canManageAttendance;
  // Sub-tab Navigation
  const [currentSubTab, setCurrentSubTab] = useState<"schedule" | "attendance" | "leave-requests">("schedule");

  // Leave Requests & Templates States
  const [templates, setTemplates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(false);
  const [isAppLoading, setIsAppLoading] = useState<boolean>(false);
  const [isAppFormOpen, setIsAppFormOpen] = useState<boolean>(false);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState<boolean>(false);
  const [isTemplateListModalOpen, setIsTemplateListModalOpen] = useState<boolean>(false);
  const [tplCurrentPage, setTplCurrentPage] = useState<number>(1);
  const [filterSearchQuery, setFilterSearchQuery] = useState<string>("");
  const [filterAppType, setFilterAppType] = useState<string>("");
  const [appRejectModalOpen, setAppRejectModalOpen] = useState<boolean>(false);
  const [appApproveModalOpen, setAppApproveModalOpen] = useState<boolean>(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState<string>("");
  const [approveNoteText, setApproveNoteText] = useState<string>("");
  const [appType, setAppType] = useState<string>("leave");
  const [appStartDate, setAppStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [appStartTime, setAppStartTime] = useState<string>("08:00");
  const [appEndDate, setAppEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [appEndTime, setAppEndTime] = useState<string>("17:00");
  const [appReason, setAppReason] = useState<string>("");
  const [appFile, setAppFile] = useState<File | null>(null);
  const [appEmployeeId, setAppEmployeeId] = useState<string>(userProfile?.uid || "");
  const [tplName, setTplName] = useState<string>("");
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [isFileUploading, setIsFileUploading] = useState<boolean>(false);



  // Premium confirm dialog state (replaces native window.confirm)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const askConfirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy"
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm: async () => {
        await onConfirm();
        setConfirmState(null);
      },
    });
  };

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
  const [logFilterEmployee, setLogFilterEmployee] = useState("all");
  const [logFilterStatus, setLogFilterStatus] = useState("all");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [isLogsLoading, setIsLogsLoading] = useState(false);

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
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");

  // Form Fields
  const [formType, setFormType] = useState<"event" | "leave" | "wfh" | "exception" | "reminder">("event");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formStartDate, setFormStartDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("08:00");
  const [formEndDate, setFormEndDate] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("17:00");
  const [formEmployeeId, setFormEmployeeId] = useState<string>("");
  const [formAssigneeId, setFormAssigneeId] = useState<string>("");
  const [formStatus, setFormStatus] = useState<string>("active");

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
      let url = `/api/v1/crud/timekeeping-logs?companyCode=${encodeURIComponent(selectedCompanyCode)}&limit=1000`;

      if (!isManager) {
        url += `&uid=${userProfile?.uid}`;
      } else if (logFilterEmployee !== "all") {
        url += `&uid=${logFilterEmployee}`;
      }

      if (logStartDate) {
        url += `&date[$gte]=${logStartDate}`;
      }
      if (logEndDate) {
        url += `&date[$lte]=${logEndDate}`;
      }

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

  const getFileDownloadUrl = (url: string, filename: string) => {
    if (!url) return "#";
    return `/api/v1/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || "don-xin-phep")}`;
  };

  const uploadFileToCloudinary = async (file: File): Promise<string> => {
    const reader = new FileReader();
    const fileBase64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

    const fileBase64 = await fileBase64Promise;

    const res = await fetch("/api/v1/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        file: fileBase64,
        folder: "hr_leaves",
      }),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      let details = "";
      if (errorJson.errors) {
        details = Object.entries(errorJson.errors)
          .map(([key, msgs]: any) => `${key}: ${msgs.join(", ")}`)
          .join("; ");
      }
      throw new Error((errorJson.message || "Lỗi tải tệp lên máy chủ.") + (details ? ` [${details}]` : ""));
    }

    const json = await res.json();
    return json.url;
  };

  const fetchTemplates = async () => {
    if (!selectedCompanyCode) return;
    setIsTemplateLoading(true);
    try {
      const res = await fetch(`/api/v1/crud/hr-leave-templates?companyCode=${encodeURIComponent(selectedCompanyCode)}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTemplateLoading(false);
    }
  };

  const fetchApplications = async () => {
    if (!selectedCompanyCode) return;
    setIsAppLoading(true);
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
    } finally {
      setIsAppLoading(false);
    }
  };

  const handleUploadTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) {
      toast.error("Vui lòng nhập tên biểu mẫu.");
      return;
    }
    if (!tplFile) {
      toast.error("Vui lòng chọn tệp biểu mẫu.");
      return;
    }

    setIsFileUploading(true);
    try {
      const fileUrl = await uploadFileToCloudinary(tplFile);
      const res = await fetch("/api/v1/crud/hr-leave-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: tplName,
          fileUrl,
          fileName: tplFile.name,
          uploadedBy: userProfile?.uid || "unknown"
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let details = "";
        if (errorData.errors) {
          details = Object.entries(errorData.errors)
            .map(([key, msgs]: any) => `${key}: ${msgs.join(", ")}`)
            .join("; ");
        }
        throw new Error((errorData.message || "Lỗi lưu biểu mẫu.") + (details ? ` [${details}]` : ""));
      }

      toast.success("Tải lên biểu mẫu mẫu thành công!");
      setIsTemplateFormOpen(false);
      setTplName("");
      setTplFile(null);
      fetchTemplates();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Tải lên biểu mẫu mẫu thất bại.");
    } finally {
      setIsFileUploading(false);
    }
  };

  const openAppForm = () => {
    if (templates.length > 0) {
      setAppType(templates[0].name);
    } else {
      setAppType("other");
    }
    setIsAppFormOpen(true);
  };

  const handleCreateApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appReason.trim()) {
      toast.error("Vui lòng nhập lý do.");
      return;
    }

    const startDateTime = new Date(`${appStartDate}T${appStartTime}:00`);
    const endDateTime = new Date(`${appEndDate}T${appEndTime}:00`);

    if (endDateTime < startDateTime) {
      toast.error("Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu.");
      return;
    }

    setIsFileUploading(true);
    try {
      let fileUrl = "";
      if (appFile) {
        fileUrl = await uploadFileToCloudinary(appFile);
      }
      const targetEmp = usersList.find(u => u.uid === appEmployeeId);
      const res = await fetch("/api/v1/crud/hr-leave-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          employeeId: appEmployeeId,
          employeeName: targetEmp?.displayName || userProfile?.displayName || "Nhân viên",
          type: appType,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          reason: appReason,
          uploadedFileUrl: fileUrl,
          uploadedFileName: appFile ? appFile.name : "",
          status: "pending"
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let details = "";
        if (errorData.errors) {
          details = Object.entries(errorData.errors)
            .map(([key, msgs]: any) => `${key}: ${msgs.join(", ")}`)
            .join("; ");
        }
        throw new Error((errorData.message || "Lỗi lưu đơn xin nghỉ.") + (details ? ` [${details}]` : ""));
      }

      toast.success("Gửi đơn xin nghỉ phép thành công!");
      setIsAppFormOpen(false);
      setAppReason("");
      setAppFile(null);
      setAppEmployeeId(userProfile?.uid || "");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gửi đơn thất bại.");
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleApproveApp = (app: any) => {
    setSelectedAppId(app._id || app.id);
    setApproveNoteText("");
    setAppApproveModalOpen(true);
  };

  const handleApproveAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/crud/hr-leave-applications/${selectedAppId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          status: "approved",
          note: approveNoteText,
          approvedBy: userProfile?.uid
        }),
      });

      if (!res.ok) throw new Error("Lỗi phê duyệt đơn.");

      toast.success("Đã duyệt đơn thành công!");
      setAppApproveModalOpen(false);
      setSelectedAppId(null);
      setApproveNoteText("");
      fetchApplications();
      fetchCalendarItems();
    } catch (err: any) {
      console.error(err);
      toast.error("Phê duyệt đơn thất bại.");
    }
  };

  const handleRejectAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReasonText.trim()) {
      toast.error("Vui lòng nhập lý do từ chối.");
      return;
    }

    try {
      const res = await fetch(`/api/v1/crud/hr-leave-applications/${selectedAppId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          status: "rejected",
          rejectReason: rejectReasonText,
          approvedBy: userProfile?.uid
        }),
      });

      if (!res.ok) throw new Error("Lỗi từ chối đơn.");

      toast.success("Đã từ chối đơn.");
      setAppRejectModalOpen(false);
      setSelectedAppId(null);
      setRejectReasonText("");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast.error("Từ chối đơn thất bại.");
    }
  };

  const handleDeleteApp = async (appId: string) => {
    askConfirm(
      "Xóa đơn xin nghỉ",
      "Bạn có chắc chắn muốn xóa đơn xin nghỉ này không? Hành động này không thể hoàn tác.",
      async () => {
        try {
          const res = await fetch(`/api/v1/crud/hr-leave-applications/${appId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          });

          if (!res.ok) throw new Error("Lỗi khi xóa đơn.");

          toast.success("Đã xóa đơn thành công.");
          fetchApplications();
        } catch (err: any) {
          console.error(err);
          toast.error("Xóa đơn thất bại.");
        }
      },
      "Xóa"
    );
  };

  const handleDeleteTpl = async (tplId: string) => {
    askConfirm(
      "Xóa biểu mẫu",
      "Bạn có chắc chắn muốn xóa biểu mẫu mẫu này không? Hành động này không thể hoàn tác.",
      async () => {
        try {
          const res = await fetch(`/api/v1/crud/hr-leave-templates/${tplId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          });

          if (!res.ok) throw new Error("Lỗi khi xóa biểu mẫu.");

          toast.success("Đã xóa biểu mẫu thành công.");
          fetchTemplates();
        } catch (err: any) {
          console.error(err);
          toast.error("Xóa biểu mẫu thất bại.");
        }
      },
      "Xóa"
    );
  };

  useEffect(() => {
    if ((currentSubTab === "leave-requests" || currentSubTab === "attendance") && selectedCompanyCode) {
      fetchApplications();
    }
    if (currentSubTab === "leave-requests" && selectedCompanyCode) fetchTemplates();
  }, [currentSubTab, selectedCompanyCode]);

  const handleDeleteItem = async (itemId: string) => {
    askConfirm(
      "Xóa lịch trình",
      "Bạn có chắc chắn muốn xóa lịch trình này không? Hành động này không thể hoàn tác.",
      async () => {
        try {
          const res = await fetch(`/api/v1/crud/hr-calendar-events/${itemId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${getAccessToken()}`,
            },
          });

          if (!res.ok) {
            throw new Error((await res.json().catch(() => ({})))?.message || "Lỗi mạng khi xóa.");
          }

          toast.success("Đã xóa lịch trình thành công.");
          setIsDetailModalOpen(false);
          setIsFormModalOpen(false);
          fetchCalendarItems();
        } catch (err: any) {
          console.error(err);
          toast.error(getApiErrorMessage(err, "Xóa lịch trình thất bại."));
        }
      },
      "Xóa"
    );
  };

  useEffect(() => {
    fetchCalendarItems();
  }, [selectedCompanyCode]);

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
  }, [currentSubTab, logFilterEmployee, logStartDate, logEndDate, selectedCompanyCode]);

  const renderLeaveRequestsTab = () => {
    const getAppTypeLabel = (type: string) => {
      switch (type) {
        case "leave": return "Nghỉ phép";
        case "late": return "Đi trễ";
        case "early": return "Về sớm";
        case "other": return "Đơn khác";
        default: return type;
      }
    };

    const filteredApplications = applications.filter((app) => {
      const matchType = !filterAppType || app.type === filterAppType;
      if (!filterSearchQuery.trim()) {
        return matchType;
      }

      const query = filterSearchQuery.toLowerCase();
      const typeLabel = getAppTypeLabel(app.type).toLowerCase();
      const employeeName = (app.employeeName || "").toLowerCase();
      const reason = (app.reason || "").toLowerCase();
      const note = (app.note || "").toLowerCase();
      const rejectReason = (app.rejectReason || "").toLowerCase();

      const matchSearch =
        employeeName.includes(query) ||
        typeLabel.includes(query) ||
        reason.includes(query) ||
        note.includes(query) ||
        rejectReason.includes(query);

      return matchType && matchSearch;
    });

    const getStatusBadge = (status: string, rejectReason?: string) => {
      switch (status) {
        case "approved":
          return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-100">Đã duyệt</span>;
        case "rejected":
          return (
            <span
              className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-100 cursor-help"
              title={rejectReason ? `Lý do từ chối: ${rejectReason}` : "Bị từ chối"}
            >
              Từ chối (?)
            </span>
          );
        default:
          return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-100 animate-pulse">Chờ duyệt</span>;
      }
    };

    return (
      <div className="space-y-6 animate-fade-in text-left">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-100/80 shadow-md shadow-slate-100/50">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 tracking-wide uppercase">
              Quản lý Đơn từ & Phép
            </h2>
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              Nộp đơn xin nghỉ, đi trễ và quản lý biểu mẫu mẫu
            </p>
          </div>
          <div className="flex gap-2">
            {!isLeaveAdmin && (
              <button
                onClick={openAppForm}
                className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-650 hover:bg-indigo-700 active:scale-98 text-white rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer border-0"
              >
                <Plus className="h-4 w-4" />
                Viết đơn mới
              </button>
            )}
            {isLeaveAdmin && (
              <>
                <button
                  onClick={() => {
                    setTplCurrentPage(1);
                    setIsTemplateListModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer border-0 shadow-3xs"
                >
                  <FileText className="h-4 w-4 text-indigo-650" />
                  Biểu mẫu mẫu
                </button>
                <button
                  onClick={() => setIsTemplateFormOpen(true)}
                  className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-bold transition cursor-pointer border-0 shadow-3xs"
                >
                  <Upload className="h-4 w-4" />
                  Đăng biểu mẫu mới
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Right panel - Leave Applications */}
          <div className="lg:col-span-12">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  {isLeaveAdmin ? "Danh sách Đơn của nhân sự" : "Đơn từ đã nộp của bạn"}
                </h3>
                {isLeaveAdmin && (
                  <div className="flex flex-wrap gap-2.5 items-center">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Tìm nhân viên, lý do, loại đơn..."
                        value={filterSearchQuery}
                        onChange={(e) => setFilterSearchQuery(e.target.value)}
                        className="px-3 py-1 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:border-indigo-500 outline-none w-48 sm:w-64 placeholder:text-slate-400 font-medium transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        Loại đơn:
                      </span>
                      <select
                        value={filterAppType}
                        onChange={(e) => setFilterAppType(e.target.value)}
                        className="px-2.5 py-1 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                      >
                        <option value="">Tất cả</option>
                        {templates.map((tpl) => (
                          <option key={tpl._id || tpl.id} value={tpl.name}>
                            {tpl.name}
                          </option>
                        ))}
                        <option value="other">Đơn khác</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-100 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider">
                    <tr>
                      {isLeaveAdmin && <th className="px-5 py-4 min-w-[120px]">Nhân sự</th>}
                      <th className="px-5 py-4 min-w-[100px]">Loại phép</th>
                      <th className="px-5 py-4 min-w-[160px]">Thời gian</th>
                      <th className="px-5 py-4 min-w-[220px]">Lý do</th>
                      <th className="px-5 py-4 min-w-[150px]">Đơn đính kèm</th>
                      {isLeaveAdmin ? (
                        <>
                          <th className="px-5 py-4 text-center min-w-[110px]">Trạng thái</th>
                          <th className="px-5 py-4 min-w-[200px]">Phản hồi của Admin</th>
                          <th className="px-5 py-4 text-center min-w-[90px]">Thao tác</th>
                        </>
                      ) : (
                        <>
                          <th className="px-5 py-4 min-w-[200px]">Ghi chú</th>
                          <th className="px-5 py-4 text-center min-w-[110px]">Trạng thái</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {isAppLoading ? (
                      <tr>
                        <td colSpan={isLeaveAdmin ? 8 : 6} className="px-5 py-12 text-center text-slate-400">
                          <div className="flex justify-center items-center gap-2">
                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            Đang tải danh sách đơn từ...
                          </div>
                        </td>
                      </tr>
                    ) : filteredApplications.length === 0 ? (
                      <tr>
                        <td colSpan={isLeaveAdmin ? 8 : 6} className="px-5 py-12 text-center text-slate-400 font-medium">
                          {applications.length === 0 ? "Chưa có đơn từ nào được đăng ký." : "Không tìm thấy đơn từ nào khớp với bộ lọc."}
                        </td>
                      </tr>
                    ) : (
                      filteredApplications.map((app) => {
                        const showDelete = app.status === "pending" || isLeaveAdmin;

                        return (
                          <tr key={app._id || app.id} className="hover:bg-slate-50/50 transition-colors">
                            {isLeaveAdmin && (
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="font-bold text-slate-800">{app.employeeName}</div>
                              </td>
                            )}
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="font-bold text-slate-850">{getAppTypeLabel(app.type)}</span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap font-mono text-[10px] text-slate-500">
                              <div>{new Date(app.startDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
                              <div>đến {new Date(app.endDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
                            </td>
                            <td className="px-5 py-4 min-w-[200px] max-w-[350px] whitespace-normal leading-relaxed text-slate-650 font-medium" title={app.reason} style={{ wordBreak: "break-all" }}>
                              {app.reason}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {app.uploadedFileUrl ? (
                                <a
                                  href={getFileDownloadUrl(app.uploadedFileUrl, app.uploadedFileName)}
                                  download={app.uploadedFileName}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-250 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold transition-all shadow-3xs"
                                  title={`Tải xuống: ${app.uploadedFileName}`}
                                >
                                  <Download className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                                  <span>Xem đơn đính kèm</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">Chưa có tệp</span>
                              )}
                            </td>
                            {isLeaveAdmin ? (
                              <>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  {getStatusBadge(app.status, app.rejectReason)}
                                </td>
                                <td className="px-5 py-4 min-w-[200px] max-w-[350px] whitespace-normal leading-relaxed text-slate-650 font-medium" style={{ wordBreak: "break-all" }}>
                                  {app.note || app.rejectReason || <span className="text-slate-400 italic">-</span>}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {app.status === "pending" && (
                                      <>
                                        <button
                                          onClick={() => handleApproveApp(app)}
                                          className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer border-0"
                                          title="Duyệt đơn"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setSelectedAppId(app._id || app.id);
                                            setRejectReasonText("");
                                            setAppRejectModalOpen(true);
                                          }}
                                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer border-0"
                                          title="Từ chối"
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                    {showDelete && (
                                      <button
                                        onClick={() => handleDeleteApp(app._id || app.id)}
                                        className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer border-0 bg-transparent"
                                        title="Xóa đơn"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-5 py-4 min-w-[200px] max-w-[350px] whitespace-normal leading-relaxed text-slate-650 font-medium" style={{ wordBreak: "break-all" }}>
                                  {app.note || app.rejectReason || <span className="text-slate-400 italic">-</span>}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                  {getStatusBadge(app.status, app.rejectReason)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
    const calculateWorkedMinutes = (uid: string, checkIn?: string | Date, checkOut?: string | Date) =>
      calculateAttendanceWorkedMinutes(checkIn, checkOut, effectiveHours(uid));

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

      if (isWeekend) {
        return { status: "weekend", coeff: null, checkIn: "", checkOut: "", dateStr, isWeekend: true, isFuture };
      }

      if (isFuture) {
        return { status: "", coeff: null, checkIn: "", checkOut: "", dateStr, isWeekend: false, isFuture: true };
      }

      if (dbLog) {
        const workedMinutes = calculateWorkedMinutes(emp.uid, dbLog.checkIn?.time, dbLog.checkOut?.time);
        const hours = Math.round((workedMinutes / 60) * 10) / 10;
        const coeff = workedMinutes / standardDailyMinutes(emp.uid);
        return {
          status: dbLog.status,
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
      for (let day = 1; day <= daysInMonth; day++) {
        const cell = getDayCellData(emp, day);
        if (!cell.isWeekend && !cell.isFuture && cell.coeff !== null) {
          totalWorkedMinutes += cell.workedMinutes || 0;
        }
      }
      const totals = attendanceTotalsFromMinutes(totalWorkedMinutes, standardDailyMinutes(emp.uid));
      return { totalHours: totals.totalHours, totalCoeff: totals.totalDays };
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
      <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px] animate-fade-in rounded-3xl overflow-hidden border border-slate-200 shadow-lg bg-white">
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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDisplayModeDropdownOpen(!isDisplayModeDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border-0"
                >
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {cellDisplayMode === "coeff" ? "Số công" : "Số giờ"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {isDisplayModeDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => { setCellDisplayMode("coeff"); setIsDisplayModeDropdownOpen(false); }}
                      className="w-full px-3.5 py-2 text-left hover:bg-cyan-50 flex items-center justify-between text-slate-700 cursor-pointer"
                    >
                      <span>Số công</span>
                      {cellDisplayMode === "coeff" && <Check className="h-4 w-4 text-cyan-600 font-bold" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCellDisplayMode("hours"); setIsDisplayModeDropdownOpen(false); }}
                      className="w-full px-3.5 py-2 text-left hover:bg-cyan-50 flex items-center justify-between text-slate-700 cursor-pointer"
                    >
                      <span>Số giờ</span>
                      {cellDisplayMode === "hours" && <Check className="h-4 w-4 text-cyan-600 font-bold" />}
                    </button>
                  </div>
                )}
              </div>
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
                onExportHours={() => handleAttendanceExcelExport("hours")}
              />
            </div>
          </div>

          {/* Bảng Grid Chấm Công */}
          <div className="flex-1 overflow-auto visible-scrollbar">
            {isLogsLoading ? (
              <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                <div className="w-5 h-5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Đang tải dữ liệu chấm công...</span>
              </div>
            ) : (
              <table className="text-xs border-collapse table-fixed" style={{ minWidth: `${504 + daysInMonth * 50}px` }}>
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
                    {/* Cột Số giờ */}
                    <th className="sticky left-[392px] z-50 bg-emerald-700 border-b border-r border-emerald-800 px-2 py-2 text-center font-black text-[10px] text-white uppercase tracking-wider whitespace-nowrap min-w-[56px] w-[56px]">
                      Số<br/>giờ
                    </th>
                    {/* Cột Số công */}
                    <th className="sticky left-[448px] z-50 bg-emerald-700 border-b border-r-2 border-slate-400 px-2 py-2 text-center font-black text-[10px] text-white uppercase tracking-wider whitespace-nowrap min-w-[56px] w-[56px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]">
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
                          {/* Tổng giờ */}
                          <td className="sticky left-[392px] z-30 border-r border-emerald-200 px-2 py-2.5 text-center bg-emerald-50 whitespace-nowrap min-w-[56px] w-[56px]">
                            <span className="text-xs font-black text-emerald-700">{totalHours}h</span>
                          </td>
                          {/* Tổng công */}
                          <td className="sticky left-[448px] z-30 border-r-2 border-slate-400 px-2 py-2.5 text-center bg-emerald-50 whitespace-nowrap min-w-[56px] w-[56px] shadow-[3px_0_6px_-2px_rgba(0,0,0,0.15)]">
                            <span className="text-xs font-black text-emerald-700">{totalCoeff}</span>
                          </td>
                          {dayColumns.map(day => {
                            const cell = getDayCellData(emp, day);
                            const isWeekend = cell.isWeekend;
                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
                                className={`border-r border-slate-200 px-0.5 py-1.5 text-center whitespace-nowrap w-12 group cursor-default ${isToday ? "bg-cyan-50" : ""}`}
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
                                          {cell.status === "Present"
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
                                    </div>
                                  ) : null
                                ) : cellDisplayMode === "coeff" ? (
                                  <>
                                    {/* Hệ số công */}
                                    <div className={`text-sm font-black leading-none ${isAbsent ? "text-rose-500" : isFullDay ? "text-slate-800" : "text-rose-500"}`}>
                                      {coeff === 1 ? "1" : coeff === 0 ? "0" : coeff.toFixed(1)}
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

  // Open creation form for a specific day
  const handleDayClick = (dayDate: Date) => {
    setSelectedDayDate(dayDate);
    const itemsOnDay = filteredItems.filter((it) => itemMatchesDay(it, dayDate));

    if (itemsOnDay.length > 0) {
      // If there are existing items, show detail popup first
      setIsDetailModalOpen(true);
    } else {
      // Otherwise directly open create popup
      openCreateModal(dayDate);
    }
  };

  const openCreateModal = (date: Date, type: "event" | "leave" | "wfh" | "exception" | "reminder" = "event") => {
    const formattedDate = date.toISOString().slice(0, 10);
    setFormMode("create");
    setFormType(type);
    setFormTitle("");
    setFormDescription("");
    setFormStartDate(formattedDate);
    setFormStartTime("08:00");
    setFormEndDate(formattedDate);
    setFormEndTime("17:00");
    setFormEmployeeId(userProfile?.uid || "");
    setFormAssigneeId(userProfile?.uid || "");
    setFormStatus(type === "leave" ? "pending" : "active");

    setIsFormModalOpen(true);
    setIsDetailModalOpen(false);
  };

  // Open edit modal for an item
  const openEditModal = (item: CalendarItem) => {
    setSelectedItem(item);
    setFormMode("edit");
    setFormType(item.type);
    setFormTitle(item.title);
    setFormDescription(item.description || "");

    const sDate = new Date(item.startDate);
    const eDate = new Date(item.endDate);

    setFormStartDate(sDate.toISOString().slice(0, 10));
    setFormStartTime(sDate.toLocaleTimeString("en-US", { hour12: false }).slice(0, 5));
    setFormEndDate(eDate.toISOString().slice(0, 10));
    setFormEndTime(eDate.toLocaleTimeString("en-US", { hour12: false }).slice(0, 5));

    setFormEmployeeId(item.employeeId || "");
    setFormAssigneeId(item.assigneeId || "");
    setFormStatus(item.status);

    setIsFormModalOpen(true);
    setIsDetailModalOpen(false);
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Vui lòng nhập tiêu đề.");
      return;
    }

    const startDateTime = new Date(`${formStartDate}T${formStartTime}:00`);
    const endDateTime = new Date(`${formEndDate}T${formEndTime}:00`);

    if (endDateTime < startDateTime) {
      toast.error("Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu.");
      return;
    }

    if ((formType === "leave" || formType === "wfh" || formType === "exception") && !canManageAttendance) {
      toast.error("Chỉ quản lý và admin mới có quyền tạo đơn nghỉ phép, làm tại nhà hoặc ngoại lệ.");
      return;
    }

    if ((formType === "leave" || formType === "wfh" || formType === "exception") && formStatus === "approved") {
      if (formMode === "create" || selectedItem?.creatorId === userProfile?.uid) {
        toast.error("Người tạo đơn không được phép tự phê duyệt.");
        return;
      }
    }

    const selectedEmployee = employees.find((emp) => emp.id === formEmployeeId);

    const payload: Partial<CalendarItem> = {
      type: formType,
      title: formTitle,
      description: formDescription,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      employeeId: (formType === "leave" || formType === "wfh" || formType === "exception") ? formEmployeeId : undefined,
      employeeName: (formType === "leave" || formType === "wfh" || formType === "exception") ? (selectedEmployee?.name || userProfile?.displayName) : undefined,
      assigneeId: formType === "reminder" ? formAssigneeId : undefined,
      status: (formType === "leave" || formType === "wfh" || formType === "exception") && formMode === "create" ? "pending" : formStatus as any,
      companyCode: selectedCompanyCode,
      creatorId: userProfile?.uid || "unknown",
    };

    try {
      let res;
      if (formMode === "create") {
        res = await fetch("/api/v1/crud/hr-calendar-events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/v1/crud/hr-calendar-events/${selectedItem?._id || selectedItem?.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({})))?.message || "Lỗi mạng khi lưu lịch.");
      }

      toast.success(formMode === "create" ? "Tạo mới lịch trình thành công!" : "Cập nhật lịch trình thành công!");
      setIsFormModalOpen(false);
      fetchCalendarItems();
    } catch (err: any) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Không thể lưu lịch trình. Vui lòng thử lại."));
    }
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
            Lịch trình & Nghỉ phép
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
          <button
            onClick={() => setCurrentSubTab("leave-requests")}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentSubTab === "leave-requests"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/40"
                : "text-gray-500 hover:text-gray-800"
              }`}
          >
            Quản lý Đơn từ
          </button>
        </div>
      </div>

      {currentSubTab === "attendance" ? (
        renderAttendanceTab()
      ) : currentSubTab === "leave-requests" ? (
        renderLeaveRequestsTab()
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
                <div className="flex border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs ml-3 bg-white">
                  <button
                    onClick={handlePrevMonth}
                    className="p-2.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-slate-650 cursor-pointer"
                    title="Tháng trước"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleGoToday}
                    className="px-4 py-1.5 hover:bg-slate-50 active:bg-slate-100 transition-colors font-bold text-xs text-slate-700 border-x border-slate-150 cursor-pointer"
                  >
                    Tháng này
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-2.5 hover:bg-slate-50 active:bg-slate-100 transition-colors text-slate-650 cursor-pointer"
                    title="Tháng sau"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Search and direct create dropdown */}
              <div className="flex items-center gap-3 self-end md:self-auto">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm tiêu đề, mô tả..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-3.5 pr-9 py-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 rounded-2xl text-xs focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 w-44 md:w-56 font-semibold shadow-2xs transition-all duration-200"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Quick Add Dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-500/20 active:scale-98 text-white rounded-2xl text-xs font-extrabold transition-all shadow-sm cursor-pointer">
                    <Plus className="h-4 w-4" />
                    Thêm mới
                  </button>
                  <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-150 rounded-2xl shadow-xl py-1.5 hidden group-hover:block group-focus-within:block z-20 transition-all animate-in fade-in duration-100">
                    <button
                      onClick={() => openCreateModal(new Date(), "event")}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer"
                    >
                      <CalendarCheck className="h-4 w-4 text-blue-500" />
                      Tạo sự kiện
                    </button>
                    {isLeaveAdmin && (
                      <>
                        <button
                          onClick={() => openCreateModal(new Date(), "leave")}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Users className="h-4 w-4 text-rose-500" />
                          Đăng ký nghỉ phép
                        </button>
                        <button
                          onClick={() => openCreateModal(new Date(), "wfh")}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer"
                        >
                          <Info className="h-4 w-4 text-teal-500" />
                          Làm tại nhà
                        </button>
                        <button
                          onClick={() => openCreateModal(new Date(), "exception")}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer"
                        >
                          <CheckCircle className="h-4 w-4 text-violet-500" />
                          Ngoại lệ
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openCreateModal(new Date(), "reminder")}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2.5 cursor-pointer"
                    >
                      <Bell className="h-4 w-4 text-amber-500" />
                      Tạo nhắc hẹn
                    </button>
                  </div>
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
                                  openEditModal(item);
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
                        <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {(!["leave", "wfh", "exception"].includes(item.type) || isLeaveAdmin) && (
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 text-slate-400 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Sửa"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(!["leave", "wfh", "exception"].includes(item.type) || isLeaveAdmin) && (
                            <button
                              onClick={() => handleDeleteItem((item._id || item.id)!)}
                              className="p-1 text-slate-400 hover:text-rose-650 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Xóa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
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

            {/* Modal Footer (Actions to Quick Add) */}
            <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Thêm mới:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => openCreateModal(selectedDayDate, "event")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-extrabold transition-all shadow-sm hover:shadow-md cursor-pointer"
                >
                  Sự kiện
                </button>
                {canManageAttendance && (
                  <>
                    <button
                      onClick={() => openCreateModal(selectedDayDate, "leave")}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-extrabold transition-all shadow-sm hover:shadow-md cursor-pointer"
                    >
                      Nghỉ phép
                    </button>
                    <button
                      onClick={() => openCreateModal(selectedDayDate, "wfh")}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[10px] font-extrabold transition-all shadow-sm hover:shadow-md cursor-pointer"
                    >
                      Tại nhà
                    </button>
                    <button
                      onClick={() => openCreateModal(selectedDayDate, "exception")}
                      className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-extrabold transition-all shadow-sm hover:shadow-md cursor-pointer"
                    >
                      Ngoại lệ
                    </button>
                  </>
                )}
                <button
                  onClick={() => openCreateModal(selectedDayDate, "reminder")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-extrabold transition-all shadow-sm hover:shadow-md cursor-pointer"
                >
                  Nhắc hẹn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Create/Edit Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90dvh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-4 sm:px-6 py-4.5 shrink-0">
              <h3 className="font-extrabold text-slate-800 text-sm">
                {formMode === "create" ? "Tạo lịch trình mới" : "Chỉnh sửa lịch trình"}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
                {/* Category Picker */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Loại lịch trình
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { key: "event", label: "📅 Sự kiện", color: "border-blue-500 text-blue-600" },
                      { key: "leave", label: "🌴 Nghỉ phép", color: "border-rose-500 text-rose-600", roleRestricted: true },
                      { key: "wfh", label: "🏠 Tại nhà", color: "border-teal-500 text-teal-600", roleRestricted: true },
                      { key: "exception", label: "⚡ Ngoại lệ", color: "border-violet-500 text-violet-600", roleRestricted: true },
                      { key: "reminder", label: "🔔 Nhắc hẹn", color: "border-amber-500 text-amber-600" }
                    ].filter(t => !t.roleRestricted || isLeaveAdmin).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => {
                          setFormType(t.key as any);
                          if (["leave", "wfh", "exception"].includes(t.key)) setFormStatus("pending");
                          else setFormStatus("active");
                        }}
                        className={`py-2 border text-center rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${formType === t.key
                            ? `${t.color} bg-slate-50/50 font-black border-2 shadow-3xs`
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Tiêu đề
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      formType === "leave"
                        ? "Ví dụ: Nghỉ phép cá nhân, Nghỉ ốm..."
                        : formType === "reminder"
                          ? "Ví dụ: Gọi điện cho khách hàng, Nộp báo cáo..."
                          : "Ví dụ: Họp nội bộ phòng ban..."
                    }
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200/80 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all shadow-2xs"
                  />
                </div>

                {/* Date & Time Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Ngày bắt đầu
                    </label>
                    <input
                      type="date"
                      required
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200/80 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Giờ bắt đầu
                    </label>
                    <input
                      type="time"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200/80 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Ngày kết thúc
                    </label>
                    <input
                      type="date"
                      required
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200/80 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Giờ kết thúc
                    </label>
                    <input
                      type="time"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200/80 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all"
                    />
                  </div>
                </div>

                {/* Conditional Fields based on Type */}
                {["wfh", "exception"].includes(formType) && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      {formType === "wfh" ? "Nhân sự làm tại nhà" : "Nhân sự (Ngoại lệ)"}
                    </label>
                    <select
                      value={formEmployeeId}
                      onChange={(e) => setFormEmployeeId(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200/80 bg-white rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold cursor-pointer transition-all"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formType === "leave" && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Nhân sự nghỉ phép
                    </label>
                    <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-500">
                      {formMode === "edit" ? (selectedItem?.employeeName || userProfile?.displayName || "Bạn") : (userProfile?.displayName || "Bạn")}
                    </div>
                  </div>
                )}

                {formType === "reminder" && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Người nhận nhắc nhở
                    </label>
                    <select
                      value={formAssigneeId}
                      onChange={(e) => setFormAssigneeId(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200/80 bg-white rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold cursor-pointer transition-all"
                    >
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status for Leaves / WFH / Exception */}
                {["leave", "wfh", "exception"].includes(formType) && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Trạng thái duyệt
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      disabled={formMode === "create" || selectedItem?.creatorId === userProfile?.uid}
                      className="w-full px-3.5 py-2 border border-slate-200/80 bg-white rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold cursor-pointer transition-all disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="pending">Chờ phê duyệt</option>
                      {!(formMode === "create" || selectedItem?.creatorId === userProfile?.uid) && (
                        <option value="approved">Đã phê duyệt</option>
                      )}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Mô tả chi tiết
                  </label>
                  <textarea
                    placeholder="Nhập nội dung mô tả hoặc ghi chú..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200/80 rounded-2xl text-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-semibold transition-all shadow-2xs resize-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="bg-slate-50 border-t border-slate-150 px-4 sm:px-6 py-4.5 flex justify-between items-center gap-3 shrink-0 flex-wrap">
                <div>
                  {formMode === "edit" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(selectedItem?._id || selectedItem?.id || "")}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl text-xs font-bold transition-all border border-rose-200/80 hover:shadow-md cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Xóa lịch
                    </button>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-500/10 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer"
                  >
                    {formMode === "create" ? "Tạo lịch" : "Cập nhật"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Viết Đơn Mới */}
      {isAppFormOpen && (() => {
        const matchedTemplate = templates.find((t) => t.name === appType);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
                <h3 className="font-extrabold text-slate-800 text-sm">Viết đơn xin nghỉ / đi trễ</h3>
                <button
                  onClick={() => setIsAppFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateApplicationSubmit}>
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Loại đơn
                    </label>
                    <select
                      value={appType}
                      onChange={(e) => setAppType(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 bg-white rounded-2xl text-xs font-semibold cursor-pointer outline-none focus:border-indigo-500"
                    >
                      {templates.map((t) => (
                        <option key={t._id || t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                      <option value="other">Đơn khác</option>
                    </select>
                  </div>

                  {matchedTemplate && (
                    <div className="bg-indigo-50/85 border border-indigo-150 p-3.5 rounded-2xl flex items-center justify-between text-xs text-indigo-750 font-bold transition-all animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4.5 w-4.5 text-indigo-650 shrink-0 animate-pulse" />
                        <span className="truncate">Tải biểu mẫu mẫu: {matchedTemplate.name}</span>
                      </div>
                      <a
                        href={matchedTemplate.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1 shrink-0 transition-colors shadow-2xs border-0"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Tải mẫu
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        required
                        value={appStartDate}
                        onChange={(e) => setAppStartDate(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                        Giờ bắt đầu
                      </label>
                      <input
                        type="time"
                        required
                        value={appStartTime}
                        onChange={(e) => setAppStartTime(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        required
                        value={appEndDate}
                        onChange={(e) => setAppEndDate(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                        Giờ kết thúc
                      </label>
                      <input
                        type="time"
                        required
                        value={appEndTime}
                        onChange={(e) => setAppEndTime(e.target.value)}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Lý do xin phép
                    </label>
                    <textarea
                      required
                      placeholder="Nhập lý do cụ thể..."
                      value={appReason}
                      onChange={(e) => setAppReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                      Đính kèm đơn (Đã điền thông tin - Không bắt buộc)
                    </label>
                    <input
                      type="file"
                      accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.xls,.xlsx"
                      onChange={(e) => setAppFile(e.target.files?.[0] || null)}
                      className="w-full text-xs font-semibold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAppFormOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-2xl text-xs font-bold transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isFileUploading}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {isFileUploading ? "Đang nộp đơn..." : "Nộp đơn"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Danh sách Biểu mẫu mẫu */}
      {isTemplateListModalOpen && (() => {
        const tplPageSize = 5;
        const totalTplPages = Math.ceil(templates.length / tplPageSize) || 1;
        const activePage = Math.min(tplCurrentPage, totalTplPages);
        const indexOfLastTpl = activePage * tplPageSize;
        const indexOfFirstTpl = indexOfLastTpl - tplPageSize;
        const currentTemplates = templates.slice(indexOfFirstTpl, indexOfLastTpl);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
              <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                  Danh sách Biểu mẫu mẫu
                </h3>
                <button
                  onClick={() => setIsTemplateListModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {isTemplateLoading && (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {!isTemplateLoading && templates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">
                    Chưa có biểu mẫu mẫu nào được đăng ký.
                  </p>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100 border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/30">
                      {currentTemplates.map((tpl) => (
                        <div
                          key={tpl._id || tpl.id}
                          className="flex items-center justify-between p-3.5 hover:bg-slate-100/50 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-xs truncate" title={tpl.name}>
                                {tpl.name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium truncate" title={tpl.fileName}>
                                {tpl.fileName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={tpl.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={tpl.fileName}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-bold transition-all border border-indigo-200 cursor-pointer shadow-3xs text-decoration-none"
                              title="Tải biểu mẫu"
                            >
                              <Download className="h-3 w-3" />
                              Tải mẫu
                            </a>
                            {isLeaveAdmin && (
                              <button
                                onClick={() => handleDeleteTpl(tpl._id || tpl.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[10px] font-bold transition-all border border-rose-200 cursor-pointer shadow-3xs"
                                title="Xóa biểu mẫu"
                              >
                                <Trash2 className="h-3 w-3" />
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalTplPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">
                          Trang {activePage} / {totalTplPages}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTplCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={activePage === 1}
                            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer text-slate-650 flex items-center justify-center bg-white"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTplCurrentPage(prev => Math.min(prev + 1, totalTplPages))}
                            disabled={activePage === totalTplPages}
                            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent transition cursor-pointer text-slate-650 flex items-center justify-center bg-white"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsTemplateListModalOpen(false)}
                  className="px-4.5 py-2 bg-slate-200 hover:bg-slate-300 hover:shadow-sm text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer border-0"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Tải Biểu Mẫu Mẫu (Admin/Manager) */}
      {isTemplateFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">Đăng tải biểu mẫu mẫu mới</h3>
              <button
                onClick={() => setIsTemplateFormOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadTemplateSubmit}>
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Tên biểu mẫu
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Đơn xin nghỉ phép năm, Đơn xin đi trễ..."
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Tệp tài liệu mẫu (Word/Excel/PDF...)
                  </label>
                  <input
                    type="file"
                    required
                    accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.xls,.xlsx"
                    onChange={(e) => setTplFile(e.target.files?.[0] || null)}
                    className="w-full text-xs font-semibold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsTemplateFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isFileUploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isFileUploading ? "Đang tải lên..." : "Tải lên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lý do Từ chối đơn */}
      {appRejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">Từ chối duyệt đơn</h3>
              <button
                onClick={() => setAppRejectModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRejectAppSubmit}>
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Lý do từ chối đơn
                  </label>
                  <textarea
                    required
                    placeholder="Nhập lý do chi tiết để phản hồi nhân viên..."
                    value={rejectReasonText}
                    onChange={(e) => setRejectReasonText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAppRejectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  Từ chối đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Duyệt đơn & Phản hồi (Admin/Manager) */}
      {appApproveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">Phê duyệt đơn xin nghỉ</h3>
              <button
                onClick={() => setAppApproveModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApproveAppSubmit}>
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Ghi chú / Phản hồi cho nhân viên (Tùy chọn)
                  </label>
                  <textarea
                    placeholder="Nhập ghi chú phản hồi cho nhân viên nếu cần..."
                    value={approveNoteText}
                    onChange={(e) => setApproveNoteText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border-t border-slate-150 px-6 py-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAppApproveModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-650 rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  Duyệt đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom confirm dialog — thay thế native window.confirm */}
      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </div>
  );
}
