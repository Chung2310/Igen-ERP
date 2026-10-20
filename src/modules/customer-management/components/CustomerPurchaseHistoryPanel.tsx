import React from "react";
import { customerApi } from "../customerApi";
import type { CustomerPurchaseHistory } from "../types";

type Props = { customerId: string; companyCode: string; branchId?: string };

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";
const statusLabel = (status?: string) => ({ draft: "Nháp", confirmed: "Đã xác nhận", completed: "Hoàn thành", cancelled: "Đã hủy" }[status || ""] || status || "Không rõ");
const orderLabel = (order: CustomerPurchaseHistory["items"][number]) => order.orderCode || `Đơn treo #${order._id.slice(-6)}`;

export default function CustomerPurchaseHistoryPanel({ customerId, companyCode, branchId }: Props) {
  const [history, setHistory] = React.useState<CustomerPurchaseHistory | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!branchId) { setHistory(null); setLoading(false); setError(""); return; }
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    void customerApi.purchaseHistory(customerId, { companyCode, branchId })
      .then((data) => { if (active) setHistory(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử mua hàng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, companyCode, customerId]);

  if (!branchId) return <section className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">Vui lòng chọn chi nhánh để xem lịch sử mua hàng.</section>;
  if (loading) return <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Đang tải lịch sử mua hàng...</section>;
  if (error) return <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>;
  if (!history) return null;

  const cards = [
    ["Số đơn", String(history.summary.orderCount)],
    ["Tổng đã mua", currency.format(history.summary.totalPurchased)],
    ["Đã thanh toán", currency.format(history.summary.totalPaid)],
    ["Công nợ hiện tại", currency.format(history.summary.currentDebt)],
    ["Lần mua gần nhất", date(history.summary.lastPurchaseAt)],
  ];

  return <section className="mt-6 space-y-3 border-t border-slate-100 pt-5" aria-label="Lịch sử mua hàng">
    <h3 className="text-sm font-semibold text-slate-800">Lịch sử mua hàng</h3>
    <div className="grid gap-2.5 sm:grid-cols-2">{cards.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold tabular-nums text-slate-800">{value}</p></div>)}</div>
    {history.items.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">Khách hàng chưa có đơn mua tại chi nhánh này.</div> : <div className="space-y-2.5">{history.items.map((order) => <article key={order._id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-slate-800">{orderLabel(order)}</p><p className="mt-1 text-xs text-slate-500">{date(order.businessDate)} · {statusLabel(order.status)}</p></div><p className="break-words font-semibold tabular-nums text-[#007eb8]">{currency.format(order.grandTotal)}</p></div><div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><p className="min-w-0 break-words">Đã thanh toán: <span className="font-semibold tabular-nums text-slate-800">{currency.format(order.paidAmount)}</span></p><p className="min-w-0 break-words">Công nợ: <span className="font-semibold tabular-nums text-slate-800">{currency.format(order.dueAmount)}</span></p><p className="min-w-0">{order.itemCount} sản phẩm</p></div><p className="mt-2 text-xs text-slate-500">Nhân viên: {order.salespersonName || "—"}</p></article>)}</div>}
  </section>;
}
