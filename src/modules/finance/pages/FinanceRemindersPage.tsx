import { useEffect, useState } from "react";
import {
  financeRemindersApi,
  type ReminderRun,
  type ReminderRunDetail,
} from "../api/financeReminders.api";
const permitted = (permissions: readonly string[]) =>
  permissions.includes("*") || permissions.includes("receivable:adjust");
export default function FinanceRemindersPage({
  permissions,
}: {
  permissions: readonly string[];
}) {
  const [runs, setRuns] = useState<ReminderRun[]>([]);
  const [selected, setSelected] = useState<ReminderRunDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canAdjust = permitted(permissions);
  const load = async () => {
    try {
      setRuns(await financeRemindersApi.listRuns());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không tải được lịch sử nhắc nợ.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const open = async (id: string) => {
    try {
      setSelected(await financeRemindersApi.getRun(id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tải được delivery.",
      );
    }
  };
  const runNow = async () => {
    setBusy(true);
    try {
      await financeRemindersApi.runNow();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không chạy được nhắc nợ.",
      );
    } finally {
      setBusy(false);
    }
  };
  const retry = async (id: string) => {
    setBusy(true);
    try {
      await financeRemindersApi.retry(id);
      if (selected) await open(selected._id);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không retry được delivery.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Nhắc nợ quá hạn</h1>
          <p className="text-sm text-slate-500">
            Lịch sử quét, delivery và retry theo từng kênh.
          </p>
        </div>
        {canAdjust && (
          <button
            type="button"
            onClick={runNow}
            disabled={busy}
            className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Chạy nhắc nợ
          </button>
        )}
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y">
          {runs.map((run) => (
            <button
              key={run._id}
              type="button"
              aria-label={`${run.businessDate} ${run.trigger}`}
              onClick={() => void open(run._id)}
              className="grid w-full grid-cols-2 gap-2 p-4 text-left text-sm hover:bg-slate-50 sm:grid-cols-6"
            >
              <b>{run.businessDate}</b>
              <span>{run.trigger === "manual" ? "Thủ công" : "Tự động"}</span>
              <span>{run.status}</span>
              <span>Đủ: {run.eligible}</span>
              <span>Đợi: {run.queued}</span>
              <span>Lỗi: {run.failed}</span>
            </button>
          ))}
          {!runs.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              Chưa có lượt nhắc nợ.
            </p>
          )}
        </div>
      </div>
      {selected && (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <h2 className="border-b p-4 font-bold">
            Delivery ngày {selected.businessDate}
          </h2>
          <div className="divide-y">
            {selected.deliveries.map((delivery) => (
              <div
                key={delivery._id}
                className="grid grid-cols-[1fr_auto] gap-3 p-4 text-sm"
              >
                <div>
                  <b>{delivery.channel}</b>
                  <p>
                    {delivery.status} · lần {delivery.attempt}/
                    {delivery.maxAttempts}
                  </p>
                  {delivery.error && (
                    <p className="text-red-700">{delivery.error}</p>
                  )}
                </div>
                {canAdjust && delivery.status === "failed" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void retry(delivery._id)}
                    aria-label={`Retry ${delivery._id}`}
                    className="font-bold text-cyan-700"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
