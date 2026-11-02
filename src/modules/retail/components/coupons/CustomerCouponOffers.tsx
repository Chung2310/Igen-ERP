import { useEffect, useState } from "react";
import { retailCouponsApi, type RetailCoupon } from "../../api/retailCoupons.api";
import type { RetailScope } from "../../types";

export default function CustomerCouponOffers({ scope, customerId, selectedCode, onApply }: {
  scope: RetailScope; customerId?: string; selectedCode?: string; onApply: (code: string) => void;
}) {
  const [result, setResult] = useState<{ key: string; items: RetailCoupon[]; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${scope.companyCode}:${scope.branchId}:${customerId || ""}`;
  useEffect(() => {
    if (!customerId) return;
    let current = true;
    retailCouponsApi.available(scope, customerId).then(items => { if (current) setResult({ key, items }); })
      .catch(() => { if (current) setResult({ key, items: [], error: "Không tải được mã riêng của khách." }); });
    return () => { current = false; };
  }, [key, revision]);
  if (!customerId || result?.key !== key || (!result.error && !result.items.length)) return null;
  return <section className="mt-3 space-y-2 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3" aria-label="Mã ưu đãi riêng của khách">
    <h3 className="text-sm font-bold text-cyan-900">Ưu đãi dành riêng cho khách</h3>
    {result.error && <p className="text-xs text-rose-700">{result.error} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>Thử lại</button></p>}
    {result.items.map(item => <div key={item._id} className="flex items-start justify-between gap-2 rounded-lg bg-white p-2">
      <div className="min-w-0"><p className="text-xs font-semibold">{item.name} · Giảm {item.discountType === "percent" ? `${item.value}%` : `${item.value.toLocaleString("vi-VN")} ₫`}</p>
        <p className="break-all font-mono text-[10px] text-slate-500">{item.code}</p>
        <p className="text-[11px] text-slate-500">Đơn từ {item.minSubtotal.toLocaleString("vi-VN")} ₫{item.maxDiscount != null ? ` · Giảm tối đa ${item.maxDiscount.toLocaleString("vi-VN")} ₫` : ""} · Hết hạn {new Date(item.endsAt).toLocaleString("vi-VN")} · 1 lần</p></div>
      <button type="button" disabled={selectedCode === item.code} className="shrink-0 rounded-lg bg-cyan-600 px-2 py-1 text-xs font-bold text-white disabled:bg-slate-300" onClick={() => onApply(item.code)}>{selectedCode === item.code ? "Đã chọn" : "Áp dụng"}</button>
    </div>)}
  </section>;
}
