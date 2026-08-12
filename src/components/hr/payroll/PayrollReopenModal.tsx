import { useEffect, useState } from "react";

export function PayrollReopenModal({ open, loading, onCancel, onConfirm }: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);
  if (!open) return null;
  const normalized = reason.trim();
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="payroll-reopen-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <h3 id="payroll-reopen-title" className="text-base font-bold text-slate-900">Mở lại kỳ lương</h3>
      <p className="mt-1 text-sm text-slate-500">Kỳ lương sẽ quay về Nháp. Lý do được lưu trong lịch sử kiểm toán.</p>
      <label htmlFor="payroll-reopen-reason" className="mt-4 block text-sm font-semibold text-slate-700">Lý do mở lại</label>
      <textarea id="payroll-reopen-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1000} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500" />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">Hủy</button>
        <button type="button" onClick={() => onConfirm(normalized)} disabled={loading || !normalized} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-40">Mở lại kỳ</button>
      </div>
    </div>
  </div>;
}
