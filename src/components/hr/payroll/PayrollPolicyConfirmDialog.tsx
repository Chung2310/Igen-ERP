import { AlertTriangle, X } from "lucide-react";

type Props = {
  title: string; description: string; impact?: string; confirmLabel: string;
  tone: "warning" | "danger"; pending: boolean; error?: string;
  onCancel: () => void; onConfirm: () => void;
};

export function PayrollPolicyConfirmDialog({ title, description, impact, confirmLabel, tone, pending, error, onCancel, onConfirm }: Props) {
  const danger = tone === "danger";
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="payroll-policy-confirm-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
      <div className="flex items-start gap-3"><div className={`rounded-full p-2 ${danger ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}><AlertTriangle size={20}/></div><div className="min-w-0 flex-1"><h3 id="payroll-policy-confirm-title" className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div><button aria-label="Đóng" disabled={pending} onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={18}/></button></div>
      {impact && <div className={`mt-4 rounded-xl border p-3 text-sm ${danger ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{impact}</div>}
      {error && <div role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="mt-5 flex justify-end gap-2"><button disabled={pending} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">Hủy</button><button disabled={pending} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}>{pending ? "Đang xử lý..." : confirmLabel}</button></div>
    </div>
  </div>;
}
