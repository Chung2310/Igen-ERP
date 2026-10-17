import React from "react";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Download,
  History,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "../../../pages/Toast";
import { useWorkerLaborContracts } from "../hooks/useWorkerLaborContracts";
import { workerLaborContractApi } from "../api/workerLaborContracts.api";
import { useWorkers } from "../hooks/useWorkers";
import { WorkerContractFormModal, type ContractFormMode } from "../components/WorkerContractFormModal";
import { WorkerContractHistory } from "../components/WorkerContractHistory";
import { alertText, resolveAlertLevel, toDisplayDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
import { StyledSelect } from "../../../components/common/StyledSelect";
import type {
  WorkerContractAlertLevel,
  WorkerLaborContract,
  WorkerLaborContractInput,
  WorkerScope,
} from "../types";

type Props = {
  selectedCenter?: string;
  branchId?: string;
  canManage?: boolean;
  /** Mở sẵn bộ lọc cảnh báo khi điều hướng từ thẻ cảnh báo ngoài dashboard. */
  initialAlertOnly?: boolean;
};

const alertBadgeClass: Record<WorkerContractAlertLevel, string> = {
  ok: "border-slate-200 bg-slate-50 text-slate-500",
  expiring: "border-amber-200 bg-amber-50 text-amber-700",
  expired: "border-rose-200 bg-rose-50 text-rose-700",
};

const statusBadgeClass: Record<string, string> = {
  draft: "border-slate-300 bg-slate-100 text-slate-600",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  renewed: "border-sky-200 bg-sky-50 text-sky-700",
  expired: "border-rose-200 bg-rose-50 text-rose-700",
  terminated: "border-slate-300 bg-slate-200 text-slate-600",
};

export default function WorkerContractsPage({
  selectedCenter,
  branchId,
  canManage = false,
  initialAlertOnly = false,
}: Props) {
  const scope = React.useMemo<WorkerScope | undefined>(
    () =>
      selectedCenter
        ? { companyCode: selectedCenter, ...(branchId ? { branchId } : {}) }
        : undefined,
    [branchId, selectedCenter],
  );
  const {
    contracts,
    loading,
    error,
    page,
    setPage,
    limit,
    total,
    search,
    setSearch,
    status,
    setStatus,
    client,
    setClient,
    alertOnly,
    setAlertOnly,
    clients,
    createContract,
    updateContract,
    renewContract,
    deleteContract,
    reload,
  } = useWorkerLaborContracts(scope, undefined, initialAlertOnly);

  const { workers } = useWorkers(scope);
  const [summary, setSummary] = React.useState<{ expiringCount: number; expiredCount: number } | null>(null);

  const fetchSummary = React.useCallback(async () => {
    if (!scope) return;
    try {
      const res = await workerLaborContractApi.expiringSummary(scope);
      setSummary(res);
    } catch (err) {
      console.error(err);
    }
  }, [scope]);

  React.useEffect(() => {
    void fetchSummary();
  }, [fetchSummary, contracts]);

  const [modal, setModal] = React.useState<{
    mode: ContractFormMode;
    contract?: WorkerLaborContract | null;
  } | null>(null);

  const workersAvailableForContract = React.useMemo(() => {
    if (modal?.mode !== "create") return workers;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const blockedWorkerIds = new Set(
      contracts
        .filter((contract) =>
          (contract.status === "draft" || contract.status === "active") &&
          contract.endDate >= today,
        )
        .map((contract) => contract.workerId),
    );
    return workers.filter((worker) => !blockedWorkerIds.has(worker._id));
  }, [contracts, modal?.mode, workers]);
  const [historyOf, setHistoryOf] = React.useState<string | null>(null);

  const workerName = React.useCallback(
    (workerId: string) => workers.find((worker) => worker._id === workerId)?.fullName || "—",
    [workers],
  );

  const decorated = React.useMemo(
    () =>
      contracts.map((contract) => {
        const alertLevel =
          contract.alertLevel || resolveAlertLevel(contract.endDate, contract.status);
        return {
          ...contract,
          status: alertLevel === "expired" ? ("expired" as const) : contract.status,
          alertLevel,
        };
      }),
    [contracts],
  );

  const filtered = decorated;

  const expiringCount = summary?.expiringCount ?? 0;
  const expiredCount = summary?.expiredCount ?? 0;

  const historyItems = React.useMemo(
    () =>
      historyOf ? decorated.filter((contract) => contract.rootContractId === historyOf) : [],
    [decorated, historyOf],
  );

  const submitModal = async (input: WorkerLaborContractInput) => {
    if (!modal) return;
    if (modal.mode === "create") {
      await createContract(input);
      toast.success("Đã thêm hợp đồng.");
      return;
    }
    if (modal.mode === "edit" && modal.contract) {
      await updateContract(modal.contract._id, input);
      toast.success("Đã cập nhật hợp đồng.");
      return;
    }
    if (modal.mode === "renew" && modal.contract) {
      await renewContract(modal.contract._id, input);
      toast.success("Đã tạo kỳ gia hạn. Kỳ cũ được giữ nguyên và khóa lại.");
    }
  };

  const handleDelete = async (contract: WorkerLaborContract) => {
    try {
      await deleteContract(contract._id);
      toast.success("Đã xóa hợp đồng.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Không thể xóa hợp đồng.");
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.warning("Không có hợp đồng để xuất.");
      return;
    }
    const rows = filtered.map((contract) => ({
      "Mã hợp đồng": contract.code,
      "Người lao động": workerName(contract.workerId),
      "Khách hàng / đơn vị sử dụng": contract.clientName,
      "Ngày bắt đầu": toDisplayDate(contract.startDate),
      "Ngày kết thúc": toDisplayDate(contract.endDate),
      "Trạng thái": workerContractStatusLabel[contract.status],
      "Kỳ số": contract.sequence,
      "Cảnh báo": contract.alertLevel === "ok" ? "" : alertText(contract.endDate),
      "Ghi chú": contract.note || "",
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Hợp đồng");
    XLSX.writeFile(
      workbook,
      `hop_dong_lao_dong_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}.xlsx`,
    );
    toast.success("Đã xuất file Excel thành công!");
  };

  if (!selectedCenter) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm font-semibold text-slate-500">
        Vui lòng chọn công ty để xem hợp đồng lao động.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-[#F8FBFF]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium text-slate-900">Hợp đồng lao động</h1>
        {(expiringCount > 0 || expiredCount > 0) && (
          <button
            type="button"
            aria-label={alertOnly ? "Xem tất cả hợp đồng" : "Chỉ xem hợp đồng cảnh báo"}
            aria-pressed={alertOnly}
            title={alertOnly ? "Xem tất cả hợp đồng" : "Chỉ xem hợp đồng cảnh báo"}
            onClick={() => setAlertOnly((value) => !value)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors ${expiredCount > 0 ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-amber-200 text-amber-800 hover:bg-amber-50"} ${alertOnly ? (expiredCount > 0 ? "bg-rose-50" : "bg-amber-50") : "bg-white"}`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {expiredCount > 0 && <span>{expiredCount} đã hết hạn</span>}
            {expiredCount > 0 && expiringCount > 0 && <span className="opacity-40">·</span>}
            {expiringCount > 0 && <span>{expiringCount} sắp hết hạn <span className="opacity-70">trong 30 ngày</span></span>}
            {alertOnly && <X className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
        )}
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#DCE7F4] bg-white p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm hợp đồng"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã, khách hàng, người lao động"
            className="h-10 w-full rounded-xl border border-[#DCE7F4] py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="min-w-40 flex-1 sm:flex-none sm:w-44"><StyledSelect ariaLabel="Lọc theo trạng thái" value={status} onChange={setStatus} options={[{ value: "all", label: "Tất cả trạng thái" }, ...Object.entries(workerContractStatusLabel).map(([value, label]) => ({ value, label }))]} /></div>
        <div className="min-w-40 flex-1 sm:flex-none sm:w-44"><StyledSelect ariaLabel="Lọc theo khách hàng" value={client} onChange={setClient} options={[{ value: "all", label: "Tất cả khách hàng" }, ...clients.map((name) => ({ value: name, label: name }))]} /></div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất Excel
        </button>
        {canManage && (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm hợp đồng
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#DCE7F4] bg-white">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="bg-[#E8F7FF] text-[13px] text-slate-600">
            <tr>
              <th className="px-3 py-2.5 font-medium">Mã hợp đồng</th>
              <th className="px-3 py-2.5 font-medium">Người lao động</th>
              <th className="px-3 py-2.5 font-medium">Khách hàng / đơn vị sử dụng</th>
              <th className="px-3 py-2.5 font-medium">Thời hạn</th>
              <th className="px-3 py-2.5 text-center font-medium">Trạng thái</th>
              <th className="px-3 py-2.5 text-center font-medium">Cảnh báo</th>
              <th className="px-3 py-2.5 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  Đang tải hợp đồng...
                </td>
              </tr>
            ) : !filtered.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  Chưa có hợp đồng nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              filtered.map((contract) => (
                <tr
                  key={contract._id}
                  className={
                    contract.alertLevel === "expired"
                      ? "bg-rose-50/60"
                      : contract.alertLevel === "expiring"
                        ? "bg-amber-50/60"
                        : undefined
                  }
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    <span className="flex items-center gap-1.5">
                      {contract.code}
                      {contract.lockedAt && (
                        <Lock className="h-3 w-3 text-slate-400" aria-label="Kỳ đã khóa" />
                      )}
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      Kỳ {contract.sequence}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {workerName(contract.workerId)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{contract.clientName}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {toDisplayDate(contract.startDate)} → {toDisplayDate(contract.endDate)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`rounded border px-2 py-0.5 text-xs ${
                        statusBadgeClass[contract.status]
                      }`}
                    >
                      {workerContractStatusLabel[contract.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {contract.alertLevel === "ok" ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <span
                        className={`rounded border px-2 py-0.5 text-xs ${
                          alertBadgeClass[contract.alertLevel]
                        }`}
                      >
                        {contract.alertLevel === "expired"
                          ? "Đã hết hạn"
                          : alertText(contract.endDate)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Lịch sử hợp đồng"
                        aria-label={`Lịch sử hợp đồng ${contract.code}`}
                        onClick={() => setHistoryOf(contract.rootContractId)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            title="Gia hạn"
                            aria-label={`Gia hạn hợp đồng ${contract.code}`}
                            disabled={
                              contract.status === "renewed" || contract.status === "terminated"
                            }
                            onClick={() => setModal({ mode: "renew", contract })}
                            className="rounded-lg p-1.5 text-cyan-600 hover:bg-cyan-50 disabled:opacity-30"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Chỉnh sửa"
                            aria-label={`Chỉnh sửa hợp đồng ${contract.code}`}
                            onClick={() => setModal({ mode: "edit", contract })}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!contract.lockedAt && contract.status !== "renewed" && (
                            <button
                              type="button"
                              title="Xóa"
                              aria-label={`Xóa hợp đồng ${contract.code}`}
                              onClick={() => void handleDelete(contract)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* Pagination Toolbar */}
        {total > limit && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
                className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-700">
                  Hiển thị từ <span className="font-medium">{(page - 1) * limit + 1}</span> đến{" "}
                  <span className="font-medium">{Math.min(page * limit, total)}</span> trong tổng số{" "}
                  <span className="font-medium">{total}</span> hợp đồng
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                  >
                    «
                  </button>
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.ceil(total / limit) }).map((_, idx) => {
                    const pageNum = idx + 1;
                    if (Math.abs(page - pageNum) > 2) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-xs font-semibold focus:z-20 ${
                          page === pageNum
                            ? "z-10 bg-cyan-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
                            : "text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-offset-0"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    disabled={page * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                  >
                    ›
                  </button>
                  <button
                    disabled={page * limit >= total}
                    onClick={() => setPage(Math.ceil(total / limit))}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                  >
                    »
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {historyOf && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Lịch sử các kỳ hợp đồng
            </h3>
            <button
              type="button"
              onClick={() => setHistoryOf(null)}
              className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
            >
              Đóng
            </button>
          </div>
          <WorkerContractHistory contracts={historyItems} />
        </div>
      )}

      <WorkerContractFormModal
        mode={modal?.mode || "create"}
        isOpen={Boolean(modal)}
        workers={workersAvailableForContract}
        contract={modal?.contract}
        onClose={() => setModal(null)}
        onSubmit={submitModal}
      />
    </div>
  );
}
