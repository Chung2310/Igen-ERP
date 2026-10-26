import React from "react";
import type { RetailOrder } from "../../types";

const labels: Record<string, string> = {
  returned: "Đã trả toàn bộ", partially_returned: "Đã trả một phần",
  bought_back: "Đã thu mua toàn bộ", partially_bought_back: "Đã thu mua một phần",
  mixed_full: "Đã trả / thu mua toàn bộ", mixed_partial: "Đã trả / thu mua một phần",
};

export function AfterSaleBadge({ order }: { order: RetailOrder }) {
  const label = labels[order.afterSaleSummary?.status || order.afterSaleStatus || "none"];
  return label ? <span className="mt-1 block rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{label}</span> : null;
}

export function AfterSaleHistory({ order }: { order: RetailOrder }) {
  if (!order.afterSales?.length && !order.restockReceiptCode) return null;
  return <section className="mt-5 space-y-3 rounded-2xl border border-slate-200 p-4">
    <h3 className="text-sm font-bold text-slate-800">Lịch sử trả hàng / thu mua / nhập lại kho</h3>
    <AfterSaleBadge order={order} />
    {order.restockReceiptCode && <p className="text-sm text-cyan-800">Hủy đơn · Đã nhập kho · {order.restockReceiptCode}</p>}
    {order.afterSales?.map((doc) => <article key={doc._id} className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-800">{doc.type === "return" ? "Trả hàng" : "Thu mua lại"} · {doc.code}</p>
      <p className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleString("vi-VN")}{doc.createdByName ? ` · ${doc.createdByName}` : ""}</p>
      <p className="text-cyan-800">{doc.receiptCode ? `Đã nhập kho · ${doc.receiptCode}` : "Chứng từ cũ chưa liên kết phiếu nhập"}</p>
      {doc.items.map((item, index) => <p key={index} className="break-words text-slate-600">{item.productName} × {item.quantity}{item.serialNumbers?.length ? ` · IMEI/SN: ${item.serialNumbers.join(", ")}` : ""}{item.internalBarcodes?.length ? ` · Mã máy: ${item.internalBarcodes.join(", ")}` : ""}</p>)}
      <p className="text-slate-600">Lý do: {doc.reason}</p>
    </article>)}
  </section>;
}
