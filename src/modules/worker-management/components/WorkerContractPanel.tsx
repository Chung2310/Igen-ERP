import React from "react";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { useWorkerLaborContracts } from "../hooks/useWorkerLaborContracts";
import { WorkerContractFormModal, type ContractFormMode } from "./WorkerContractFormModal";
import { WorkerContractHistory } from "./WorkerContractHistory";
import { alertText, resolveAlertLevel, toDisplayDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
import type { Worker, WorkerLaborContract, WorkerLaborContractInput, WorkerScope } from "../types";

type Props = {
  worker: Worker;
  scope?: WorkerScope;
  canManage?: boolean;
};

/** Kỳ đang chạy = kỳ mới nhất chưa bị gia hạn/chấm dứt. */
function currentPeriod(contracts: WorkerLaborContract[]) {
  return (
    [...contracts]
      .filter((item) => item.status !== "renewed" && item.status !== "terminated")
      .sort((a, b) => (b.sequence || 0) - (a.sequence || 0))[0] || null
  );
}

export function WorkerContractPanel({ worker, scope, canManage = false }: Props) {
  const { contracts, loading, error, createContract, renewContract } = useWorkerLaborContracts(
    scope,
    worker._id,
  );
  const [modal, setModal] = React.useState<{
    mode: ContractFormMode;
    contract?: WorkerLaborContract | null;
  } | null>(null);

  const current = currentPeriod(contracts);
  const alertLevel = current
    ? current.alertLevel || resolveAlertLevel(current.endDate, current.status)
    : "ok";

  const submit = async (input: WorkerLaborContractInput) => {
    if (modal?.mode === "renew" && modal.contract) {
      await renewContract(modal.contract._id, input);
      toast.success("Đã tạo kỳ gia hạn. Kỳ cũ được giữ nguyên và khóa lại.");
      return;
    }
    await createContract({ ...input, workerId: worker._id });
    toast.success("Đã thêm hợp đồng.");
  };

  return (
    <div className="space-y-4 overflow-y-auto p-6 text-sm sm:p-8">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          {error}
        </div>
      )}

      {alertLevel !== "ok" && current && (
        <div
          role="alert"
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
            alertLevel === "expired"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {alertLevel === "expired"
            ? `Hợp đồng ${current.code} đã hết hạn ngày ${toDisplayDate(current.endDate)}.`
            : `Hợp đồng ${current.code} sắp hết hạn — ${alertText(current.endDate)}.`}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
            Hợp đồng hiện hành
          </h3>
          {canManage && (
            <div className="flex items-center gap-2">
              {current && (
                <button
                  type="button"
                  onClick={() => setModal({ mode: "renew", contract: current })}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Gia hạn
                </button>
              )}
              <button
                type="button"
                onClick={() => setModal({ mode: "create" })}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm hợp đồng
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <p className="text-xs font-medium text-slate-400">Đang tải hợp đồng...</p>
        ) : current ? (
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <Detail label="Mã hợp đồng" value={current.code} />
            <Detail label="Khách hàng / đơn vị sử dụng" value={current.clientName} />
            <Detail label="Ngày bắt đầu" value={toDisplayDate(current.startDate)} />
            <Detail label="Ngày kết thúc" value={toDisplayDate(current.endDate)} />
            <Detail label="Trạng thái" value={workerContractStatusLabel[current.status]} />
            <Detail label="Kỳ số" value={String(current.sequence)} />
            {current.note && <Detail label="Ghi chú" value={current.note} />}
          </div>
        ) : (
          <p className="text-xs font-medium text-slate-400">
            Người lao động này chưa có hợp đồng đang hiệu lực.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-800">
          Lịch sử hợp đồng
        </h3>
        <WorkerContractHistory contracts={contracts} />
      </div>

      <WorkerContractFormModal
        mode={modal?.mode || "create"}
        isOpen={Boolean(modal)}
        workers={[worker]}
        contract={modal?.contract}
        lockedWorkerId={worker._id}
        onClose={() => setModal(null)}
        onSubmit={submit}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="font-semibold text-slate-700">{value}</p>
    </div>
  );
}

export default WorkerContractPanel;
