import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
const permitted = (permissions: readonly string[], code: string) =>
  permissions.includes("*") || permissions.includes(code);

function CommandField({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {description && <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span>}
      {children}
    </label>
  );
}

function VndCommandInput({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  return (
    <CommandField label={label}>
      <input
        required
        aria-label={label}
        name="amount"
        type="text"
        inputMode="numeric"
        min={1}
        max={max}
        value={value ? new Intl.NumberFormat("vi-VN").format(value) : ""}
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, "")))}
        className="mt-1 w-full rounded-lg border p-2"
      />
    </CommandField>
  );
}

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
  const [collectAmount, setCollectAmount] = useState(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
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
  const isActive = receivable.status === "open" || receivable.status === "partially_paid";
  const minimumExtensionDate = new Date(receivable.dueDate);
  minimumExtensionDate.setUTCDate(minimumExtensionDate.getUTCDate() + 1);
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
        {canCollect && isActive && receivable.balance > 0 && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (collectAmount < 1 || collectAmount > receivable.balance) {
                setError("Số tiền thu phải lớn hơn 0 và không vượt quá số dư công nợ.");
                return;
              }
              const form = new FormData(event.currentTarget);
              void mutate(() =>
                financeReceivablesApi.collect(id, {
                  amount: collectAmount,
                  paymentMethod: "transfer",
                  reference: String(form.get("reference") || ""),
                  idempotencyKey: crypto.randomUUID(),
                }),
              );
            }}
            className="space-y-2 rounded-xl border p-3"
          >
            <h3 className="font-bold">Thu tiền</h3>
            <VndCommandInput label="Số tiền thu" value={collectAmount} onChange={setCollectAmount} max={receivable.balance} />
            <CommandField label="Mã tham chiếu" description="Không bắt buộc, dùng để đối soát giao dịch.">
              <input
                aria-label="Mã tham chiếu"
                name="reference"
                className="mt-1 w-full rounded-lg border p-2"
              />
            </CommandField>
            <button
              disabled={busy}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white"
            >
              Thu tiền
            </button>
          </form>
        )}
        {canAdjust && isActive && (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate(() =>
                  financeReceivablesApi.adjust(id, {
                    amount: adjustmentAmount,
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
              <VndCommandInput label="Số tiền điều chỉnh" value={adjustmentAmount} onChange={setAdjustmentAmount} />
              <CommandField label="Hướng điều chỉnh">
                <select aria-label="Hướng điều chỉnh" name="direction" className="mt-1 w-full rounded-lg border p-2">
                  <option value="increase">Tăng nợ</option>
                  <option value="decrease">Giảm nợ</option>
                </select>
              </CommandField>
              <CommandField label="Lý do điều chỉnh">
                <input required aria-label="Lý do điều chỉnh" name="reason" className="mt-1 w-full rounded-lg border p-2" />
              </CommandField>
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
                  financeReceivablesApi.extend(id, {
                    dueDate: new Date(
                      `${form.get("dueDate")}T23:59:59.999Z`,
                    ).toISOString(),
                    reason: String(form.get("reason")),
                    idempotencyKey: crypto.randomUUID(),
                  }),
                );
              }}
              className="space-y-2 rounded-xl border p-3"
            >
              <h3 className="font-bold">Gia hạn công nợ</h3>
              <CommandField label="Gia hạn đến ngày">
                <input required aria-label="Gia hạn đến ngày" name="dueDate" type="date" min={minimumExtensionDate.toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border p-2" />
              </CommandField>
              <CommandField label="Lý do gia hạn">
                <input required aria-label="Lý do gia hạn" name="reason" className="mt-1 w-full rounded-lg border p-2" />
              </CommandField>
              <button
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm font-bold"
              >
                Gia hạn công nợ
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
            canReverse={canAdjust && isActive}
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
  const entryLabel = (() => {
    if (entry.type === "adjustment") return entry.amount >= 0 ? "Điều chỉnh tăng" : "Điều chỉnh giảm";
    return {
      charge: "Phát sinh công nợ",
      payment: "Thu tiền",
      refund: "Hoàn tiền",
      write_off: "Xóa nợ",
      reversal: "Đảo bút toán",
      due_date_extension: "Gia hạn công nợ",
    }[entry.type] || entry.type;
  })();
  const extensionDates = entry.previousDueDate && entry.newDueDate
    ? `${new Date(entry.previousDueDate).toLocaleDateString("vi-VN")} → ${new Date(entry.newDueDate).toLocaleDateString("vi-VN")}`
    : "";
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 p-3 text-sm">
      <div>
        <p className="font-semibold">
          {entryLabel}{entry.type === "due_date_extension" ? extensionDates && ` · ${extensionDates}` : ` · ${money.format(entry.amount)}`}
        </p>
        <p className="text-slate-500">
          {entry.reason || "Không có lý do"} ·{" "}
          {new Date(entry.createdAt).toLocaleString("vi-VN")} · {entry.createdByName || "Hệ thống"}
        </p>
      </div>
      {canReverse && entry.type !== "reversal" && entry.type !== "due_date_extension" && !entry.reversalOfEntryId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onReverse(String(new FormData(event.currentTarget).get("reason")));
          }}
          className="flex gap-2"
        >
          <CommandField label="Lý do đảo bút toán" description="Được lưu vào lịch sử kiểm toán.">
            <input required name="reason" aria-label="Lý do đảo bút toán" className="mt-1 w-40 rounded-lg border px-2 py-1" />
          </CommandField>
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
