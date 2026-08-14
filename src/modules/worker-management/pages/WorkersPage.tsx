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
import { laborPartnersApi } from "../partners/api/laborPartners.api";
import { workerLaborTypeLabel } from "../types";
import type {
  Worker,
  WorkerInput,
  WorkerLaborType,
  WorkerProfileFieldConfig,
  WorkerProjectSummary,
  WorkerScope,
  WorkerStatus,
} from "../types";
import type { CommissionPolicy, LaborPartner } from "../partners/types";
import { formatWorkerDate } from "../utils/date";
import { Pagination } from "../../student-management/components/ui/Pagination";

type Props = {
  selectedCenter?: string;
  branchId?: string;
  canManage?: boolean;
  registrationOwnerId?: string;
  projects?: WorkerProjectSummary[];
  profileFields?: WorkerProfileFieldConfig[];
};

type WorkerSortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "registration-newest"
  | "registration-oldest";

function toTimestamp(value?: string) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

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

function toIsoDate(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = parseDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
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
    deleteWorkers,
  } = useWorkers(scope);
  const [laborPartners, setLaborPartners] = React.useState<LaborPartner[]>([]);
  const [laborPartnerPolicies, setLaborPartnerPolicies] = React.useState<CommissionPolicy[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    if (!scope) {
      setLaborPartners([]);
      setLaborPartnerPolicies([]);
      return () => { cancelled = true; };
    }
    void Promise.all([
      laborPartnersApi.list(scope),
      laborPartnersApi.listPolicies(scope),
    ]).then(([partners, policies]) => {
      if (cancelled) return;
      setLaborPartners(partners);
      setLaborPartnerPolicies(policies);
    }).catch(() => {
      if (cancelled) return;
      setLaborPartners([]);
      setLaborPartnerPolicies([]);
    });
    return () => { cancelled = true; };
  }, [scope?.branchId, scope?.companyCode]);

  const createWorkerWithPartner = React.useCallback(async (input: WorkerInput, partnerId?: string) => {
    if (!partnerId) return createWorker(input);
    const partner = laborPartners.find((item) => item._id === partnerId && item.status === "active");
    if (!partner) throw new Error("Đối tác giới thiệu không còn hoạt động hoặc không tồn tại.");
    const commissionScheme = input.laborType === "seasonal" ? "seasonal_hourly" : "official_monthly";
    const activePolicies = laborPartnerPolicies.filter((policy) => policy.status === "active");
    const compatiblePolicies = activePolicies.filter((policy) => commissionScheme === "seasonal_hourly" ? policy.seasonal.enabled : policy.official.enabled);
    const policyId = (partner.defaultPolicyId && compatiblePolicies.some((policy) => policy._id === partner.defaultPolicyId)
      ? partner.defaultPolicyId
      : compatiblePolicies[0]?._id) || "";
    if (!policyId) throw new Error("Đối tác chưa có chính sách hoa hồng đang hoạt động phù hợp với loại lao động này. Hãy cấu hình chính sách trước.");

    const worker = await createWorker(input);
    try {
      const effectiveDate = toIsoDate(input.registrationDate);
      await laborPartnersApi.createReferral(scope!, partner._id, {
        workerId: worker._id,
        policyId,
        commissionScheme,
        referredAt: effectiveDate,
        employmentStartDate: effectiveDate,
        effectiveFrom: effectiveDate,
        confirmationSource: "manual",
      });
    } catch (reason) {
      toast.warning(reason instanceof Error
        ? `Đã lưu hồ sơ nhưng chưa gắn được đối tác: ${reason.message}`
        : "Đã lưu hồ sơ nhưng chưa gắn được đối tác. Vui lòng kiểm tra lại trong phân hệ Đối tác lao động.");
    }
    return worker;
  }, [createWorker, laborPartnerPolicies, laborPartners, scope]);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<WorkerStatus | "all">("all");
  const [project, setProject] = React.useState("all");
  const [laborType, setLaborType] = React.useState<WorkerLaborType | "all">("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [sortBy, setSortBy] = React.useState<WorkerSortOption>("newest");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 10;
  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [qrOpen, setQrOpen] = React.useState(false);
  const [selectedWorker, setSelectedWorker] = React.useState<Worker | null>(
    null,
  );
  const [selectedWorkerIds, setSelectedWorkerIds] = React.useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const filtered = workers.filter((worker) => {
    if (status !== "all" && worker.status !== status) return false;
    if (laborType !== "all" && (worker.laborType || "official") !== laborType) {
      return false;
    }
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

  const sortedWorkers = [...filtered].sort((left, right) => {
    if (sortBy === "name-asc" || sortBy === "name-desc") {
      const result = (left.fullName || "").localeCompare(right.fullName || "", "vi", {
        sensitivity: "base",
      });
      return sortBy === "name-asc" ? result : -result;
    }

    const leftRegistration = parseDate(left.registrationDate)?.getTime() || 0;
    const rightRegistration = parseDate(right.registrationDate)?.getTime() || 0;
    const leftCreated = left.createdAt ? toTimestamp(left.createdAt) : leftRegistration;
    const rightCreated = right.createdAt ? toTimestamp(right.createdAt) : rightRegistration;
    const leftTime = sortBy.startsWith("registration") ? leftRegistration : leftCreated;
    const rightTime = sortBy.startsWith("registration") ? rightRegistration : rightCreated;
    if (leftTime !== rightTime) {
      return sortBy.endsWith("oldest") ? leftTime - rightTime : rightTime - leftTime;
    }
    return (left.fullName || "").localeCompare(right.fullName || "", "vi", {
      sensitivity: "base",
    });
  });

  const totalPages = Math.ceil(sortedWorkers.length / pageSize);
  const paginatedWorkers = sortedWorkers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, status, project, laborType, startDate, endDate, sortBy, selectedCenter, branchId]);

  React.useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    setSelectedWorkerIds((current) => current.filter((id) => workers.some((worker) => worker._id === id)));
  }, [workers]);

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

  const removeSelected = async () => {
    if (!selectedWorkerIds.length) return;
    setBulkDeleting(true);
    try {
      const result = await deleteWorkers(selectedWorkerIds);
      setSelectedWorkerIds([]);
      setBulkDeleteOpen(false);
      toast.success(`Đã xóa ${result.deletedCount} lao động thành công!`);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Có lỗi xảy ra khi xóa hàng loạt lao động.",
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.warning("Không có dữ liệu để xuất.");
      return;
    }
    const rows = sortedWorkers.map((worker) => ({
      "Họ và tên": worker.fullName,
      "Số điện thoại": worker.phone || "",
      "Mã đối tác giới thiệu": worker.partnerCode || "",
      "CCCD / CMND": worker.idCard || "",
      "Ngày tiếp nhận": formatWorkerDate(worker.registrationDate),
      "Trạng thái": statusLabel[worker.status],
      "Loại lao động": workerLaborTypeLabel[worker.laborType || "official"],
      "Quốc tịch": worker.nationality || "",
      "Số GPLĐ / visa": worker.workPermitNumber || "",
      "Ngày hết hạn GPLĐ / visa": formatWorkerDate(worker.workPermitExpiry),
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
    const rows = sortedWorkers
      .map(
        (worker) =>
          `<tr><td>${worker.fullName}</td><td>${worker.phone || ""}</td><td>${formatWorkerDate(worker.registrationDate)}</td><td>${statusLabel[worker.status]}</td></tr>`,
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
          {canManage && selectedWorkerIds.length > 0 && (
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-rose-700 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa hàng loạt ({selectedWorkerIds.length})
            </button>
          )}
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

      <div className="filters-bar grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
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
        <FilterSelect
          label="Loại lao động"
          value={laborType}
          onChange={(value) => setLaborType(value as WorkerLaborType | "all")}
          options={[
            { value: "all", label: "Tất cả loại" },
            ...Object.entries(workerLaborTypeLabel).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <DateFilter label="Từ ngày" value={startDate} onChange={setStartDate} />
        <DateFilter label="Đến ngày" value={endDate} onChange={setEndDate} />
        <FilterSelect
          label="Sắp xếp"
          value={sortBy}
          onChange={(value) => setSortBy(value as WorkerSortOption)}
          options={[
            { value: "newest", label: "Mới thêm trước" },
            { value: "oldest", label: "Cũ nhất trước" },
            { value: "name-asc", label: "Họ tên A - Z" },
            { value: "name-desc", label: "Họ tên Z - A" },
            { value: "registration-newest", label: "Ngày tiếp nhận mới nhất" },
            { value: "registration-oldest", label: "Ngày tiếp nhận cũ nhất" },
          ]}
        />
        <div className="col-span-2 space-y-0.5 lg:col-span-1 lg:col-start-6">
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
                {canManage && (
                  <TableHead centered>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả lao động trên trang"
                      checked={paginatedWorkers.length > 0 && paginatedWorkers.every((worker) => selectedWorkerIds.includes(worker._id))}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedWorkerIds((current) => Array.from(new Set([
                            ...current,
                            ...paginatedWorkers.map((worker) => worker._id),
                          ])));
                        } else {
                          setSelectedWorkerIds((current) => current.filter((id) => !paginatedWorkers.some((worker) => worker._id === id)));
                        }
                      }}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                    />
                  </TableHead>
                )}
                <TableHead>Họ và tên</TableHead>
                <TableHead centered>Ngày tiếp nhận</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead centered>Loại lao động</TableHead>
                <TableHead centered>Trạng thái</TableHead>
                <TableHead right>Thao tác</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <StateRow colSpan={canManage ? 7 : 6}>Đang nạp dữ liệu...</StateRow>
              ) : error ? (
                <StateRow colSpan={canManage ? 7 : 6} error>{error}</StateRow>
              ) : filtered.length === 0 ? (
                <StateRow colSpan={canManage ? 7 : 6}>
                  Không tìm thấy Lao động nào phù hợp với bộ lọc.
                </StateRow>
              ) : (
                paginatedWorkers.map((worker) => (
                  <WorkerRow
                    key={worker._id}
                    worker={worker}
                    canManage={canManage}
                    selected={selectedWorkerIds.includes(worker._id)}
                    onToggleSelected={(id) => setSelectedWorkerIds((current) => current.includes(id)
                      ? current.filter((selectedId) => selectedId !== id)
                      : [...current, id])}
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          itemName="lao động"
        />
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
          partners={laborPartners}
          profileFields={profileFields}
          projects={projects}
          tenantId={selectedCenter && selectedCenter !== "all" ? selectedCenter : undefined}
          onClose={() => setAddOpen(false)}
          onSubmit={createWorkerWithPartner}
          onSuccess={setSelectedWorker}
        />
      )}
      <WorkerDetailModal
        worker={selectedWorker}
        workers={workers}
        profileFields={profileFields}
        scope={scope}
        canManage={canManage}
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
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-base font-bold text-slate-900">Xóa hàng loạt lao động?</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Bạn đang chọn <strong className="text-rose-600">{selectedWorkerIds.length}</strong> lao động. Hồ sơ sẽ được chuyển vào trạng thái đã xóa.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleting}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void removeSelected()}
                disabled={bulkDeleting}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {bulkDeleting ? "Đang xóa..." : `Xóa ${selectedWorkerIds.length} lao động`}
              </button>
            </div>
          </div>
        </div>
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
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
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
  colSpan = 6,
}: {
  children: React.ReactNode;
  error?: boolean;
  colSpan?: number;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
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
  selected,
  onToggleSelected,
  deleting,
  confirmDelete,
  onOpen,
  onToggleDelete,
  onCancelDelete,
  onDelete,
}: {
  worker: Worker;
  canManage: boolean;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  deleting: string | null;
  confirmDelete: string | null;
  onOpen: (worker: Worker) => void;
  onToggleDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDelete: (worker: Worker) => Promise<void>;
}) {
  return (
    <tr className="group transition-colors hover:bg-slate-50/50">
      {canManage && (
        <td className="px-3 py-1.5 text-center">
          <input
            type="checkbox"
            aria-label={`Chọn ${worker.fullName}`}
            checked={selected}
            onChange={() => onToggleSelected(worker._id)}
            className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
          />
        </td>
      )}
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
        {formatWorkerDate(worker.registrationDate)}
      </td>
      <td className="px-3 py-1.5 text-[11px] font-medium text-slate-500">
        {worker.address || <span className="text-slate-300">Chưa cập nhật</span>}
      </td>
      <td className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-500">
        {workerLaborTypeLabel[worker.laborType || "official"]}
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
