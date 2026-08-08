import React from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  Eye,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "../../../pages/Toast";
import { AddWorkerModal } from "../components/AddWorkerModal";
import { ImportWorkerModal } from "../components/ImportWorkerModal";
import { WorkerDetailModal } from "../components/WorkerDetailModal";
import { useWorkers } from "../hooks/useWorkers";
import type {
  Worker,
  WorkerProfileFieldConfig,
  WorkerProjectSummary,
  WorkerScope,
  WorkerStatus,
} from "../types";

type Props = {
  selectedCenter?: string;
  branchId?: string;
  canManage?: boolean;
  registrationOwnerId?: string;
  projects?: WorkerProjectSummary[];
  profileFields?: WorkerProfileFieldConfig[];
};

const statusLabel: Record<WorkerStatus, string> = {
  active: "Đang tuyển",
  placed: "Đã trúng tuyển",
  inactive: "Ngừng xử lý",
};

const statusClass: Record<WorkerStatus, string> = {
  active: "border-sky-200 bg-sky-100 text-sky-700",
  placed: "border-emerald-200 bg-emerald-100 text-emerald-700",
  inactive: "border-slate-300 bg-slate-200 text-slate-600",
};

function parseDate(value?: string) {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const display = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (display) {
    return new Date(
      Number(display[3]),
      Number(display[2]) - 1,
      Number(display[1]),
    );
  }
  return null;
}

export default function WorkersPage({
  selectedCenter,
  branchId,
  canManage = true,
  registrationOwnerId,
  projects = [],
  profileFields,
}: Props) {
  const scope = React.useMemo<WorkerScope | undefined>(
    () =>
      selectedCenter && selectedCenter !== "all"
        ? {
            companyCode: selectedCenter,
            ...(branchId ? { branchId } : {}),
          }
        : undefined,
    [branchId, selectedCenter],
  );
  const {
    workers,
    loading,
    error,
    createWorker,
    importWorkers,
    updateWorker,
    deleteWorker,
  } = useWorkers(scope);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<WorkerStatus | "all">("all");
  const [project, setProject] = React.useState("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [selectedWorker, setSelectedWorker] = React.useState<Worker | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const filtered = workers.filter((worker) => {
    if (status !== "all" && worker.status !== status) return false;
    const projectIds = worker.projectIds || [];
    if (project === "unassigned" && projectIds.length) return false;
    if (project !== "all" && project !== "unassigned" && !projectIds.includes(project)) {
      return false;
    }

    const registration = parseDate(worker.registrationDate);
    if (startDate) {
      const start = parseDate(startDate);
      if (!registration || (start && registration < start)) return false;
    }
    if (endDate) {
      const end = parseDate(endDate);
      if (!registration || (end && registration > end)) return false;
    }

    return `${worker.fullName} ${worker.phone || ""} ${worker.idCard || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });

  const remove = async (worker: Worker) => {
    setDeleting(worker._id);
    try {
      await deleteWorker(worker._id);
      setConfirmDelete(null);
      toast.success("Đã xóa Lao động thành công!");
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Có lỗi xảy ra khi xóa Lao động.",
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.warning("Không có dữ liệu để xuất.");
      return;
    }
    const rows = filtered.map((worker) => ({
      "Họ và tên": worker.fullName,
      "Số điện thoại": worker.phone || "",
      "CCCD / CMND": worker.idCard || "",
      "Ngày tiếp nhận": worker.registrationDate || "",
      "Trạng thái": statusLabel[worker.status],
      "Địa chỉ": worker.address || "",
      Email: worker.email || "",
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(rows),
      "Lao động",
    );
    XLSX.writeFile(
      workbook,
      `danh_sach_lao_dong_${new Date()
        .toLocaleDateString("vi-VN")
        .replace(/\//g, "-")}.xlsx`,
    );
    toast.success("Đã xuất file Excel thành công!");
  };

  const handlePrint = () => {
    if (!filtered.length) {
      toast.warning("Không có dữ liệu Lao động để in.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) {
      toast.warning("Trình duyệt đã chặn cửa sổ bật lên.");
      return;
    }
    const rows = filtered
      .map(
        (worker) =>
          `<tr><td>${worker.fullName}</td><td>${worker.phone || ""}</td><td>${worker.registrationDate || ""}</td><td>${statusLabel[worker.status]}</td></tr>`,
      )
      .join("");
    printWindow.document.write(
      `<html><head><title>Danh sách Lao động</title><style>body{font-family:Inter,sans-serif;padding:40px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:10px;text-align:left}</style></head><body><h1>Danh sách Lao động</h1><table><thead><tr><th>Họ và tên</th><th>Số điện thoại</th><th>Ngày tiếp nhận</th><th>Trạng thái</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`,
    );
    printWindow.document.close();
  };

  const statusTabs: Array<{ value: WorkerStatus | "all"; label: string }> = [
    { value: "all", label: "Tất cả" },
    { value: "active", label: "Đang tuyển" },
    { value: "placed", label: "Đã trúng tuyển" },
    { value: "inactive", label: "Ngừng xử lý" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-cyan-700">
            Lao động
          </h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">
            {loading ? "..." : `${filtered.length} / ${workers.length}`} Lao động
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleExport}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" /> Xuất
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" /> In
          </button>
          {canManage && registrationOwnerId && (
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 whitespace-nowrap"
            >
              <QrCode className="h-3.5 w-3.5" /> QR đăng ký
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" /> Nhập Excel
            </button>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-1.5 text-[11px] font-bold text-white shadow-md shadow-cyan-100 transition-all hover:bg-brand-primary/95 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm
            </button>
          )}
        </div>
      </div>

      <div className="status-tabs flex items-center gap-2 overflow-x-auto pb-1.5">
        {statusTabs.map((tab) => {
          const selected = status === tab.value;
          const count =
            tab.value === "all"
              ? workers.length
              : workers.filter((worker) => worker.status === tab.value).length;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="filters-bar grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect
          label="Dự án"
          value={project}
          onChange={setProject}
          options={[
            { value: "all", label: "Tất cả dự án" },
            ...projects.map((item) => ({ value: item.id, label: item.name })),
            { value: "unassigned", label: "Chưa vào dự án" },
          ]}
        />
        <DateFilter label="Từ ngày" value={startDate} onChange={setStartDate} />
        <DateFilter label="Đến ngày" value={endDate} onChange={setEndDate} />
        <div className="col-span-2 space-y-0.5 lg:col-span-1 lg:col-start-5">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
            Tìm kiếm
          </label>
          <div className="relative">
            <input
              aria-label="Tìm kiếm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên / SĐT / CCCD..."
              className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 py-0 pl-7 pr-7 text-[11px] focus:border-cyan-600 focus:outline-none"
            />
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
            {search && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-slate-200"
              >
                <X className="h-3 w-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[720px] text-left sm:min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <TableHead>Họ và tên</TableHead>
                <TableHead centered>Ngày tiếp nhận</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead centered>Trạng thái</TableHead>
                <TableHead right>Thao tác</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <StateRow>Đang nạp dữ liệu...</StateRow>
              ) : error ? (
                <StateRow error>{error}</StateRow>
              ) : filtered.length === 0 ? (
                <StateRow>
                  Không tìm thấy Lao động nào phù hợp với bộ lọc.
                </StateRow>
              ) : (
                filtered.map((worker) => (
                  <WorkerRow
                    key={worker._id}
                    worker={worker}
                    canManage={canManage}
                    deleting={deleting}
                    confirmDelete={confirmDelete}
                    onOpen={setSelectedWorker}
                    onToggleDelete={(id) =>
                      setConfirmDelete(confirmDelete === id ? null : id)
                    }
                    onCancelDelete={() => setConfirmDelete(null)}
                    onDelete={remove}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {importOpen && (
        <ImportWorkerModal
          isOpen
          projects={projects}
          onImport={importWorkers}
          onClose={() => setImportOpen(false)}
          onSuccess={() => undefined}
        />
      )}
      {addOpen && (
        <AddWorkerModal
          isOpen
          workers={workers}
          profileFields={profileFields}
          projects={projects}
          tenantId={selectedCenter && selectedCenter !== "all" ? selectedCenter : undefined}
          onClose={() => setAddOpen(false)}
          onSubmit={createWorker}
          onSuccess={setSelectedWorker}
        />
      )}
      <WorkerDetailModal
        worker={selectedWorker}
        workers={workers}
        profileFields={profileFields}
        onClose={() => setSelectedWorker(null)}
        onSubmit={updateWorker}
        onSuccess={setSelectedWorker}
      />
      {qrOpen && registrationOwnerId && (
        <RegistrationQrModal
          ownerId={registrationOwnerId}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-0.5">
      <label
        htmlFor={`worker-filter-${label}`}
        className="text-[9px] font-bold uppercase tracking-wider text-slate-400"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={`worker-filter-${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-full appearance-none truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 pr-7 text-[11px] focus:border-cyan-600 focus:outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <label
        htmlFor={`worker-filter-${label}`}
        className="text-[9px] font-bold uppercase tracking-wider text-slate-400"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={`worker-filter-${label}`}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-full rounded-md border border-slate-200 bg-slate-50 pl-2.5 pr-7 text-[11px] font-medium focus:border-cyan-600 focus:outline-none"
        />
        <CalendarIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function TableHead({
  children,
  centered,
  right,
}: {
  children: React.ReactNode;
  centered?: boolean;
  right?: boolean;
}) {
  return (
    <th
      className={`px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 ${
        centered ? "text-center" : right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function StateRow({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <tr>
      <td
        colSpan={5}
        className={`px-4 py-16 text-center text-xs italic ${
          error ? "text-rose-500" : "text-slate-400"
        }`}
      >
        {children}
      </td>
    </tr>
  );
}

function WorkerRow({
  worker,
  canManage,
  deleting,
  confirmDelete,
  onOpen,
  onToggleDelete,
  onCancelDelete,
  onDelete,
}: {
  worker: Worker;
  canManage: boolean;
  deleting: string | null;
  confirmDelete: string | null;
  onOpen: (worker: Worker) => void;
  onToggleDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDelete: (worker: Worker) => Promise<void>;
}) {
  return (
    <tr className="group transition-colors hover:bg-slate-50/50">
      <td className="px-3 py-1.5">
        <div className="flex flex-col">
          <span className="capitalize text-xs font-bold text-slate-800">
            {worker.fullName}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-medium text-slate-400">
            <span>{worker.phone || "Chưa có số điện thoại"}</span>
            {worker.idCard && <span>CCCD: {worker.idCard}</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-500">
        {worker.registrationDate || ""}
      </td>
      <td className="px-3 py-1.5 text-[11px] font-medium text-slate-500">
        {worker.address || <span className="text-slate-300">Chưa cập nhật</span>}
      </td>
      <td className="px-3 py-1.5 text-center">
        <span
          className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${statusClass[worker.status]}`}
        >
          {statusLabel[worker.status]}
        </span>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onOpen(worker)}
            title="Sửa thông tin"
            className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpen(worker)}
            title="Xem chi tiết"
            className="cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <div className="relative">
              <button
                type="button"
                onClick={() => onToggleDelete(worker._id)}
                disabled={deleting === worker._id}
                title="Xóa"
                className={`cursor-pointer rounded-lg p-1 transition-colors disabled:opacity-50 ${
                  confirmDelete === worker._id
                    ? "bg-rose-600 text-white"
                    : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {confirmDelete === worker._id && (
                <div className="absolute bottom-full right-0 z-20 mb-2 min-w-[140px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <p className="text-center text-[10px] font-bold text-slate-800">
                    Xóa Lao động này?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={onCancelDelete}
                      className="flex-1 rounded-lg py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(worker)}
                      className="flex-1 rounded-lg bg-rose-600 py-1 text-[10px] font-bold text-white hover:bg-rose-700"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function RegistrationQrModal({
  ownerId,
  onClose,
}: {
  ownerId: string;
  onClose: () => void;
}) {
  const registerUrl = `${window.location.origin}/public/dang-ky?teacherId=${encodeURIComponent(ownerId)}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-cyan-700">
              <QrCode className="h-4 w-4" /> QR đăng ký Lao động
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Chia sẻ liên kết đăng ký hồ sơ Lao động.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng QR">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <p className="mt-4 break-all rounded-xl bg-slate-50 p-3 text-[10px] text-slate-500">
          {registerUrl}
        </p>
      </div>
    </div>
  );
}
