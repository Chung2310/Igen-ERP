import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  FileCheck2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  getCredentialDaysRemaining,
  type HRCredentialStatus,
  type HRCredentialType,
} from "../../../shared/hr-credential";
import { getAccessToken } from "../../services/authService";
import type { ResourceItem } from "../../types";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { FilePreviewModal } from "../resource/FilePreviewModal";
import { hrCredentialService } from "../../services/hrCredentialService";
import type { Credential, CredentialEmployee as Employee } from "../../types/hrCredential";

type CredentialForm = {
  employeeId: string;
  name: string;
  type: HRCredentialType;
  credentialNumber: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate: string;
  professionalScope: string;
  note: string;
  reminderDays: number;
  fileUrl: string;
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  resourceId: string;
  uploadToken?: string;
};

const typeLabels: Record<HRCredentialType, string> = {
  professional_degree: "Bằng chuyên môn",
  practice_certificate: "Chứng chỉ hành nghề",
  training_certificate: "Chứng nhận đào tạo",
  other: "Khác",
};
const statusLabels: Record<HRCredentialStatus, string> = {
  active: "Còn hiệu lực",
  expiring: "Sắp hết hạn",
  expired: "Đã hết hạn",
};
const statusStyles: Record<HRCredentialStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expiring: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-rose-50 text-rose-700 border-rose-200",
};
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15";
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAccessToken()}`,
});
const date = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("vi-VN").format(new Date(value)) : "Không thời hạn";
const isoDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");
const mimeFromName = (name: string) => {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "doc") return "application/msword";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "xls") return "application/vnd.ms-excel";
  if (extension === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (extension === "ppt") return "application/vnd.ms-powerpoint";
  if (extension === "txt") return "text/plain";
  if (extension === "csv") return "text/csv";
  if (extension === "rtf") return "application/rtf";
  if (extension === "zip") return "application/zip";
  if (extension === "rar") return "application/vnd.rar";
  if (extension === "7z") return "application/x-7z-compressed";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension || ""))
    return `image/${extension === "jpg" ? "jpeg" : extension === "svg" ? "svg+xml" : extension}`;
  return "";
};
const emptyForm = (employeeId = ""): CredentialForm => ({
  employeeId,
  name: "",
  type: "practice_certificate",
  credentialNumber: "",
  issuingOrganization: "",
  issueDate: "",
  expiryDate: "",
  professionalScope: "",
  note: "",
  reminderDays: 30,
  fileUrl: "",
  fileName: "",
  fileMimeType: "",
  fileSize: 0,
  resourceId: "",
});

export default function CredentialsTab({
  canManage,
  companyCode,
  branchId,
  initialEmployeeId,
}: {
  canManage: boolean;
  companyCode: string;
  branchId?: string;
  initialEmployeeId?: string;
}) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState(initialEmployeeId || "");
  const [statusFilter, setStatusFilter] = useState<HRCredentialStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<HRCredentialType | "">("");
  const [page, setPage] = useState(1);
  const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<Set<string>>(
    () => new Set(initialEmployeeId ? [initialEmployeeId] : []),
  );
  const [editing, setEditing] = useState<Credential | "new" | null>(null);
  const [form, setForm] = useState<CredentialForm>(emptyForm(initialEmployeeId));
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);
  const employeePageSize = 20;

  useEffect(() => {
    setEmployeeFilter(initialEmployeeId || "");
    setPage(1);
    if (initialEmployeeId) {
      setExpandedEmployeeIds((current) => new Set(current).add(initialEmployeeId));
    }
  }, [initialEmployeeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  const suffix = useMemo(() => {
    const params = new URLSearchParams({ companyCode, all: "true" });
    if (branchId) params.set("branchId", branchId);
    return `?${params.toString()}`;
  }, [companyCode, branchId]);

  const load = async () => {
    if (!companyCode) return;
    setLoading(true);
    try {
      const result = await hrCredentialService.list({ companyCode, branchId, all: true });
      setCredentials(result.credentials || []);
      const availableEmployees: Employee[] = result.employees || [];
      setEmployees(availableEmployees);
      if (employeeFilter && !availableEmployees.some((employee) => employee._id === employeeFilter)) {
        setEmployeeFilter("");
      }
      setSummary(result.summary || { total: 0, active: 0, expiring: 0, expired: 0 });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách văn bằng/chứng chỉ."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [suffix]);

  const openForm = (credential?: Credential, employeeId?: string) => {
    setEditing(credential || "new");
    setForm(
      credential
        ? {
            employeeId: credential.employeeId,
            name: credential.name,
            type: credential.type,
            credentialNumber: credential.credentialNumber || "",
            issuingOrganization: credential.issuingOrganization,
            issueDate: isoDate(credential.issueDate),
            expiryDate: isoDate(credential.expiryDate),
            professionalScope: credential.professionalScope || "",
            note: credential.note || "",
            reminderDays: credential.reminderDays || 30,
            fileUrl: credential.fileUrl || "",
            fileName: credential.fileName || "",
            fileMimeType: credential.fileMimeType || "",
            fileSize: credential.fileSize || 0,
            resourceId: credential.resourceId || "",
          }
        : emptyForm(employeeId || employeeFilter || initialEmployeeId || employees[0]?._id || ""),
    );
  };

  const uploadScan = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return toast.error("Tệp tải lên không được vượt quá 10 MB.");
    const mimeType = file.type || mimeFromName(file.name);
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/v1/hr-credentials/upload?companyCode=${encodeURIComponent(companyCode)}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ file: base64, name: file.name, mimeType: mimeType || file.type, size: file.size }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setForm((current) => ({
        ...current,
        fileUrl: result.data.url,
        fileName: file.name,
        fileMimeType: mimeType || file.type,
        fileSize: file.size,
        uploadToken: result.data.uploadToken,
      }));
      toast.success(`Đã tải lên ${file.name}.`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải tệp tài liệu."));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.employeeId || !form.name.trim() || !form.issuingOrganization.trim() || !form.issueDate) {
      return toast.error("Vui lòng nhập đủ nhân viên, tên, đơn vị cấp và ngày cấp.");
    }
    if (form.expiryDate && form.expiryDate < form.issueDate) {
      return toast.error("Ngày hết hạn phải bằng hoặc sau ngày cấp.");
    }
    setSaving(true);
    try {
      const isNew = editing === "new";
      const response = await fetch(
        isNew
          ? `/api/v1/hr-credentials?companyCode=${encodeURIComponent(companyCode)}`
          : `/api/v1/hr-credentials/${(editing as Credential)._id}?companyCode=${encodeURIComponent(companyCode)}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: headers(),
          body: JSON.stringify({ ...form, expiryDate: form.expiryDate || null }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success(isNew ? "Đã thêm văn bằng/chứng chỉ." : "Đã cập nhật văn bằng/chứng chỉ.");
      setExpandedEmployeeIds((current) => new Set(current).add(form.employeeId));
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu văn bằng/chứng chỉ."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (credential: Credential) => {
    if (!window.confirm(`Xóa “${credential.name}” của ${credential.employeeName}?`)) return;
    try {
      const response = await fetch(
        `/api/v1/hr-credentials/${credential._id}?companyCode=${encodeURIComponent(companyCode)}`,
        { method: "DELETE", headers: headers() },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      toast.success("Đã xóa văn bằng/chứng chỉ.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa văn bằng/chứng chỉ."));
    }
  };

  const preview = async (credential: Credential) => {
    if (!credential.fileUrl) return;
    if (credential.resourceId) {
      try {
        const response = await fetch(`/api/v1/resources/${credential.resourceId}`, { headers: headers() });
        const result = await response.json();
        if (response.ok && result.item?.fileUrl) {
          setPreviewItem(result.item);
          return;
        }
      } catch (error) {
        console.warn("Không tải được tài nguyên bản scan, dùng dữ liệu dự phòng:", error);
      }
    }
    setPreviewItem({
      _id: credential.resourceId || `${credential._id}-scan`,
      companyCode,
      section: "local",
      type: "file",
      name: credential.fileName || "ban-scan.pdf",
      parentId: null,
      fileUrl: credential.fileUrl,
      mimeType: credential.fileMimeType,
      size: credential.fileSize,
      createdAt: "",
      updatedAt: "",
    });
  };

  const expiring = credentials.filter((item) => item.status === "expiring");
  const normalizedSearch = normalizeSearch(debouncedSearch);
  const employeeRows = useMemo(() => {
    const credentialsByEmployee = new Map<string, Credential[]>();
    for (const credential of credentials) {
      const current = credentialsByEmployee.get(credential.employeeId) || [];
      current.push(credential);
      credentialsByEmployee.set(credential.employeeId, current);
    }

    // Đảm bảo không sót các văn bằng của nhân viên không nằm trong danh mục employees
    const knownEmployeeIds = new Set(employees.map((e) => e._id));
    const extraEmployees: Employee[] = [];
    for (const credential of credentials) {
      if (credential.employeeId && !knownEmployeeIds.has(credential.employeeId)) {
        knownEmployeeIds.add(credential.employeeId);
        extraEmployees.push({
          _id: credential.employeeId,
          displayName: credential.employeeName || "Nhân viên khác",
          email: "",
          department: "",
        });
      }
    }
    const allEmployees = [...employees, ...extraEmployees];
    const searchQuery = debouncedSearch.trim();

    return allEmployees.flatMap((employee) => {
      if (employeeFilter && employee._id !== employeeFilter) return [];

      const allCredentials = credentialsByEmployee.get(employee._id) || [];
      const empDisplayName = employee.displayName || (employee as any).name || (employee as any).fullName || "";

      // Chỉ tìm kiếm theo tên nhân viên (không phân biệt chữ hoa/thường, có dấu/không dấu)
      const employeeMatchesSearch =
        !searchQuery ||
        matchesSearchTerm(empDisplayName, searchQuery) ||
        allCredentials.some((c) => matchesSearchTerm(c.employeeName, searchQuery));

      // Nếu tên nhân viên không khớp từ khóa tìm kiếm -> loại bỏ ngay lập tức
      if (!employeeMatchesSearch) return [];

      const filteredCredentials = allCredentials.filter((credential) => {
        if (statusFilter && credential.status !== statusFilter) return false;
        if (typeFilter && credential.type !== typeFilter) return false;
        return true;
      });

      if ((statusFilter || typeFilter) && filteredCredentials.length === 0) return [];

      return [
        {
          employee,
          credentials: filteredCredentials,
          totalCredentials: allCredentials.length,
          expiringCount: allCredentials.filter((credential) => credential.status === "expiring").length,
          expiredCount: allCredentials.filter((credential) => credential.status === "expired").length,
        },
      ];
    });
  }, [credentials, employees, employeeFilter, debouncedSearch, statusFilter, typeFilter]);
  const totalPages = Math.max(1, Math.ceil(employeeRows.length / employeePageSize));
  const pagedEmployeeRows = employeeRows.slice((page - 1) * employeePageSize, page * employeePageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleEmployee = (employeeId: string) => {
    setExpandedEmployeeIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4 sm:p-5 text-left">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Award className="text-cyan-600" /> Văn bằng & chứng chỉ hành nghề
            </h2>
            <p className="text-xs text-slate-500">Theo dõi hiệu lực, bản scan và phạm vi chuyên môn của nhân viên.</p>
          </div>
          {canManage && (
            <button
              onClick={() => openForm()}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white"
            >
              <Plus size={15} /> Thêm văn bằng/chứng chỉ
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Tổng hồ sơ", summary.total, "text-slate-700", FileCheck2],
            ["Còn hiệu lực", summary.active, "text-emerald-700", Award],
            ["Sắp hết hạn", summary.expiring, "text-amber-700", CalendarClock],
            ["Đã hết hạn", summary.expired, "text-rose-700", AlertTriangle],
          ].map(([label, value, color, Icon]: any) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className={`flex items-center gap-2 text-xs font-bold ${color}`}>
                <Icon size={16} />
                {label}
              </div>
              <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        {expiring.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              <AlertTriangle size={17} /> Danh sách cần xử lý
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {expiring.slice(0, 6).map((item) => (
                <button
                  key={item._id}
                  onClick={() => openForm(item)}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-left text-xs text-amber-900"
                >
                  <strong>{item.employeeName}</strong> · {item.name} · còn {getCredentialDaysRemaining(item.expiryDate)}{" "}
                  ngày
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4">
          <label className="relative md:col-span-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên nhân viên..."
              className={`${inputClass} pl-9`}
            />
          </label>
          <select
            value={employeeFilter}
            onChange={(event) => {
              setEmployeeFilter(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Tất cả nhân viên</option>
            {employees.map((employee) => (
              <option key={employee._id} value={employee._id}>
                {employee.displayName || employee.email}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as any);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Tất cả loại</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as any);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-xs text-slate-500">Đang tải dữ liệu...</div>
          ) : employeeRows.length === 0 ? (
            <div className="p-10 text-center">
              <Award className="mx-auto mb-2 text-slate-300" size={36} />
              <p className="text-sm font-bold text-slate-600">Không tìm thấy nhân viên phù hợp</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pagedEmployeeRows.map(
                ({ employee, credentials: employeeCredentials, totalCredentials, expiringCount, expiredCount }) => {
                  const expanded = Boolean(debouncedSearch.trim()) || expandedEmployeeIds.has(employee._id);
                  const employeeName = employee.displayName || employee.email;
                  return (
                    <div key={employee._id}>
                      <div className="flex items-center gap-2 p-3 sm:p-4">
                        <button
                          type="button"
                          onClick={() => toggleEmployee(employee._id)}
                          aria-expanded={expanded}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-slate-50"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-extrabold text-cyan-700">
                            {employeeName.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm text-slate-900">{employeeName}</strong>
                            <span className="block truncate text-[11px] text-slate-500">
                              {[employee.email !== employeeName ? employee.email : "", employee.department || ""]
                                .filter(Boolean)
                                .join(" · ") || "Chưa cập nhật phòng ban"}
                            </span>
                          </span>
                          <span className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
                            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                              {totalCredentials} hồ sơ
                            </span>
                            {expiringCount > 0 && (
                              <span className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                                {expiringCount} sắp hết hạn
                              </span>
                            )}
                            {expiredCount > 0 && (
                              <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">
                                {expiredCount} hết hạn
                              </span>
                            )}
                          </span>
                          <ChevronDown
                            size={18}
                            className={`shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => openForm(undefined, employee._id)}
                            title={`Thêm văn bằng/chứng chỉ cho ${employeeName}`}
                            className="shrink-0 rounded-xl border border-cyan-200 bg-cyan-50 p-2 text-cyan-700 hover:bg-cyan-100"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                      </div>

                      {expanded && (
                        <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:px-5 sm:pb-5">
                          {employeeCredentials.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
                              Nhân viên chưa có văn bằng/chứng chỉ phù hợp.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {employeeCredentials.map((item) => {
                                const remaining = getCredentialDaysRemaining(item.expiryDate);
                                return (
                                  <div
                                    key={item._id}
                                    className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center"
                                  >
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <strong className="text-sm text-slate-900">{item.name}</strong>
                                        <span
                                          className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${statusStyles[item.status]}`}
                                        >
                                          {statusLabels[item.status]}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 text-[11px] text-slate-500">
                                        {typeLabels[item.type]}
                                        {item.credentialNumber ? ` · Số ${item.credentialNumber}` : ""}
                                      </div>
                                    </div>
                                    <div className="text-xs text-slate-600">
                                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                                        Đơn vị / ngày cấp
                                      </span>
                                      {item.issuingOrganization}
                                      <br />
                                      {date(item.issueDate)}
                                    </div>
                                    <div className="text-xs text-slate-600">
                                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                                        Ngày hết hạn
                                      </span>
                                      {date(item.expiryDate)}
                                      {remaining !== null && (
                                        <span className="block text-[11px] text-slate-400">
                                          {remaining < 0
                                            ? `Quá hạn ${Math.abs(remaining)} ngày`
                                            : `Còn ${remaining} ngày`}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-end gap-1">
                                      {item.fileUrl && (
                                        <button
                                          onClick={() => void preview(item)}
                                          title="Xem bản scan"
                                          className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"
                                        >
                                          <Eye size={16} />
                                        </button>
                                      )}
                                      {canManage && (
                                        <button
                                          onClick={() => openForm(item)}
                                          title="Chỉnh sửa"
                                          className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50"
                                        >
                                          <Pencil size={16} />
                                        </button>
                                      )}
                                      {canManage && (
                                        <button
                                          onClick={() => void remove(item)}
                                          title="Xóa"
                                          className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                    {(item.professionalScope || item.note) && (
                                      <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600 lg:col-span-4">
                                        {item.professionalScope && (
                                          <div>
                                            <strong>Phạm vi chuyên môn:</strong> {item.professionalScope}
                                          </div>
                                        )}
                                        {item.note && (
                                          <div>
                                            <strong>Ghi chú:</strong> {item.note}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs">
              <span>
                Trang {page}/{totalPages} · {employeeRows.length} nhân viên
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
                >
                  Trước
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">
                {editing === "new" ? "Thêm văn bằng/chứng chỉ" : "Cập nhật văn bằng/chứng chỉ"}
              </h3>
              <button onClick={() => setEditing(null)} className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nhân viên *">
                <EmployeeCombobox
                  employees={employees}
                  value={form.employeeId}
                  onChange={(employeeId) => setForm({ ...form, employeeId })}
                />
              </Field>
              <Field label="Loại *">
                <select
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as HRCredentialType })}
                  className={inputClass}
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tên văn bằng/chứng chỉ *">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Số văn bằng/chứng chỉ">
                <input
                  value={form.credentialNumber}
                  onChange={(event) => setForm({ ...form, credentialNumber: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Đơn vị cấp *">
                <input
                  value={form.issuingOrganization}
                  onChange={(event) => setForm({ ...form, issuingOrganization: event.target.value })}
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Ngày cấp *">
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(event) => setForm({ ...form, issueDate: event.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ngày hết hạn">
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Phạm vi chuyên môn được phép thực hiện">
                  <textarea
                    rows={2}
                    value={form.professionalScope}
                    onChange={(event) => setForm({ ...form, professionalScope: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Cảnh báo trước (ngày)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.reminderDays}
                  onChange={(event) => setForm({ ...form, reminderDays: Number(event.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Tệp tài liệu / bản scan (PDF, Office, ảnh... tối đa 10 MB)">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700">
                  <Upload size={15} />
                  {uploading ? "Đang tải..." : form.fileName || "Chọn tệp"}
                  <input
                    type="file"
                    accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.zip,.rar,.7z"
                    disabled={uploading}
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadScan(file);
                    }}
                  />
                </label>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Ghi chú">
                  <textarea
                    rows={2}
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <button
                onClick={() => setEditing(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                disabled={saving || uploading}
                onClick={() => void save()}
                className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu hồ sơ"}
              </button>
            </div>
          </div>
        </div>
      )}
      <FilePreviewModal item={previewItem} onClose={() => setPreviewItem(null)} hideShare />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-bold text-slate-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function normalizeSearch(value: string) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

function matchesSearchTerm(target: string | undefined | null, query: string): boolean {
  if (!query) return true;
  if (!target) return false;
  const t = target.trim();
  const q = query.trim();
  if (!t || !q) return false;

  // 1. So sánh trực tiếp không phân biệt hoa thường (giữ nguyên dấu)
  if (t.toLowerCase().includes(q.toLowerCase())) return true;

  // 2. So sánh không phân biệt hoa thường và không dấu
  return normalizeSearch(t).includes(normalizeSearch(q));
}

function EmployeeCombobox({
  employees,
  value,
  onChange,
}: {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string) => void;
}) {
  const selected = employees.find((employee) => employee._id === value);
  const selectedLabel = selected?.displayName || selected?.email || "";
  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value) setQuery(selectedLabel);
  }, [value, selectedLabel]);

  const filteredEmployees = employees.filter((employee) => {
    const name = employee.displayName || (employee as any).name || (employee as any).fullName || "";
    return (
      matchesSearchTerm(name, query) ||
      matchesSearchTerm(employee.email, query) ||
      matchesSearchTerm(employee.department, query)
    );
  });

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="credential-employee-options"
          aria-autocomplete="list"
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          placeholder="Tìm theo tên, email hoặc phòng ban..."
          className={`${inputClass} pl-9 pr-9`}
        />
        <button
          type="button"
          aria-label="Mở danh sách nhân viên"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          className="absolute right-1.5 top-1.5 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronDown size={16} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      {open && (
        <div
          id="credential-employee-options"
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {filteredEmployees.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-slate-400">Không tìm thấy nhân viên phù hợp.</div>
          ) : (
            filteredEmployees.map((employee) => {
              const label = employee.displayName || employee.email;
              const active = employee._id === value;
              return (
                <button
                  key={employee._id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(employee._id);
                    setQuery(label);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-cyan-50 ${
                    active ? "bg-cyan-50" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-slate-800">{label}</strong>
                    <span className="block truncate text-[10px] text-slate-500">
                      {[employee.email !== label ? employee.email : "", employee.department || ""]
                        .filter(Boolean)
                        .join(" · ") || "Chưa cập nhật phòng ban"}
                    </span>
                  </span>
                  {active && <Check size={15} className="shrink-0 text-cyan-600" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
