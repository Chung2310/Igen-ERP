import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  financeReceivablesApi,
  type ReceivableDetail,
  type ReceivableEntry,
} from "../api/financeReceivables.api";
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const today = new Date().toISOString().slice(0, 10);
const permitted = (permissions: readonly string[], code: string) =>
  permissions.includes("*") || permissions.includes(code);

export default function ReceivableDetailDrawer({
  id,
  permissions,
  onClose,
  onChanged,
}: {
  id: string;
  permissions: readonly string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ReceivableDetail>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setDetail(await financeReceivablesApi.detail(id));
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tải được chi tiết.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, [id]);
  const mutate = async (command: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await command();
      await load();
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể cập nhật công nợ.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!detail)
    return (
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l bg-white p-6 shadow-2xl">
        {error || "Đang tải chi tiết..."}
      </aside>
    );
  const { receivable, entries } = detail;
  const canCollect = permitted(permissions, "receivable:collect");
  const canAdjust = permitted(permissions, "receivable:adjust");
  return (
    <aside
      aria-label="Chi tiết công nợ"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto border-l bg-white p-6 shadow-2xl"
    >
      <button
        type="button"
        aria-label="Đóng chi tiết"
        onClick={onClose}
        className="float-right"
      >
        <X />
      </button>
      <h2 className="text-xl font-bold">{receivable.receivableCode}</h2>
      <p className="text-sm text-slate-500">{receivable.customerName}</p>
      {receivable.sourceCode && (
        <a
          href={`/ban-le?sub=don-hang&orderId=${encodeURIComponent(receivable.sourceId || "")}`}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700"
        >
          {receivable.sourceCode}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Phát sinh", receivable.originalAmount],
          ["Đã thu", receivable.paidAmount],
          ["Điều chỉnh", receivable.adjustedAmount],
          ["Còn nợ", receivable.balance],
        ].map(([label, amount]) => (
          <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-bold">{money.format(Number(amount))}</p>
          </div>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {canCollect && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void mutate(() =>
                financeReceivablesApi.collect(id, {
                  amount: Number(form.get("amount")),
                  paymentMethod: "transfer",
                  reference: String(form.get("reference") || ""),
                  idempotencyKey: crypto.randomUUID(),
                }),
              );
            }}
            className="space-y-2 rounded-xl border p-3"
          >
            <h3 className="font-bold">Thu tiền</h3>
            <input
              required
              aria-label="Số tiền thu"
              name="amount"
              type="number"
              min={1}
              max={receivable.balance}
              className="w-full rounded-lg border p-2"
            />
            <input
              aria-label="Mã tham chiếu"
              name="reference"
              className="w-full rounded-lg border p-2"
            />
            <button
              disabled={busy}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white"
            >
              Thu tiền
            </button>
          </form>
        )}
        {canAdjust && (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate(() =>
                  financeReceivablesApi.adjust(id, {
                    amount: Number(form.get("amount")),
                    direction: String(form.get("direction")) as
                      "increase" | "decrease",
                    reason: String(form.get("reason")),
                    idempotencyKey: crypto.randomUUID(),
                  }),
                );
              }}
              className="space-y-2 rounded-xl border p-3"
            >
              <h3 className="font-bold">Điều chỉnh</h3>
              <input
                required
                name="amount"
                type="number"
                min={1}
                className="w-full rounded-lg border p-2"
              />
              <select name="direction" className="w-full rounded-lg border p-2">
                <option value="increase">Tăng nợ</option>
                <option value="decrease">Giảm nợ</option>
              </select>
              <input
                required
                aria-label="Lý do điều chỉnh"
                name="reason"
                className="w-full rounded-lg border p-2"
              />
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm font-bold"
              >
                Điều chỉnh
              </button>
            </form>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate(() =>
                  financeReceivablesApi.suspend(id, {
                    until: new Date(
                      `${form.get("until")}T23:59:59.999Z`,
                    ).toISOString(),
                    reason: String(form.get("reason")),
                  }),
                );
              }}
              className="space-y-2 rounded-xl border p-3"
            >
              <h3 className="font-bold">Tạm dừng nhắc nợ</h3>
              <input
                required
                aria-label="Tạm dừng đến ngày"
                name="until"
                type="date"
                min={today}
                className="w-full rounded-lg border p-2"
              />
              <input
                required
                name="reason"
                placeholder="Lý do"
                className="w-full rounded-lg border p-2"
              />
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm font-bold"
              >
                Tạm dừng
              </button>
            </form>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const reason = String(
                  new FormData(event.currentTarget).get("reason"),
                );
                void mutate(() => financeReceivablesApi.writeOff(id, reason));
              }}
              className="space-y-2 rounded-xl border p-3"
            >
              <h3 className="font-bold">Xóa nợ</h3>
              <input
                required
                name="reason"
                placeholder="Lý do xóa nợ"
                className="w-full rounded-lg border p-2"
              />
              <button
                disabled={busy}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
              >
                Xóa nợ
              </button>
            </form>
          </>
        )}
      </div>
      <h3 className="mt-7 font-bold">Sổ chi tiết bất biến</h3>
      <div className="mt-2 divide-y rounded-xl border">
        {[...entries].reverse().map((entry) => (
          <LedgerRow
            key={entry._id}
            entry={entry}
            canReverse={canAdjust}
            onReverse={(reason) =>
              mutate(() => financeReceivablesApi.reverse(id, entry._id, reason))
            }
          />
        ))}
      </div>
    </aside>
  );
}
function LedgerRow({
  entry,
  canReverse,
  onReverse,
}: {
  entry: ReceivableEntry;
  canReverse: boolean;
  onReverse: (reason: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm">
      <div>
        <p className="font-semibold">
          {entry.type} · {money.format(entry.amount)}
        </p>
        <p className="text-slate-500">
          {entry.reason || "Không có lý do"} ·{" "}
          {new Date(entry.createdAt).toLocaleString("vi-VN")}
        </p>
      </div>
      {canReverse && entry.type !== "reversal" && !entry.reversalOfEntryId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onReverse(String(new FormData(event.currentTarget).get("reason")));
          }}
          className="flex gap-2"
        >
          <input
            required
            name="reason"
            aria-label="Lý do đảo bút toán"
            className="w-32 rounded-lg border px-2"
          />
          <button
            className="text-xs font-bold text-amber-700"
            aria-label={`Đảo bút toán ${entry._id}`}
          >
            Đảo bút toán
          </button>
        </form>
      )}
    </div>
  );
}
