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
import { StyledSelect } from "../common/StyledSelect";
import { DateInput24 } from "../common/TimeInput24";

/** Bốn loại yêu cầu nhân sự có thể xin qua đơn từ. Khớp với enum requestKind ở server. */
export type RequestKind = "event" | "leave" | "wfh" | "exception";

export const REQUEST_KIND_OPTIONS: { value: RequestKind; label: string }[] = [
  { value: "event", label: "Tạo sự kiện" },
  { value: "leave", label: "Nghỉ phép" },
  { value: "wfh", label: "Làm tại nhà" },
  { value: "exception", label: "Ngoại lệ" },
];

const REQUEST_KIND_BADGE: Record<RequestKind, string> = {
  event: "bg-[#e8f7ff] text-[#007eb8]",
  leave: "bg-[#e8f7ff] text-[#007eb8]",
  wfh: "bg-[#eafaf7] text-teal-700",
  exception: "bg-[#f1f8fd] text-slate-600",
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
        return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-normal text-emerald-700">Đã duyệt</span>;
      case "rejected":
        return (
          <span
            className="inline-flex cursor-help rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-normal text-rose-700"
            title={rejectReason ? `Lý do từ chối: ${rejectReason}` : "Bị từ chối"}
          >
          Từ chối
          </span>
        );
      default:
        return <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-normal text-amber-700">Chờ duyệt</span>;
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
    <div className="space-y-4 animate-fade-in text-left">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dce7f4] bg-white px-5 py-4">
        <div>
          <h2 className="text-base font-normal text-slate-800">
            Đơn từ &amp; phép
          </h2>
          <p className="mt-0.5 text-xs font-normal text-slate-500">
            Nộp đơn và theo dõi trạng thái
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setTplCurrentPage(1);
              setIsTemplateListModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-[#dce7f4] bg-white px-3.5 py-2 text-sm font-normal text-[#007eb8] transition-colors hover:bg-[#f0faff] cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            Biểu mẫu
          </button>
          <button
            onClick={openAppForm}
            className="flex items-center gap-1.5 rounded-xl bg-[#00adfc] px-3.5 py-2 text-sm font-normal text-white transition-colors hover:bg-[#0097df] cursor-pointer"
          >
            <Send className="h-4 w-4" />
            Nộp đơn
          </button>
          {isLeaveAdmin && (
            <button
              onClick={() => setIsTemplateFormOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#bceaff] bg-[#e8f7ff] px-3.5 py-2 text-sm font-normal text-[#007eb8] transition-colors hover:bg-[#d7f1ff] cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Thêm biểu mẫu
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#dce7f4] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e5eef8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-normal text-slate-800">
            {isLeaveAdmin ? "Danh sách Đơn của nhân sự" : "Đơn từ đã nộp của bạn"}
          </h3>
          {isLeaveAdmin && (
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                placeholder="Tìm nhân viên, lý do, loại đơn..."
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
                className="h-10 w-48 rounded-xl border border-[#dce7f4] bg-white px-3 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10 sm:w-64"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-normal text-slate-500">
                  Loại đơn:
                </span>
                <div className="w-36">
                  <StyledSelect value={filterAppType} onChange={setFilterAppType} ariaLabel="Lọc loại đơn" options={[{ value: "", label: "Tất cả" }, ...templates.map((tpl) => ({ value: tpl.name, label: tpl.name })), { value: "other", label: "Đơn khác" }]} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-normal text-slate-500">
                  Yêu cầu:
                </span>
                <div className="w-36">
                  <StyledSelect value={filterRequestKind} onChange={setFilterRequestKind} ariaLabel="Lọc yêu cầu" options={[{ value: "", label: "Tất cả" }, ...REQUEST_KIND_OPTIONS]} />
                </div>
              </div>
            </div>
          )}
        </div>

        {useCardLayout ? (
          <div className="flex flex-col gap-3 bg-[#f8fbff] p-4">
            {isAppLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00adfc] border-t-transparent" />
                <span className="text-xs">Đang tải danh sách đơn từ...</span>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm font-normal text-slate-500">
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
                    className="flex flex-col gap-3.5 rounded-2xl border border-[#dce7f4] bg-white p-4 text-left"
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2.5">
                      <div className="flex flex-col gap-1">
                        {isLeaveAdmin && (
                          <span className="text-sm font-normal text-slate-800">
                            {app.employeeName}
                          </span>
                        )}
                        <span className="text-xs font-normal text-slate-500">
                          Loại: <span className="text-slate-800">{getAppTypeLabel(app.type)}</span>
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-normal ${
                          REQUEST_KIND_BADGE[(app.requestKind as RequestKind) || "leave"] || REQUEST_KIND_BADGE.leave
                        }`}
                      >
                        {getRequestKindLabel(app.requestKind)}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-col gap-2 text-xs font-normal text-slate-600">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-normal text-slate-500">Thời gian</span>
                        <span className="w-fit rounded-lg bg-[#f1f8fd] px-2.5 py-1 text-xs text-slate-700">
                          {new Date(app.startDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                          {` -> `}
                          {new Date(app.endDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>

                      {app.reason && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-normal text-slate-500">Lý do</span>
                          <p className="text-xs font-normal leading-relaxed text-slate-700">{app.reason}</p>
                        </div>
                      )}

                      {app.uploadedFileUrl ? (
                        <div className="pt-1">
                          <a
                            href={getFileDownloadUrl(app.uploadedFileUrl, app.uploadedFileName)}
                            download={app.uploadedFileName}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#bceaff] bg-[#f0faff] px-3 py-1.5 font-normal text-[#007eb8] transition-colors hover:bg-[#e8f7ff]"
                            title={`Tải xuống: ${app.uploadedFileName}`}
                          >
                            <Download className="h-3.5 w-3.5" />
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
                          <span className="text-xs font-normal text-slate-500">Trạng thái:</span>
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
                        <div className="rounded-xl bg-[#f1f8fd] p-2.5 text-xs font-normal leading-relaxed text-slate-600">
                          <span className="mb-0.5 block text-slate-500">Phản hồi:</span>
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
              <thead className="border-b border-[#dce7f4] bg-[#e8f7ff] text-xs font-normal text-[#007eb8]">
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
              <tbody className="divide-y divide-[#e5eef8] font-normal text-slate-700">
                {isAppLoading ? (
                  <tr>
                    <td colSpan={isLeaveAdmin ? 9 : 7} className="px-5 py-12 text-center text-slate-400">
                      <div className="flex justify-center items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00adfc] border-t-transparent" />
                        Đang tải danh sách đơn từ...
                      </div>
                    </td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={isLeaveAdmin ? 9 : 7} className="px-5 py-12 text-center font-normal text-slate-500">
                      {applications.length === 0
                        ? "Chưa có đơn từ nào được đăng ký."
                        : "Không tìm thấy đơn từ nào khớp với bộ lọc."}
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => {
                    const showDelete = app.status === "pending" || isLeaveAdmin;
                    return (
                      <tr key={app._id || app.id} className="transition-colors hover:bg-[#f0faff]">
                        {isLeaveAdmin && (
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-normal text-slate-800">{app.employeeName}</div>
                          </td>
                        )}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`rounded-lg px-2 py-0.5 text-xs font-normal ${
                              REQUEST_KIND_BADGE[(app.requestKind as RequestKind) || "leave"] || REQUEST_KIND_BADGE.leave
                            }`}
                          >
                            {getRequestKindLabel(app.requestKind)}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-normal text-slate-800">{getAppTypeLabel(app.type)}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                          <div>{new Date(app.startDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
                          <div>đến {new Date(app.endDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
                        </td>
                        <td className="px-5 py-4 min-w-[200px] max-w-[350px] whitespace-normal leading-relaxed text-slate-600 font-normal" title={app.reason} style={{ wordBreak: "break-all" }}>
                          {app.reason}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {app.uploadedFileUrl ? (
                            <a
                              href={getFileDownloadUrl(app.uploadedFileUrl, app.uploadedFileName)}
                              download={app.uploadedFileName}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[#bceaff] bg-[#f0faff] px-3 py-1.5 font-normal text-[#007eb8] transition-colors hover:bg-[#e8f7ff]"
                              title={`Tải xuống: ${app.uploadedFileName}`}
                            >
                              <Download className="h-3.5 w-3.5" />
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[#dce7f4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5eef8] bg-[#f8fbff] px-5 py-4">
              <h3 className="text-base font-normal text-slate-800">Nộp đơn</h3>
              <button
                onClick={() => setIsAppFormOpen(false)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateApplicationSubmit}>
              <div className="flex flex-col gap-4 p-5">
                {leaveBalance && (
                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-[#f0faff] p-3 text-center">
                    <div><div className="text-[10px] text-slate-500">Hạn mức</div><div className="font-normal text-[#007eb8]">{leaveBalance.entitlement}</div></div>
                    <div><div className="text-[10px] text-slate-500">Đã dùng</div><div className="font-normal text-slate-700">{leaveBalance.used}</div></div>
                    <div><div className="text-[10px] text-slate-500">Chờ duyệt</div><div className="font-normal text-amber-600">{leaveBalance.pending}</div></div>
                    <div><div className="text-[10px] text-slate-500">Còn lại</div><div className="font-normal text-emerald-700">{leaveBalance.remaining}</div></div>
                  </div>
                )}

                {isLeaveAdmin && (
                  <div>
                    <label className="mb-1.5 block text-sm font-normal text-slate-700">Nhân sự</label>
                    <StyledSelect value={appEmployeeId} onChange={(value) => { setAppEmployeeId(value); fetchLeaveBalance(value, Number(appStartDate.slice(0, 4))); }} ariaLabel="Chọn nhân sự" options={usersList.map((u) => ({ value: u.uid, label: u.displayName || u.email }))} />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">Loại yêu cầu</label>
                  <StyledSelect value={appRequestKind} onChange={(value) => setAppRequestKind(value as RequestKind)} ariaLabel="Loại yêu cầu" options={REQUEST_KIND_OPTIONS} />
                  <p className="mt-1.5 text-xs font-normal text-slate-500">
                    Chỉ đơn &quot;Nghỉ phép&quot; mới trừ vào số ngày phép năm.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">Biểu mẫu</label>
                  <StyledSelect value={appType} onChange={(value) => { setAppType(value); const tpl = templates.find((t) => t.name === value); if (tpl?.requestKind) setAppRequestKind(tpl.requestKind as RequestKind); }} ariaLabel="Chọn biểu mẫu" options={[...templates.map((tpl) => ({ value: tpl.name, label: tpl.name })), { value: "other", label: "Đơn khác" }]} />
                  {selectedTemplate?.fileUrl && (
                    <a
                      href={getFileDownloadUrl(selectedTemplate.fileUrl, selectedTemplate.fileName)}
                      download={selectedTemplate.fileName}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-normal text-[#007eb8] hover:text-[#009fdf]"
                    >
                      <Download className="h-3 w-3" />
                      Tải mẫu &quot;{selectedTemplate.name}&quot; để điền trước khi nộp
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-normal text-slate-700">Từ ngày</label>
                    <DateInput24 required value={appStartDate} onChange={setAppStartDate} ariaLabel="Từ ngày" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-normal text-slate-700">Đến ngày</label>
                    <DateInput24 required value={appEndDate} onChange={setAppEndDate} ariaLabel="Đến ngày" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">
                    Đơn / minh chứng
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
                    className="w-full text-xs font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f7ff] file:px-3 file:py-2 file:text-xs file:font-normal file:text-[#007eb8] hover:file:bg-[#d7f1ff] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-[#e5eef8] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsAppFormOpen(false)}
                  className="rounded-xl border border-[#dce7f4] px-4 py-2 text-sm font-normal text-slate-700 transition-colors hover:bg-[#f8fbff] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isFileUploading}
                  className="rounded-xl bg-[#00adfc] px-5 py-2 text-sm font-normal text-white transition-colors hover:bg-[#0097df] cursor-pointer disabled:opacity-50"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
            <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-[#dce7f4] bg-white text-left shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#e5eef8] bg-[#f8fbff] px-5 py-4">
                <h3 className="flex items-center gap-2 text-base font-normal text-slate-800">
                  <FileText className="h-4 w-4 text-[#009fdf]" />
                  Biểu mẫu
                </h3>
                <button
                  onClick={() => setIsTemplateListModalOpen(false)}
                  aria-label="Đóng"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
                {isTemplateLoading && (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00adfc] border-t-transparent" />
                  </div>
                )}

                {!isTemplateLoading && templates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">
                    Chưa có biểu mẫu mẫu nào được đăng ký.
                  </p>
                ) : (
                  <>
                    <div className="divide-y divide-[#e5eef8] overflow-hidden rounded-xl border border-[#dce7f4] bg-white">
                      {currentTemplates.map((tpl) => (
                        <div key={tpl._id || tpl.id} className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-[#f0faff]">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="rounded-xl bg-[#e8f7ff] p-2 text-[#009fdf]">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-normal text-slate-800" title={tpl.name}>{tpl.name}</p>
                              <p className="truncate text-xs font-normal text-slate-500" title={tpl.fileName}>{tpl.fileName}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={getFileDownloadUrl(tpl.fileUrl, tpl.fileName)}
                              download={tpl.fileName}
                              className="flex items-center gap-1 rounded-xl border border-[#bceaff] bg-[#f0faff] px-3 py-1.5 text-xs font-normal text-[#007eb8] transition-colors hover:bg-[#e8f7ff] cursor-pointer"
                              title="Tải biểu mẫu"
                            >
                              <Download className="h-3 w-3" />
                              Tải mẫu
                            </a>
                            {isLeaveAdmin && (
                              <button
                                onClick={() => handleDeleteTpl(tpl._id || tpl.id)}
                                className="flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-normal text-rose-700 transition-colors hover:bg-rose-100 cursor-pointer"
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
                        <span className="text-xs font-normal text-slate-500">
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

              <div className="flex justify-end border-t border-[#e5eef8] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsTemplateListModalOpen(false)}
                  className="rounded-xl border border-[#dce7f4] px-4 py-2 text-sm font-normal text-slate-700 transition-colors hover:bg-[#f8fbff] cursor-pointer"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[#dce7f4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5eef8] bg-[#f8fbff] px-5 py-4">
              <h3 className="text-base font-normal text-slate-800">Thêm biểu mẫu</h3>
              <button
                onClick={() => setIsTemplateFormOpen(false)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadTemplateSubmit}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">Tên biểu mẫu</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Đơn xin nghỉ phép năm, Đơn xin làm online..."
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    className="w-full rounded-xl border border-[#dce7f4] px-3.5 py-2.5 text-sm font-normal outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">Loại yêu cầu</label>
                  <StyledSelect value={tplRequestKind} onChange={(value) => setTplRequestKind(value as RequestKind)} ariaLabel="Loại yêu cầu của biểu mẫu" options={REQUEST_KIND_OPTIONS} />
                  <p className="mt-1.5 text-xs font-normal text-slate-500">
                    Nhân viên chọn biểu mẫu này khi nộp đơn sẽ tự được gán loại yêu cầu tương ứng.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">
                    Tệp biểu mẫu
                  </label>
                  <input
                    type="file"
                    required
                    accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.xls,.xlsx"
                    onChange={(e) => setTplFile(e.target.files?.[0] || null)}
                    className="w-full text-xs font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f7ff] file:px-3 file:py-2 file:text-xs file:font-normal file:text-[#007eb8] hover:file:bg-[#d7f1ff] cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-[#e5eef8] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setIsTemplateFormOpen(false)}
                  className="rounded-xl border border-[#dce7f4] px-4 py-2 text-sm font-normal text-slate-700 transition-colors hover:bg-[#f8fbff] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isFileUploading}
                  className="rounded-xl bg-[#00adfc] px-5 py-2 text-sm font-normal text-white transition-colors hover:bg-[#0097df] cursor-pointer disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[#dce7f4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5eef8] bg-[#f8fbff] px-5 py-4">
              <h3 className="text-base font-normal text-slate-800">Từ chối đơn</h3>
              <button
                onClick={() => setAppRejectModalOpen(false)}
                aria-label="Đóng"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRejectAppSubmit}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-normal text-slate-700">Lý do từ chối</label>
                  <textarea
                    required
                    placeholder="Nhập lý do chi tiết để phản hồi nhân viên..."
                    value={rejectReasonText}
                    onChange={(e) => setRejectReasonText(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[#dce7f4] px-3.5 py-2.5 text-sm font-normal outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-[#00adfc]/10"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-[#e5eef8] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setAppRejectModalOpen(false)}
                  className="rounded-xl border border-[#dce7f4] px-4 py-2 text-sm font-normal text-slate-700 transition-colors hover:bg-[#f8fbff] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-500 px-5 py-2 text-sm font-normal text-white transition-colors hover:bg-rose-600 cursor-pointer"
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
