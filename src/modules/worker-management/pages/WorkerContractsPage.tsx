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
} from "lucide-react";
import { toast } from "../../../pages/Toast";
import { useWorkerLaborContracts } from "../hooks/useWorkerLaborContracts";
import { useWorkers } from "../hooks/useWorkers";
import { WorkerContractFormModal, type ContractFormMode } from "../components/WorkerContractFormModal";
import { WorkerContractHistory } from "../components/WorkerContractHistory";
import { alertText, resolveAlertLevel, toDisplayDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
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
  const { contracts, loading, error, createContract, updateContract, renewContract, deleteContract } =
    useWorkerLaborContracts(scope);
  const { workers } = useWorkers(scope);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [client, setClient] = React.useState("all");
  const [alertOnly, setAlertOnly] = React.useState(initialAlertOnly);
  const [modal, setModal] = React.useState<{
    mode: ContractFormMode;
    contract?: WorkerLaborContract | null;
  } | null>(null);
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

  const clients = React.useMemo(
    () => Array.from(new Set(decorated.map((item) => item.clientName).filter(Boolean))).sort(),
    [decorated],
  );

  const filtered = React.useMemo(
    () =>
      decorated.filter((contract) => {
        if (status !== "all" && contract.status !== status) return false;
        if (client !== "all" && contract.clientName !== client) return false;
        if (alertOnly && contract.alertLevel === "ok") return false;
        if (search.trim()) {
          const keyword = search.trim().toLowerCase();
          const haystack = `${contract.code} ${contract.clientName} ${workerName(
            contract.workerId,
          )}`.toLowerCase();
          if (!haystack.includes(keyword)) return false;
        }
        return true;
      }),
    [alertOnly, client, decorated, search, status, workerName],
  );

  const expiringCount = decorated.filter((item) => item.alertLevel === "expiring").length;
  const expiredCount = decorated.filter((item) => item.alertLevel === "expired").length;

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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-slate-50 p-3 sm:p-5">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          {error}
        </div>
      )}

      {(expiringCount > 0 || expiredCount > 0) && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {expiredCount > 0 && `${expiredCount} hợp đồng đã hết hạn. `}
            {expiringCount > 0 && `${expiringCount} hợp đồng sẽ hết hạn trong 30 ngày tới.`}
          </span>
          <button
            type="button"
            onClick={() => setAlertOnly((value) => !value)}
            className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800"
          >
            {alertOnly ? "Xem tất cả" : "Chỉ xem hợp đồng cảnh báo"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm hợp đồng"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã, khách hàng, người lao động"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs"
          />
        </div>
        <select
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(workerContractStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo khách hàng"
          value={client}
          onChange={(event) => setClient(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">Tất cả khách hàng</option>
          {clients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 font-bold">Mã hợp đồng</th>
              <th className="px-3 py-2 font-bold">Người lao động</th>
              <th className="px-3 py-2 font-bold">Khách hàng / đơn vị sử dụng</th>
              <th className="px-3 py-2 font-bold">Thời hạn</th>
              <th className="px-3 py-2 text-center font-bold">Trạng thái</th>
              <th className="px-3 py-2 text-center font-bold">Cảnh báo</th>
              <th className="px-3 py-2 text-right font-bold">Thao tác</th>
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
                  <td className="px-3 py-2 font-bold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      {contract.code}
                      {contract.lockedAt && (
                        <Lock className="h-3 w-3 text-slate-400" aria-label="Kỳ đã khóa" />
                      )}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Kỳ {contract.sequence}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-600">
                    {workerName(contract.workerId)}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-600">{contract.clientName}</td>
                  <td className="px-3 py-2 font-medium text-slate-500">
                    {toDisplayDate(contract.startDate)} → {toDisplayDate(contract.endDate)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                        statusBadgeClass[contract.status]
                      }`}
                    >
                      {workerContractStatusLabel[contract.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {contract.alertLevel === "ok" ? (
                      <span className="text-[10px] text-slate-300">—</span>
                    ) : (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                          alertBadgeClass[contract.alertLevel]
                        }`}
                      >
                        {contract.alertLevel === "expired"
                          ? "Đã hết hạn"
                          : alertText(contract.endDate)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
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
        workers={workers}
        contract={modal?.contract}
        onClose={() => setModal(null)}
        onSubmit={submitModal}
      />
    </div>
  );
}
