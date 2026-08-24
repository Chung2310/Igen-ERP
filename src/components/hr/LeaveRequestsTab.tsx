import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  FileText,
  Upload,
  Download,
  Check,
  XCircle,
  Send,
} from "lucide-react";
import { UserProfile, EmployeeNode } from "../../types";
import { getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";

/** Bốn loại yêu cầu nhân sự có thể xin qua đơn từ. Khớp với enum requestKind ở server. */
export type RequestKind = "event" | "leave" | "wfh" | "exception";

export const REQUEST_KIND_OPTIONS: { value: RequestKind; label: string }[] = [
  { value: "event", label: "Tạo sự kiện" },
  { value: "leave", label: "Nghỉ phép" },
  { value: "wfh", label: "Làm tại nhà" },
  { value: "exception", label: "Ngoại lệ" },
];

const REQUEST_KIND_BADGE: Record<RequestKind, string> = {
  event: "bg-sky-50 text-sky-700 border-sky-100",
  leave: "bg-violet-50 text-violet-700 border-violet-100",
  wfh: "bg-amber-50 text-amber-700 border-amber-100",
  exception: "bg-slate-100 text-slate-700 border-slate-200",
};

const getRequestKindLabel = (kind?: string) =>
  REQUEST_KIND_OPTIONS.find((o) => o.value === kind)?.label || "Nghỉ phép";

interface LeaveRequestsTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  /** True when the user can upload templates and approve/reject other people's requests. */
  canApprove?: boolean;
  usersList: UserProfile[];
  employees?: EmployeeNode[];
  /** Gọi sau khi một đơn được duyệt/từ chối để tab Lịch trình tải lại dữ liệu. */
  onApproved?: () => void;
}

export default function LeaveRequestsTab({
  userProfile,
  selectedCompanyCode,
  canApprove = false,
  usersList = [],
  onApproved,
}: LeaveRequestsTabProps) {
  const isLeaveAdmin = canApprove;
  const useCardLayout = useMediaQuery("(max-width: 1699px)");

  const [templates, setTemplates] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isAppFormOpen, setIsAppFormOpen] = useState(false);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [isTemplateListModalOpen, setIsTemplateListModalOpen] = useState(false);
  const [tplCurrentPage, setTplCurrentPage] = useState(1);
  const [filterSearchQuery, setFilterSearchQuery] = useState("");
  const [filterAppType, setFilterAppType] = useState("");
  const [appRejectModalOpen, setAppRejectModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState("");
  const [appType, setAppType] = useState("leave");
  const [appRequestKind, setAppRequestKind] = useState<RequestKind>("leave");
  const [filterRequestKind, setFilterRequestKind] = useState("");
  const [tplRequestKind, setTplRequestKind] = useState<RequestKind>("leave");
  const [appStartDate, setAppStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [appEndDate, setAppEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [appFile, setAppFile] = useState<File | null>(null);
  const [appFiles, setAppFiles] = useState<File[]>([]);
  const [appEmployeeId, setAppEmployeeId] = useState(userProfile?.uid || "");
  const [leaveBalance, setLeaveBalance] = useState<any>(null);
  const [tplName, setTplName] = useState("");
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [isFileUploading, setIsFileUploading] = useState(false);

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

  const getFileDownloadUrl = (url: string, filename: string) => {
    if (!url) return "#";
    const token = localStorage.getItem("accessToken") || "";
    return `/api/v1/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || "don-xin-phep")}&token=${encodeURIComponent(token)}`;
  };

  const uploadFileToCloudinary = async (file: File): Promise<{ url: string; uploadToken: string }> => {
    const reader = new FileReader();
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

    const res = await fetch("/api/v1/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        file: fileBase64,
        sourceType: "hr.leave",
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
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
    if (!json.url || !json.uploadToken) throw new Error("Upload không trả về token quản lý tài nguyên.");
    return { url: json.url, uploadToken: json.uploadToken };
  };

  const fetchLeaveBalance = async (employeeId = appEmployeeId, leaveYear = Number(appStartDate.slice(0, 4))) => {
    if (!employeeId || !selectedCompanyCode || !leaveYear) return;
    try {
      const res = await fetch(
        `/api/v1/leave/balance?employeeId=${encodeURIComponent(employeeId)}&year=${leaveYear}`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
      if (res.ok) setLeaveBalance((await res.json()).data || null);
    } catch (error) {
      console.error("Không thể tải số dư phép", error);
    }
  };

  const fetchTemplates = async () => {
    if (!selectedCompanyCode) return;
    setIsTemplateLoading(true);
    try {
      const res = await fetch(
        `/api/v1/crud/hr-leave-templates?companyCode=${encodeURIComponent(selectedCompanyCode)}`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
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
      const res = await fetch(
        `/api/v1/crud/hr-leave-applications?companyCode=${encodeURIComponent(selectedCompanyCode)}`,
        { headers: { Authorization: `Bearer ${getAccessToken()}` } }
      );
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

  useEffect(() => {
    if (!selectedCompanyCode) return;
    fetchApplications();
    fetchTemplates();
  }, [selectedCompanyCode]);

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
      const { url: fileUrl, uploadToken } = await uploadFileToCloudinary(tplFile);
      const res = await fetch("/api/v1/crud/hr-leave-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: tplName,
          requestKind: tplRequestKind,
          fileUrl,
          fileName: tplFile.name,
          uploadedBy: userProfile?.uid || "unknown",
          uploadToken,
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
      setTplRequestKind("leave");
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
    setAppType(templates.length > 0 ? templates[0].name : "other");
    setAppRequestKind((templates[0]?.requestKind as RequestKind) || "leave");
    // Nhân viên thường luôn nộp đơn cho chính mình; cấp duyệt có thể đổi ở form.
    const defaultEmployeeId = userProfile?.uid || "";
    setAppEmployeeId(defaultEmployeeId);
    setAppFile(null);
    setAppFiles([]);
    setIsAppFormOpen(true);
    fetchLeaveBalance(defaultEmployeeId, new Date().getFullYear());
  };

  const handleCreateApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appStartDate || !appEndDate) {
      toast.error("Vui lòng chọn đầy đủ ngày nghỉ.");
      return;
    }
    const startDateTime = new Date(`${appStartDate}T00:00:00`);
    const endDateTime = new Date(`${appEndDate}T23:59:59`);
    if (endDateTime < startDateTime) {
      toast.error("Thời gian kết thúc phải lớn hơn hoặc bằng thời gian bắt đầu.");
      return;
    }

    setIsFileUploading(true);
    try {
      const attachments = await Promise.all(
        appFiles.map(async (file) => {
          const uploaded = await uploadFileToCloudinary(file);
          return {
            url: uploaded.url,
            uploadToken: uploaded.uploadToken,
            name: file.name,
            mimeType: file.type,
            size: file.size,
          };
        })
      );
      const fileUrl = attachments[0]?.url || "";
      const targetEmp = usersList.find((u) => u.uid === appEmployeeId);
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
          requestKind: appRequestKind,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          reason: `Đăng ký ${getRequestKindLabel(appRequestKind).toLowerCase()}`,
          uploadedFileUrl: fileUrl,
          uploadedFileName: appFile ? appFile.name : "",
          attachments,
          status: "pending",
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

      toast.success(`Gửi đơn "${getRequestKindLabel(appRequestKind)}" thành công!`);
      setIsAppFormOpen(false);
      setAppFile(null);
      setAppFiles([]);
      setAppEmployeeId(userProfile?.uid || "");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Gửi đơn thất bại.");
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleApproveApp = async (app: any) => {
    const appId = app._id || app.id;
    try {
      const res = await fetch(`/api/v1/crud/hr-leave-applications/${appId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          status: "approved",
          approvalType: "justified",
          approvedBy: userProfile?.uid,
        }),
      });
      if (!res.ok) throw new Error("Lỗi phê duyệt đơn.");
      toast.success("Đã duyệt đơn thành công!");
      fetchApplications();
      onApproved?.();
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
          approvedBy: userProfile?.uid,
        }),
      });
      if (!res.ok) throw new Error("Lỗi từ chối đơn.");
      toast.success("Đã từ chối đơn.");
      setAppRejectModalOpen(false);
      setSelectedAppId(null);
      setRejectReasonText("");
      fetchApplications();
      onApproved?.();
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

  const getAppTypeLabel = (type: string) => {
    switch (type) {
      case "leave": return "Nghỉ phép";
      case "late": return "Đi trễ";
      case "early": return "Về sớm";
      case "other": return "Đơn khác";
      default: return type;
    }
  };

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

  const filteredApplications = applications.filter((app) => {
    const matchType = !filterAppType || app.type === filterAppType;
    const matchKind = !filterRequestKind || (app.requestKind || "leave") === filterRequestKind;
    if (!filterSearchQuery.trim()) return matchType && matchKind;

    const query = filterSearchQuery.toLowerCase();
    const matchSearch =
      (app.employeeName || "").toLowerCase().includes(query) ||
      getAppTypeLabel(app.type).toLowerCase().includes(query) ||
      getRequestKindLabel(app.requestKind).toLowerCase().includes(query) ||
      (app.reason || "").toLowerCase().includes(query) ||
      (app.note || "").toLowerCase().includes(query) ||
      (app.rejectReason || "").toLowerCase().includes(query);

    return matchType && matchKind && matchSearch;
  });

  const selectedTemplate = templates.find((t) => t.name === appType);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-100/80 shadow-md shadow-slate-100/50">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-wide uppercase">
            Quản lý Đơn từ &amp; Phép
          </h2>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
            Tải biểu mẫu mẫu, nộp đơn kèm minh chứng và theo dõi trạng thái duyệt
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
            onClick={openAppForm}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer border-0 shadow-3xs"
          >
            <Send className="h-4 w-4" />
            Nộp đơn
          </button>
          {isLeaveAdmin && (
            <button
              onClick={() => setIsTemplateFormOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-bold transition cursor-pointer border-0 shadow-3xs"
            >
              <Upload className="h-4 w-4" />
              Đăng biểu mẫu mới
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            {isLeaveAdmin ? "Danh sách Đơn của nhân sự" : "Đơn từ đã nộp của bạn"}
          </h3>
          {isLeaveAdmin && (
            <div className="flex flex-wrap gap-2.5 items-center">
              <input
                type="text"
                placeholder="Tìm nhân viên, lý do, loại đơn..."
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
                className="px-3 py-1 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:border-indigo-500 outline-none w-48 sm:w-64 placeholder:text-slate-400 transition-all"
              />
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
                    <option key={tpl._id || tpl.id} value={tpl.name}>{tpl.name}</option>
                  ))}
                  <option value="other">Đơn khác</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Yêu cầu:
                </span>
                <select
                  value={filterRequestKind}
                  onChange={(e) => setFilterRequestKind(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">Tất cả</option>
                  {REQUEST_KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {useCardLayout ? (
          <div className="flex flex-col gap-3 p-4 bg-slate-50/50">
            {isAppLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Đang tải danh sách đơn từ...</span>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 font-medium text-xs">
                {applications.length === 0
                  ? "Chưa có đơn từ nào được đăng ký."
                  : "Không tìm thấy đơn từ nào khớp với bộ lọc."}
              </div>
            ) : (
              filteredApplications.map((app) => {
                const showDelete = app.status === "pending" || isLeaveAdmin;
                return (
                  <div
                    key={app._id || app.id}
                    className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs flex flex-col gap-3.5 text-left"
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2.5">
                      <div className="flex flex-col gap-1">
                        {isLeaveAdmin && (
                          <span className="font-extrabold text-xs text-slate-800 tracking-wide">
                            {app.employeeName}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-bold">
                          Loại: <span className="text-slate-800 font-extrabold">{getAppTypeLabel(app.type)}</span>
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider shrink-0 ${
                          REQUEST_KIND_BADGE[(app.requestKind as RequestKind) || "leave"] || REQUEST_KIND_BADGE.leave
                        }`}
                      >
                        {getRequestKindLabel(app.requestKind)}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-col gap-2 text-xs text-slate-650 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Thời gian</span>
                        <span className="font-mono text-[10px] text-slate-700 bg-slate-50 border border-slate-200/50 rounded-lg px-2.5 py-1 w-fit">
                          {new Date(app.startDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                          {` -> `}
                          {new Date(app.endDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>

                      {app.reason && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Lý do</span>
                          <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">{app.reason}</p>
                        </div>
                      )}

                      {app.uploadedFileUrl ? (
                        <div className="pt-1">
                          <a
                            href={getFileDownloadUrl(app.uploadedFileUrl, app.uploadedFileName)}
                            download={app.uploadedFileName}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-250 bg-emerald-50 text-emerald-800 hover:bg-emerald-105 font-bold transition-all shadow-3xs"
                            title={`Tải xuống: ${app.uploadedFileName}`}
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Minh chứng đính kèm</span>
                          </a>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Không có tệp đính kèm</span>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">Trạng thái:</span>
                          {getStatusBadge(app.status, app.rejectReason)}
                        </div>

                        {/* Thao tác */}
                        <div className="flex items-center gap-1.5">
                          {isLeaveAdmin && app.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApproveApp(app)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition cursor-pointer border-0"
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
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer border-0"
                                title="Từ chối"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {showDelete && (
                            <button
                              onClick={() => handleDeleteApp(app._id || app.id)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer border-0 bg-transparent"
                              title="Xóa đơn"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {(app.note || app.rejectReason) && (
                        <div className="rounded-xl bg-slate-50 border border-slate-150 p-2.5 text-[10px] text-slate-600 font-semibold leading-relaxed">
                          <span className="font-extrabold uppercase text-slate-450 tracking-wide block mb-0.5">Phản hồi của Admin:</span>
                          {app.note || app.rejectReason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[760px] text-left text-xs text-slate-700 sm:min-w-[1100px]">
              <thead className="bg-slate-50 border-b border-slate-100 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider">
                <tr>
                  {isLeaveAdmin && <th className="px-5 py-4 min-w-[120px]">Nhân sự</th>}
                  <th className="px-5 py-4 min-w-[110px]">Yêu cầu</th>
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
                    <td colSpan={isLeaveAdmin ? 9 : 7} className="px-5 py-12 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        Đang tải danh sách đơn từ...
                      </div>
                    </td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={isLeaveAdmin ? 9 : 7} className="px-5 py-12 text-center text-slate-400 font-medium">
                      {applications.length === 0
                        ? "Chưa có đơn từ nào được đăng ký."
                        : "Không tìm thấy đơn từ nào khớp với bộ lọc."}
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
                          <span
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${
                              REQUEST_KIND_BADGE[(app.requestKind as RequestKind) || "leave"] || REQUEST_KIND_BADGE.leave
                            }`}
                          >
                            {getRequestKindLabel(app.requestKind)}
                          </span>
                        </td>
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
                              <Download className="h-3.5 w-3.5 text-emerald-600" />
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
        )}
      </div>

      {/* Modal nộp đơn */}
      {isAppFormOpen && createPortal(
        <div
          data-testid="leave-request-submit-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-y-auto animate-in fade-in zoom-in duration-200 max-h-[90dvh] overscroll-contain">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">Nộp đơn từ</h3>
              <button
                onClick={() => setIsAppFormOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateApplicationSubmit}>
              <div className="p-6 flex flex-col gap-4">
                {leaveBalance && (
                  <div className="grid grid-cols-4 gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                    <div><div className="text-[10px] text-slate-500">Hạn mức</div><div className="font-black text-emerald-700">{leaveBalance.entitlement}</div></div>
                    <div><div className="text-[10px] text-slate-500">Đã dùng</div><div className="font-black text-slate-700">{leaveBalance.used}</div></div>
                    <div><div className="text-[10px] text-slate-500">Chờ duyệt</div><div className="font-black text-amber-600">{leaveBalance.pending}</div></div>
                    <div><div className="text-[10px] text-slate-500">Còn lại</div><div className="font-black text-cyan-700">{leaveBalance.remaining}</div></div>
                  </div>
                )}

                {isLeaveAdmin && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Nhân sự</label>
                    <select
                      value={appEmployeeId}
                      onChange={(e) => {
                        setAppEmployeeId(e.target.value);
                        fetchLeaveBalance(e.target.value, Number(appStartDate.slice(0, 4)));
                      }}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      {usersList.map((u) => (
                        <option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Loại yêu cầu</label>
                  <select
                    value={appRequestKind}
                    onChange={(e) => setAppRequestKind(e.target.value as RequestKind)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {REQUEST_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[10px] text-slate-400 font-semibold">
                    Chỉ đơn &quot;Nghỉ phép&quot; mới trừ vào số ngày phép năm.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Biểu mẫu</label>
                  <select
                    value={appType}
                    onChange={(e) => {
                      setAppType(e.target.value);
                      const tpl = templates.find((t) => t.name === e.target.value);
                      if (tpl?.requestKind) setAppRequestKind(tpl.requestKind as RequestKind);
                    }}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl._id || tpl.id} value={tpl.name}>{tpl.name}</option>
                    ))}
                    <option value="other">Đơn khác</option>
                  </select>
                  {selectedTemplate?.fileUrl && (
                    <a
                      href={getFileDownloadUrl(selectedTemplate.fileUrl, selectedTemplate.fileName)}
                      download={selectedTemplate.fileName}
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-800"
                    >
                      <Download className="h-3 w-3" />
                      Tải mẫu &quot;{selectedTemplate.name}&quot; để điền trước khi nộp
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Từ ngày</label>
                    <input type="date" required value={appStartDate} onChange={(e) => setAppStartDate(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Đến ngày</label>
                    <input type="date" required value={appEndDate} onChange={(e) => setAppEndDate(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    Đơn đã điền / minh chứng (có thể chọn nhiều tệp)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.xls,.xlsx,.mp4,.mov,.webm"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAppFiles(files);
                      setAppFile(files[0] || null);
                    }}
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
        </div>,
        document.body
      )}

      {/* Modal Danh sách Biểu mẫu mẫu */}
      {isTemplateListModalOpen && createPortal((() => {
        const tplPageSize = 5;
        const totalTplPages = Math.ceil(templates.length / tplPageSize) || 1;
        const activePage = Math.min(tplCurrentPage, totalTplPages);
        const currentTemplates = templates.slice((activePage - 1) * tplPageSize, activePage * tplPageSize);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-y-auto animate-in fade-in zoom-in duration-200 text-left max-h-[90dvh] overscroll-contain">
              <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-indigo-600" />
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
                        <div key={tpl._id || tpl.id} className="flex items-center justify-between p-3.5 hover:bg-slate-100/50 transition-colors gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-xs truncate" title={tpl.name}>{tpl.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate" title={tpl.fileName}>{tpl.fileName}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={getFileDownloadUrl(tpl.fileUrl, tpl.fileName)}
                              download={tpl.fileName}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-bold transition-all border border-indigo-200 cursor-pointer shadow-3xs"
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
                            onClick={() => setTplCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={activePage === 1}
                            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer text-slate-650 flex items-center justify-center bg-white"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTplCurrentPage((prev) => Math.min(prev + 1, totalTplPages))}
                            disabled={activePage === totalTplPages}
                            className="p-1.5 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer text-slate-650 flex items-center justify-center bg-white"
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
                  className="px-4.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer border-0"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* Modal Tải Biểu Mẫu Mẫu (Admin/Manager) */}
      {isTemplateFormOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-y-auto animate-in fade-in zoom-in duration-200 max-h-[90dvh] overscroll-contain">
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
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Tên biểu mẫu</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Đơn xin nghỉ phép năm, Đơn xin làm online..."
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Dùng cho loại yêu cầu</label>
                  <select
                    value={tplRequestKind}
                    onChange={(e) => setTplRequestKind(e.target.value as RequestKind)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {REQUEST_KIND_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[10px] text-slate-400 font-semibold">
                    Nhân viên chọn biểu mẫu này khi nộp đơn sẽ tự được gán loại yêu cầu tương ứng.
                  </p>
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
        </div>,
        document.body
      )}

      {/* Modal Lý do Từ chối đơn */}
      {appRejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-y-auto animate-in fade-in zoom-in duration-200 max-h-[90dvh] overscroll-contain">
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
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Lý do từ chối đơn</label>
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

      {confirmState && createPortal(
        <div className="fixed inset-0 z-[100]">
          <ConfirmDialog
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            description={confirmState.description}
            confirmLabel={confirmState.confirmLabel}
            cancelLabel={confirmState.cancelLabel}
            onConfirm={confirmState.onConfirm}
            onClose={() => setConfirmState(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
