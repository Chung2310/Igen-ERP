import React from "react";
import { retailReceivablesApi } from "../../api/retailReceivables.api";
import type { RetailReceivableEntry, RetailScope } from "../../types";
import RetailCustomerTierPanel from "./RetailCustomerTierPanel";

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const labels: Record<RetailReceivableEntry["type"], string> = { charge: "Phát sinh nợ", payment: "Thu nợ", adjustment: "Điều chỉnh", reversal: "Đảo bút toán" };
const adjustmentKey = () => `adjustment:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;

export default function RetailReceivableHistory({ scope, customerId, canManage }: { scope: RetailScope; customerId: string; canManage: boolean }) {
  const [type, setType] = React.useState("");
  const [items, setItems] = React.useState<RetailReceivableEntry[]>([]);
  const [balance, setBalance] = React.useState(0);
  const [error, setError] = React.useState("");
  const [adjusting, setAdjusting] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [direction, setDirection] = React.useState<"increase" | "decrease">("increase");
  const [idempotencyKey, setIdempotencyKey] = React.useState("");
  const load = React.useCallback(async () => {
    try {
      const result = await retailReceivablesApi.history(scope, customerId, { type: type || undefined });
      setItems(result.items); setBalance(result.currentBalance); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được lịch sử công nợ."); }
  }, [scope.companyCode, scope.branchId, customerId, type]);
  React.useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    try {
      await retailReceivablesApi.adjust(scope, { customerId, amount: Number(amount), reason, direction, idempotencyKey });
      setAdjusting(false); setAmount(""); setReason(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không điều chỉnh được công nợ."); }
  };
  const openAdjustment = () => { setIdempotencyKey(adjustmentKey()); setAdjusting(true); };

  return <section className="mt-6 space-y-3 border-t pt-5">
    <div className="flex items-center justify-between">
      <div><h3 className="font-bold">Lịch sử công nợ</h3><p className="text-sm text-slate-500">Số dư hiện tại: <b>{money(balance)}</b></p></div>
      {canManage && <button type="button" onClick={openAdjustment} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white">Điều chỉnh công nợ</button>}
    </div>
    <select aria-label="Loại bút toán" value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tất cả</option><option value="charge">Phát sinh nợ</option><option value="payment">Thu nợ</option><option value="adjustment">Điều chỉnh</option><option value="reversal">Đảo bút toán</option></select>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="space-y-2">{items.map((entry) => <article key={entry._id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between"><b>{labels[entry.type]}</b><span className={entry.signedAmount < 0 ? "text-emerald-700" : "text-amber-700"}>{money(entry.signedAmount)}</span></div><div className="mt-1 flex justify-between text-xs text-slate-500"><span>{entry.reason || new Date(entry.createdAt).toLocaleDateString("vi-VN")}</span><span>{money(entry.runningBalance)}</span></div></article>)}</div>
    {adjusting && <div role="dialog" aria-label="Điều chỉnh công nợ" className="space-y-3 rounded-xl border p-4">
      <select aria-label="Hướng điều chỉnh" value={direction} onChange={(event) => setDirection(event.target.value as "increase" | "decrease")} className="w-full rounded-lg border px-3 py-2"><option value="increase">Tăng công nợ</option><option value="decrease">Giảm công nợ</option></select>
      <input aria-label="Số tiền điều chỉnh" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-lg border px-3 py-2" />
      <input aria-label="Lý do điều chỉnh" value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border px-3 py-2" />
      <div className="flex gap-2"><button type="button" onClick={() => void submit()} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-bold text-white">Xác nhận điều chỉnh</button><button type="button" onClick={() => setAdjusting(false)} className="rounded-lg border px-3 py-2 text-sm">Hủy</button></div>
    </div>}
    <RetailCustomerTierPanel scope={scope} customerId={customerId} canManage={canManage} />
  </section>;
}
