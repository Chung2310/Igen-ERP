import { Check, X } from "lucide-react";

type Adjustment = {
  _id: string;
  employeeName?: string;
  employeeId: string;
  kind: string;
  amount: number;
  reason: string;
  status: string;
};

export function PayrollReviewQueue({ adjustments, onApprove, onReject }: {
  adjustments: Adjustment[];
  onApprove: (adjustment: Adjustment) => void;
  onReject: (adjustment: Adjustment) => void;
}) {
  const pending = adjustments.filter((item) => item.status === "pending");
  if (!pending.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Không có điều chỉnh chờ duyệt.</p>;
  return <div className="space-y-2">{pending.map((item) => <div key={item._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
    <div className="min-w-0"><p className="font-semibold text-slate-800">{item.employeeName || item.employeeId}</p><p className="text-xs text-slate-500">{item.kind} · {item.reason}</p></div>
    <div className="flex shrink-0 items-center gap-2"><strong>{item.amount.toLocaleString()} đ</strong><button title="Duyệt điều chỉnh" onClick={() => onApprove(item)} className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button><button title="Từ chối điều chỉnh" onClick={() => onReject(item)} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"><X size={16} /></button></div>
  </div>)}</div>;
}
