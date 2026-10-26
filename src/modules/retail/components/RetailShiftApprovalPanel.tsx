import { useState } from "react";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailScope, RetailShift } from "../types";

export function RetailShiftApprovalPanel({ scope, shifts, onReconciled }: { scope: RetailScope; shifts: RetailShift[]; onReconciled: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pending = shifts.filter((shift) => shift.status === "closed");
  if (!pending.length) return null;

  async function approve(id: string) {
    setBusyId(id);
    setError("");
    try {
      const shift = shifts.find(row => row._id === id);
      if (shift?.countedCash == null) throw new Error("Missing counted cash");
      await retailShiftsApi.reconcile(scope, id, { countedCash: shift.countedCash, varianceReason: shift.varianceReason });
      setSelectedId(null);
      onReconciled();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không duyệt được ca bán hàng.");
    } finally {
      setBusyId(null);
    }
  }

  return <section aria-labelledby="retail-shift-approval-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <h2 id="retail-shift-approval-title" className="text-balance text-lg font-semibold text-on-surface">Ca chờ đối soát</h2>
    <p className="mt-1 text-pretty text-sm text-on-surface-variant">Kiểm tra tiền thực đếm và lý do chênh lệch trước khi duyệt.</p>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    <ul className="mt-3 divide-y divide-outline-variant">{pending.map((shift) => <li key={shift._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="text-sm text-on-surface"><strong>{shift.shiftCode}</strong><p>{shift.cashierName} · {shift.businessDate}</p><p className="tabular-nums">Thực đếm: {(shift.countedCash || 0).toLocaleString("vi-VN")} ₫ · Chênh lệch: {(shift.varianceAmount || 0).toLocaleString("vi-VN")} ₫</p>{shift.varianceReason && <p className="text-pretty text-on-surface-variant">Lý do: {shift.varianceReason}</p>}</div>
      <button type="button" disabled={busyId !== null} onClick={() => { setError(""); setSelectedId(shift._id); }} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{busyId === shift._id ? "Đang duyệt..." : "Duyệt đối soát"}</button>
    </li>)}</ul>
    <ConfirmDialog
      isOpen={selectedId !== null}
      isSubmitting={busyId !== null}
      title="Xác nhận đối soát ca"
      description={error || "Sau khi duyệt, ca được đánh dấu đã đối soát và không thể duyệt lại. Hãy kiểm tra tiền thực đếm và lý do chênh lệch."}
      confirmLabel="Duyệt đối soát"
      tone="warning"
      onClose={() => setSelectedId(null)}
      onConfirm={() => selectedId ? approve(selectedId) : undefined}
    />
  </section>;
}
