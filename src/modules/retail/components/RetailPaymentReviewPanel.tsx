import { useEffect, useState } from "react";
import { apiFetch } from "../../shared/lib/apiFetch";

type PendingPayment = {
  _id: string;
  transactionId: string;
  transactionDate?: string;
  paymentCode?: string;
  orderCode?: string;
  accountNumber: string;
  receivedAmount: number;
  appliedAmount: number;
  reviewReason?: string;
};

export function RetailPaymentReviewPanel({ companyCode, canManage }: { companyCode: string; canManage: boolean }) {
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch<{ data: PendingPayment[] }>("/retail/payment-review", { params: { companyCode } });
      setItems(response.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được giao dịch cần kiểm tra.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companyCode]);

  async function markReviewed(id: string) {
    const note = String(notes[id] || "").trim();
    if (!note || busyId) return;
    setBusyId(id);
    setError("");
    try {
      await apiFetch(`/retail/payment-review/${id}/review`, { method: "POST", params: { companyCode }, body: JSON.stringify({ note }) });
      setItems((current) => current.filter((item) => item._id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được kết quả kiểm tra.");
    } finally {
      setBusyId(null);
    }
  }

  return <section aria-labelledby="retail-payment-review-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="retail-payment-review-title" className="text-balance text-lg font-semibold text-on-surface">Chuyển khoản cần kiểm tra</h2><p className="text-pretty text-sm text-on-surface-variant">Giao dịch chưa khớp đơn, đến ngoài ca hoặc nhận vượt số phải thu.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-lg border border-outline px-3 text-sm font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Làm mới</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    {loading ? <p role="status" className="mt-3 text-sm text-on-surface-variant">Đang tải giao dịch...</p> : !items.length ? <p className="mt-3 text-sm text-on-surface-variant">Không có giao dịch chờ kiểm tra.</p> : <ul className="mt-3 divide-y divide-outline-variant">{items.map((item) => <li key={item._id} className="space-y-2 py-3 text-sm text-on-surface">
      <div className="flex flex-wrap justify-between gap-2"><strong>{item.orderCode || item.paymentCode || item.transactionId}</strong><span className="tabular-nums">Nhận {item.receivedAmount.toLocaleString("vi-VN")} ₫ · Đã gắn đơn {item.appliedAmount.toLocaleString("vi-VN")} ₫</span></div>
      <p className="text-pretty text-on-surface-variant">{item.reviewReason || "Cần kiểm tra giao dịch."} · TK {item.accountNumber}{item.transactionDate ? ` · ${new Date(item.transactionDate).toLocaleString("vi-VN")}` : ""}</p>
      {canManage && <div className="flex flex-wrap items-end gap-2"><label className="min-w-56 flex-1 font-medium">Kết quả kiểm tra<input value={notes[item._id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item._id]: event.target.value }))} maxLength={500} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-visible:outline-2 focus-visible:outline-primary" /></label><button type="button" disabled={busyId !== null || !notes[item._id]?.trim()} onClick={() => void markReviewed(item._id)} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{busyId === item._id ? "Đang lưu..." : "Đã kiểm tra"}</button></div>}
    </li>)}</ul>}
  </section>;
}
