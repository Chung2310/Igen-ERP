import { AlertTriangle, X } from "lucide-react";

type Props = {
  title: string; description: string; impact?: string; confirmLabel: string;
  cancelLabel?: string;
  tone: "warning" | "danger"; pending: boolean; error?: string;
  secondaryLabel?: string; onSecondary?: () => void;
  onCancel: () => void; onConfirm: () => void;
};

export function PayrollPolicyConfirmDialog({ title, description, impact, confirmLabel, cancelLabel = "Hủy", secondaryLabel, tone, pending, error, onCancel, onConfirm, onSecondary }: Props) {
  const danger = tone === "danger";
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="payroll-policy-confirm-title" className="w-full max-w-md rounded-2xl border border-[#DCE7F4] bg-white p-5 shadow-[0_20px_60px_rgba(13,48,78,0.2)]">
      <div className="flex items-start gap-3"><div className={`rounded-full p-2 ${danger ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}><AlertTriangle size={20}/></div><div className="min-w-0 flex-1"><h3 id="payroll-policy-confirm-title" className="font-normal text-slate-800">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div><button aria-label="Đóng" disabled={pending} onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600 disabled:opacity-40"><X size={18}/></button></div>
      {impact && <div className={`mt-4 rounded-xl border p-3 text-sm ${danger ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{impact}</div>}
      {error && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button disabled={pending} onClick={onCancel} className="rounded-xl border border-[#DCE7F4] bg-white px-4 py-2 text-sm font-normal text-slate-700 disabled:opacity-40">{cancelLabel}</button>{secondaryLabel && onSecondary && <button disabled={pending} onClick={onSecondary} className="rounded-lg border border-[#B8E8FF] bg-[#F1FAFE] px-4 py-2 text-sm font-normal text-[#007EB8] disabled:opacity-40">{secondaryLabel}</button>}<button disabled={pending} onClick={onConfirm} className={`rounded-xl px-4 py-2 text-sm font-normal text-white disabled:opacity-50 ${danger ? "bg-rose-500 hover:bg-rose-600" : "bg-[#00A4E8] hover:bg-[#008FCB]"}`}>{pending ? "Đang xử lý..." : confirmLabel}</button></div>
    </div>
  </div>;
}
