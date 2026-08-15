import React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { buildPaymentSummary, type RetailPaymentMode } from "../../hooks/retailPayment";
import type { RetailPaymentInput } from "../../types";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
type Props = { total: number; busy: boolean; customerId?: string; onClose: () => void; onSubmit: (payments: RetailPaymentInput[], dueDate?: string) => Promise<void> };
const modes: Array<{ value: RetailPaymentMode; label: string }> = [{ value: "full", label: "Thanh toán đủ" }, { value: "partial", label: "Thanh toán một phần" }, { value: "debt", label: "Ghi nợ toàn bộ" }];

export default function ExplicitPaymentDialog({ total, busy, customerId, onClose, onSubmit }: Props) {
  const fullCash = (): RetailPaymentInput[] => [{ method: "cash", amount: total, tenderedAmount: total }];
  const [mode, setMode] = React.useState<RetailPaymentMode>("full");
  const [payments, setPayments] = React.useState<RetailPaymentInput[]>(fullCash);
  const [dueDate, setDueDate] = React.useState("");
  const [error, setError] = React.useState("");
  const submitted = mode === "debt" ? [] : payments.filter((item) => item.amount > 0);
  const collected = submitted.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0);
  const summary = React.useMemo(() => { try { return buildPaymentSummary(total, submitted, { mode, customerId, dueDate }); } catch { return { collected, due: mode === "debt" ? total : Math.max(0, total - collected), change: 0 }; } }, [total, payments, mode, customerId, dueDate]);
  const selectMode = (next: RetailPaymentMode) => { setMode(next); setError(""); if (next === "full") setPayments(fullCash()); else if (next !== "debt" && payments.length === 0) setPayments(fullCash()); };
  const update = (index: number, patch: Partial<RetailPaymentInput>) => setPayments((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const submit = async () => { try { buildPaymentSummary(total, submitted, { mode, customerId, dueDate }); setError(""); await onSubmit(submitted, mode === "full" ? undefined : dueDate || undefined); } catch (cause) { setError(getApiErrorMessage(cause, "Thanh toán không hợp lệ.")); } };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"><div role="dialog" aria-label="Thanh toán" className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
    <div className="flex justify-between"><div><h2 className="text-xl font-bold">Thanh toán</h2><p className="text-sm text-slate-500">Cần thu {money(total)}</p></div><button aria-label="Đóng" onClick={onClose}><X /></button></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">{modes.map((item) => <button key={item.value} type="button" aria-pressed={mode === item.value} className={`rounded-xl border px-3 py-3 text-sm font-bold ${mode === item.value ? "border-cyan-600 bg-cyan-50 text-cyan-800" : "text-slate-600"}`} onClick={() => selectMode(item.value)}>{item.label}</button>)}</div>
    {mode !== "debt" && <><div className="mt-4 space-y-3">{payments.map((payment, index) => <div key={index} className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-[150px_1fr_1fr_auto]"><select aria-label={`Phương thức ${index + 1}`} className="rounded-xl border px-3 py-2" value={payment.method} onChange={(event) => { const method = event.target.value as RetailPaymentInput["method"]; update(index, { method, tenderedAmount: method === "cash" ? payment.amount : undefined }); }}><option value="cash">Tiền mặt</option><option value="card">Thẻ</option><option value="transfer">Chuyển khoản</option><option value="ewallet">Ví điện tử</option></select><input aria-label={`Số tiền ${index + 1}`} type="number" min="0" className="rounded-xl border px-3 py-2" value={payment.amount} onChange={(event) => update(index, { amount: Number(event.target.value) })} />{payment.method === "cash" ? <input aria-label={`Tiền khách đưa ${index + 1}`} type="number" min="0" className="rounded-xl border px-3 py-2" value={payment.tenderedAmount ?? payment.amount} onChange={(event) => update(index, { tenderedAmount: Number(event.target.value) })} /> : <input aria-label={`Mã tham chiếu ${index + 1}`} className="rounded-xl border px-3 py-2" value={payment.reference || ""} onChange={(event) => update(index, { reference: event.target.value })} />}<button aria-label={`Xóa phương thức ${index + 1}`} disabled={payments.length === 1} onClick={() => setPayments((rows) => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button></div>)}</div><button className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold" onClick={() => setPayments((rows) => [...rows, { method: "transfer", amount: Math.max(0, total - rows.reduce((sum, row) => sum + row.amount, 0)) }])}><Plus className="h-4 w-4" />Thêm phương thức</button></>}
    <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><Metric label="Đã thu" value={summary.collected} /><Metric label="Công nợ phát sinh" value={summary.due} /><Metric label="Tiền thừa" value={summary.change} /></div>
    {mode !== "full" && <div className="mt-4">{!customerId && <p className="mb-2 text-sm text-amber-700">Hãy chọn khách hàng trên giỏ hàng để bán nợ.</p>}<input aria-label="Hạn thanh toán" type="date" className="w-full rounded-xl border px-3 py-2" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<button disabled={busy} className="mt-5 w-full rounded-xl bg-cyan-600 py-3 font-bold text-white disabled:opacity-50" onClick={() => void submit()}>Xác nhận thanh toán</button>
  </div></div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">{label}</p><p className="font-bold">{money(value)}</p></div>; }
