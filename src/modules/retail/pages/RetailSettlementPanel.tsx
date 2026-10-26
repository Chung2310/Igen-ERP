import React from "react";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailScope } from "../types";
import { socketService } from "../../../services/socketService";
import { getApiErrorMessage } from "../../../utils/errorMessage";

type Item = Awaited<ReturnType<typeof retailShiftsApi.settlements>>["items"][number];
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
export default function RetailSettlementPanel({ scope }: { scope: RetailScope }) {
  const [items, setItems] = React.useState<Item[]>([]);
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<Item | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const refresh = React.useCallback(async () => {
    try { const result = await retailShiftsApi.settlements(scope, page); setItems(result.items); setTotal(result.total); }
    catch (cause) { setError(getApiErrorMessage(cause, "Không tải được khoản thu cần kiểm tra.")); }
  }, [scope.companyCode, scope.branchId, page]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => {
    const offEvent = socketService.on("pos:session:updated", (event: any) => {
      if (event?.companyCode === scope.companyCode && event?.branchId === scope.branchId) void refresh();
    });
    const offStatus = socketService.onStatusChange((connected) => { if (connected) void refresh(); });
    return () => { offEvent(); offStatus(); };
  }, [scope.companyCode, scope.branchId, refresh]);
  const review = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || busy || !reason.trim()) return; setBusy(true); setError("");
    try { await retailShiftsApi.reviewSettlement(scope, { orderId: selected._id, paymentIndex: selected.paymentIndex, reason: reason.trim() }); setSelected(null); await refresh(); }
    catch (cause) { setError(getApiErrorMessage(cause, "Không xác nhận được khoản thu.")); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border bg-white p-5">
    <div className="flex justify-between gap-3"><h2 className="font-bold">Khoản thu ngoài phiên cần kiểm tra ({total})</h2><button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => void refresh()}>Làm mới</button></div>
    <p className="mt-2 text-sm text-slate-500">Bao gồm chuyển khoản đến sau khi đóng phiên. Tiền đã được ghi nhận vào đơn; kiểm tra ở đây không thay đổi số liệu phiên đã chốt.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    <div className="mt-3 divide-y">{items.map((item) => <div key={`${item._id}:${item.paymentIndex}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><b>{item.orderCode} · {money(item.payment.amount)}</b><p className="text-xs text-slate-500">{item.payment.receivedByName} · {item.payment.reference} · {new Date(item.payment.paidAt).toLocaleString("vi-VN")}</p></div><button type="button" onClick={() => { setSelected(item); setReason(""); }} className="rounded-lg border px-3 py-2 font-semibold">Kiểm tra</button></div>)}</div>
    {!items.length && <p className="mt-3 text-sm text-slate-500">Không có khoản thu chờ kiểm tra.</p>}
    {total > 20 && <div className="mt-3 flex justify-end gap-3 text-sm"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>{page}</span><button disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Trang sau</button></div>}
    {selected && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4"><form role="dialog" aria-modal="true" aria-label="Kiểm tra khoản thu" onSubmit={(event) => void review(event)} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5"><h3 className="font-bold">{selected.orderCode} · {money(selected.payment.amount)}</h3><label className="block text-sm font-semibold">Nội dung kiểm tra<textarea required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2">Đóng</button><button disabled={busy || !reason.trim()} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">Xác nhận đã kiểm tra</button></div></form></div>}
  </section>;
}
