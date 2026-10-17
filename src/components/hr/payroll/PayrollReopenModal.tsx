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
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
    <div role="dialog" aria-modal="true" aria-labelledby="payroll-reopen-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_20px_60px_rgba(13,48,78,0.2)]">
      <h3 id="payroll-reopen-title" className="text-base font-medium text-[#143963]">Mở lại kỳ lương</h3>
      <p className="mt-1 text-sm text-slate-500">Kỳ lương sẽ quay về Nháp. Lý do được lưu trong lịch sử kiểm toán.</p>
      <label htmlFor="payroll-reopen-reason" className="mt-4 block text-sm font-normal text-slate-700">Lý do mở lại</label>
      <textarea id="payroll-reopen-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1000} className="mt-2 w-full rounded-xl border border-[#DCE7F4] p-3 text-sm text-slate-700 outline-none transition-colors focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15" />
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-[#DCE7F4] px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-[#F8FBFE]">Hủy</button>
        <button type="button" onClick={() => onConfirm(normalized)} disabled={loading || !normalized} className="rounded-xl bg-[#00A4E8] px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-[#008FCB] disabled:opacity-40">Mở lại kỳ</button>
      </div>
    </div>
  </div>;
}
