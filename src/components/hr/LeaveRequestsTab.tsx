import React, { useState, useEffect } from "react";
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

interface LeaveRequestsTabProps {
  userProfile: UserProfile | null;
  selectedCompanyCode: string;
  /** True when the user can upload templates and approve/reject other people's requests. */
  canApprove?: boolean;
  usersList: UserProfile[];
  employees?: EmployeeNode[];
}

export default function LeaveRequestsTab({
  userProfile,
  selectedCompanyCode,
  canApprove = false,
  usersList = [],
}: LeaveRequestsTabProps) {
  const isLeaveAdmin = canApprove;

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
    confirmLabel = "X�c nh?n",
    cancelLabel = "H?y"
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
    return `/api/v1/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename || "don-xin-phep")}`;
  };

  const uploadFileToCloudinary = async (file: File): Promise<string> => {
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
      body: JSON.stringify({ file: fileBase64, folder: "hr_leaves" }),
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      let details = "";
      if (errorJson.errors) {
        details = Object.entries(errorJson.errors)
          .map(([key, msgs]: any) => `${key}: ${msgs.join(", ")}`)
          .join("; ");
      }
      throw new Error((errorJson.message || "L?i t?i t?p l�n m�y ch?.") + (details ? ` [${details}]` : ""));
    }

    const json = await res.json();
    return json.url;
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
      console.error("Kh�ng th? t?i s? du ph�p", error);
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
      toast.error("Vui l�ng nh?p t�n bi?u m?u.");
      return;
    }
    if (!tplFile) {
      toast.error("Vui l�ng ch?n t?p bi?u m?u.");
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
          uploadedBy: userProfile?.uid || "unknown",
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
        throw new Error((errorData.message || "L?i luu bi?u m?u.") + (details ? ` [${details}]` : ""));
      }

      toast.success("T?i l�n bi?u m?u m?u th�nh c�ng!");
      setIsTemplateFormOpen(false);
      setTplName("");
      setTplFile(null);
      fetchTemplates();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "T?i l�n bi?u m?u m?u th?t b?i.");
    } finally {
      setIsFileUploading(false);
    }
  };

  const openAppForm = () => {
    setAppType(templates.length > 0 ? templates[0].name : "other");
    // Nh�n vi�n thu?ng lu�n n?p don cho ch�nh m�nh; c?p duy?t c� th? d?i ? form.
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
      toast.error("Vui l�ng ch?n d?y d? ng�y ngh?.");
      return;
    }
    if (appFiles.length === 0) {
      toast.error("Vui l�ng t?i l�n �t nh?t m?t minh ch?ng.");
      return;
    }
    const startDateTime = new Date(`${appStartDate}T00:00:00`);
    const endDateTime = new Date(`${appEndDate}T23:59:59`);
    if (endDateTime < startDateTime) {
      toast.error("Th?i gian k?t th�c ph?i l?n hon ho?c b?ng th?i gian b?t d?u.");
      return;
    }

    setIsFileUploading(true);
    try {
      const attachments = await Promise.all(
        appFiles.map(async (file) => ({
          url: await uploadFileToCloudinary(file),
          name: file.name,
          mimeType: file.type,
          size: file.size,
        }))
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
          employeeName: targetEmp?.displayName || userProfile?.displayName || "Nh�n vi�n",
          type: appType,
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          reason: "�ang k� ngh? ph�p",
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
        throw new Error((errorData.message || "L?i luu don xin ngh?.") + (details ? ` [${details}]` : ""));
      }

      toast.success("G?i don xin ngh? ph�p th�nh c�ng!");
      setIsAppFormOpen(false);
      setAppFile(null);
      setAppFiles([]);
      setAppEmployeeId(userProfile?.uid || "");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "G?i don th?t b?i.");
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
      if (!res.ok) throw new Error("L?i ph� duy?t don.");
      toast.success("�� duy?t don th�nh c�ng!");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast.error("Ph� duy?t don th?t b?i.");
    }
  };

  const handleRejectAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReasonText.trim()) {
      toast.error("Vui l�ng nh?p l� do t? ch?i.");
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
      if (!res.ok) throw new Error("L?i t? ch?i don.");
      toast.success("�� t? ch?i don.");
      setAppRejectModalOpen(false);
      setSelectedAppId(null);
      setRejectReasonText("");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast.error("T? ch?i don th?t b?i.");
    }
  };

  const handleDeleteApp = async (appId: string) => {
    askConfirm(
      "X�a don xin ngh?",
      "B?n c� ch?c ch?n mu?n x�a don xin ngh? n�y kh�ng? H�nh d?ng n�y kh�ng th? ho�n t�c.",
      async () => {
        try {
          const res = await fetch(`/api/v1/crud/hr-leave-applications/${appId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          });
          if (!res.ok) throw new Error("L?i khi x�a don.");
          toast.success("�� x�a don th�nh c�ng.");
          fetchApplications();
        } catch (err: any) {
          console.error(err);
          toast.error("X�a don th?t b?i.");
        }
      },
      "X�a"
    );
  };

  const handleDeleteTpl = async (tplId: string) => {
    askConfirm(
      "X�a bi?u m?u",
      "B?n c� ch?c ch?n mu?n x�a bi?u m?u m?u n�y kh�ng? H�nh d?ng n�y kh�ng th? ho�n t�c.",
      async () => {
        try {
          const res = await fetch(`/api/v1/crud/hr-leave-templates/${tplId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          });
          if (!res.ok) throw new Error("L?i khi x�a bi?u m?u.");
          toast.success("�� x�a bi?u m?u th�nh c�ng.");
          fetchTemplates();
        } catch (err: any) {
          console.error(err);
          toast.error("X�a bi?u m?u th?t b?i.");
        }
      },
      "X�a"
    );
  };

  const getAppTypeLabel = (type: string) => {
    switch (type) {
      case "leave": return "Ngh? ph�p";
      case "late": return "�i tr?";
      case "early": return "V? s?m";
      case "other": return "�on kh�c";
      default: return type;
    }
  };

  const getStatusBadge = (status: string, rejectReason?: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-100">�� duy?t</span>;
      case "rejected":
        return (
          <span
            className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-100 cursor-help"
            title={rejectReason ? `L� do t? ch?i: ${rejectReason}` : "B? t? ch?i"}
          >
            T? ch?i (?)
          </span>
        );
      default:
        return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-100 animate-pulse">Ch? duy?t</span>;
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchType = !filterAppType || app.type === filterAppType;
    if (!filterSearchQuery.trim()) return matchType;

    const query = filterSearchQuery.toLowerCase();
    const matchSearch =
      (app.employeeName || "").toLowerCase().includes(query) ||
      getAppTypeLabel(app.type).toLowerCase().includes(query) ||
      (app.reason || "").toLowerCase().includes(query) ||
      (app.note || "").toLowerCase().includes(query) ||
      (app.rejectReason || "").toLowerCase().includes(query);

    return matchType && matchSearch;
  });

  const selectedTemplate = templates.find((t) => t.name === appType);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-slate-100/80 shadow-md shadow-slate-100/50">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-wide uppercase">
            Qu?n l� �on t? &amp; Ph�p
          </h2>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
            T?i bi?u m?u m?u, n?p don k�m minh ch?ng v� theo d�i tr?ng th�i duy?t
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
            Bi?u m?u m?u
          </button>
          <button
            onClick={openAppForm}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer border-0 shadow-3xs"
          >
            <Send className="h-4 w-4" />
            N?p don
          </button>
          {isLeaveAdmin && (
            <button
              onClick={() => setIsTemplateFormOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-bold transition cursor-pointer border-0 shadow-3xs"
            >
              <Upload className="h-4 w-4" />
              �ang bi?u m?u m?i
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            {isLeaveAdmin ? "Danh s�ch �on c?a nh�n s?" : "�on t? d� n?p c?a b?n"}
          </h3>
          {isLeaveAdmin && (
            <div className="flex flex-wrap gap-2.5 items-center">
              <input
                type="text"
                placeholder="T�m nh�n vi�n, l� do, lo?i don..."
                value={filterSearchQuery}
                onChange={(e) => setFilterSearchQuery(e.target.value)}
                className="px-3 py-1 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:border-indigo-500 outline-none w-48 sm:w-64 placeholder:text-slate-400 transition-all"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                  Lo?i don:
                </span>
                <select
                  value={filterAppType}
                  onChange={(e) => setFilterAppType(e.target.value)}
                  className="px-2.5 py-1 border border-slate-200 bg-white rounded-xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">T?t c?</option>
                  {templates.map((tpl) => (
                    <option key={tpl._id || tpl.id} value={tpl.name}>{tpl.name}</option>
                  ))}
                  <option value="other">�on kh�c</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-100 font-extrabold uppercase text-[10px] text-slate-400 tracking-wider">
              <tr>
                {isLeaveAdmin && <th className="px-5 py-4 min-w-[120px]">Nh�n s?</th>}
                <th className="px-5 py-4 min-w-[100px]">Lo?i ph�p</th>
                <th className="px-5 py-4 min-w-[160px]">Th?i gian</th>
                <th className="px-5 py-4 min-w-[220px]">L� do</th>
                <th className="px-5 py-4 min-w-[150px]">�on d�nh k�m</th>
                {isLeaveAdmin ? (
                  <>
                    <th className="px-5 py-4 text-center min-w-[110px]">Tr?ng th�i</th>
                    <th className="px-5 py-4 min-w-[200px]">Ph?n h?i c?a Admin</th>
                    <th className="px-5 py-4 text-center min-w-[90px]">Thao t�c</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-4 min-w-[200px]">Ghi ch�</th>
                    <th className="px-5 py-4 text-center min-w-[110px]">Tr?ng th�i</th>
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
                      �ang t?i danh s�ch don t?...
                    </div>
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={isLeaveAdmin ? 8 : 6} className="px-5 py-12 text-center text-slate-400 font-medium">
                    {applications.length === 0
                      ? "Chua c� don t? n�o du?c dang k�."
                      : "Kh�ng t�m th?y don t? n�o kh?p v?i b? l?c."}
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
                        <div>d?n {new Date(app.endDate).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</div>
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
                            title={`T?i xu?ng: ${app.uploadedFileName}`}
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Xem don d�nh k�m</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Chua c� t?p</span>
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
                                    title="Duy?t don"
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
                                    title="T? ch?i"
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                              {showDelete && (
                                <button
                                  onClick={() => handleDeleteApp(app._id || app.id)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer border-0 bg-transparent"
                                  title="X�a don"
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

      {/* Modal n?p don */}
      {isAppFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">N?p don t?</h3>
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
                    <div><div className="text-[10px] text-slate-500">H?n m?c</div><div className="font-black text-emerald-700">{leaveBalance.entitlement}</div></div>
                    <div><div className="text-[10px] text-slate-500">�� d�ng</div><div className="font-black text-slate-700">{leaveBalance.used}</div></div>
                    <div><div className="text-[10px] text-slate-500">Ch? duy?t</div><div className="font-black text-amber-600">{leaveBalance.pending}</div></div>
                    <div><div className="text-[10px] text-slate-500">C�n l?i</div><div className="font-black text-cyan-700">{leaveBalance.remaining}</div></div>
                  </div>
                )}

                {isLeaveAdmin && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Nh�n s?</label>
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
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">Lo?i don</label>
                  <select
                    value={appType}
                    onChange={(e) => setAppType(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl._id || tpl.id} value={tpl.name}>{tpl.name}</option>
                    ))}
                    <option value="other">�on kh�c</option>
                  </select>
                  {selectedTemplate?.fileUrl && (
                    <a
                      href={getFileDownloadUrl(selectedTemplate.fileUrl, selectedTemplate.fileName)}
                      download={selectedTemplate.fileName}
                      className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-800"
                    >
                      <Download className="h-3 w-3" />
                      T?i m?u &quot;{selectedTemplate.name}&quot; d? di?n tru?c khi n?p
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">T? ng�y</label>
                    <input type="date" required value={appStartDate} onChange={(e) => setAppStartDate(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">�?n ng�y</label>
                    <input type="date" required value={appEndDate} onChange={(e) => setAppEndDate(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    �on d� di?n / minh ch?ng (c� th? ch?n nhi?u t?p)
                  </label>
                  <input
                    type="file"
                    multiple
                    required
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
                  H?y b?
                </button>
                <button
                  type="submit"
                  disabled={isFileUploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isFileUploading ? "�ang n?p don..." : "N?p don"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Danh s�ch Bi?u m?u m?u */}
      {isTemplateListModalOpen && (() => {
        const tplPageSize = 5;
        const totalTplPages = Math.ceil(templates.length / tplPageSize) || 1;
        const activePage = Math.min(tplCurrentPage, totalTplPages);
        const currentTemplates = templates.slice((activePage - 1) * tplPageSize, activePage * tplPageSize);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200 text-left">
              <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-indigo-600" />
                  Danh s�ch Bi?u m?u m?u
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
                    Chua c� bi?u m?u m?u n�o du?c dang k�.
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
                              title="T?i bi?u m?u"
                            >
                              <Download className="h-3 w-3" />
                              T?i m?u
                            </a>
                            {isLeaveAdmin && (
                              <button
                                onClick={() => handleDeleteTpl(tpl._id || tpl.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[10px] font-bold transition-all border border-rose-200 cursor-pointer shadow-3xs"
                                title="X�a bi?u m?u"
                              >
                                <Trash2 className="h-3 w-3" />
                                X�a
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
                  ��ng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal T?i Bi?u M?u M?u (Admin/Manager) */}
      {isTemplateFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">�ang t?i bi?u m?u m?u m?i</h3>
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
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">T�n bi?u m?u</label>
                  <input
                    type="text"
                    required
                    placeholder="V� d?: �on xin ngh? ph�p nam, �on xin l�m online..."
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-2xl text-xs font-semibold focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">
                    T?p t�i li?u m?u (Word/Excel/PDF...)
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
                  H?y b?
                </button>
                <button
                  type="submit"
                  disabled={isFileUploading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isFileUploading ? "�ang t?i l�n..." : "T?i l�n"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal L� do T? ch?i don */}
      {appRejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center bg-slate-50/50 border-b border-slate-100 px-6 py-4.5">
              <h3 className="font-extrabold text-slate-800 text-sm">T? ch?i duy?t don</h3>
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
                  <label className="block text-[10px] uppercase tracking-wide font-extrabold text-slate-500 mb-1.5">L� do t? ch?i don</label>
                  <textarea
                    required
                    placeholder="Nh?p l� do chi ti?t d? ph?n h?i nh�n vi�n..."
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
                  H?y b?
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition cursor-pointer"
                >
                  T? ch?i don
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onConfirm={confirmState.onConfirm}
          onClose={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
