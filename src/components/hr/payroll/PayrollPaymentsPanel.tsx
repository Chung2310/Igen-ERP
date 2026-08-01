import { Check, CirclePlus, RotateCcw, X } from "lucide-react";
import { useState } from "react";

type Payment = { _id: string; amount: number; status: "draft" | "confirmed" | "cancelled" | "reversed"; paymentDate?: string };

export function PayrollPaymentsPanel({ payments, onConfirm, onCancel, onReverse, onCreate }: {
  payments: Payment[];
  onConfirm: (payment: Payment) => void;
  onCancel: (payment: Payment) => void;
  onReverse: (payment: Payment) => void;
  onCreate?: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const submit = () => { const value = Number(amount); if (Number.isInteger(value) && value > 0) { onCreate?.(value); setAmount(""); } };
  return <div className="space-y-2">
    {onCreate && <div className="flex items-end gap-2"><label className="flex-1 text-xs text-slate-600">Số tiền thanh toán<input aria-label="Số tiền thanh toán" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" /></label><button type="button" title="Tạo đợt thanh toán" onClick={submit} className="p-2 text-blue-600"><CirclePlus size={18} /></button></div>}
    {!payments.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có đợt thanh toán.</p>}
    {payments.map((payment) => <div key={payment._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div><p className="font-semibold">{payment.amount.toLocaleString()} đ</p><p className="text-xs text-slate-500">{payment.status}{payment.paymentDate ? " · " + payment.paymentDate : ""}</p></div>
      <div className="flex gap-1">{payment.status === "draft" && <><button title="Xác nhận thanh toán" onClick={() => onConfirm(payment)} className="p-1.5 text-emerald-600"><Check size={16} /></button><button title="Hủy thanh toán" onClick={() => onCancel(payment)} className="p-1.5 text-rose-600"><X size={16} /></button></>}{payment.status === "confirmed" && <button title="Hoàn tác thanh toán" onClick={() => onReverse(payment)} className="p-1.5 text-amber-600"><RotateCcw size={16} /></button>}</div>
    </div>)}
  </div>;
}

