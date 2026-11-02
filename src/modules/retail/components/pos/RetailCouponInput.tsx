import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/lib/apiFetch";
import type { RetailScope } from "../../types";

type Coupon = { _id: string; code: string; name: string; endsAt: string; usedCount: number; usageLimit?: number };

export default function RetailCouponInput({ scope, customerId, value, onChange }: { scope: RetailScope; customerId?: string; value: string; onChange: (code: string) => void }) {
  const [available, setAvailable] = useState<Coupon[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    void apiFetch<{ data: Coupon[] }>("/retail/coupons/available", { params: { ...scope, ...(customerId ? { customerId } : {}) } })
      .then((response) => { if (active) setAvailable(response.data.filter((coupon) => coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit)); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được mã ưu đãi."); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId, customerId]);

  return <div className="space-y-2">
    <label className="block text-sm font-medium text-on-surface">Mã ưu đãi
      <input value={value} onChange={(event) => onChange(event.target.value)} maxLength={32} autoComplete="off" placeholder="Nhập mã ưu đãi" aria-describedby={error ? "retail-coupon-error" : undefined} aria-invalid={Boolean(error)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" />
    </label>
    {available.length > 0 && <label className="block text-sm text-on-surface-variant">Mã ưu đãi đang có
      <select value={available.some((coupon) => coupon.code === value) ? value : ""} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
        <option value="">Chọn mã ưu đãi</option>
        {available.map((coupon) => <option key={coupon._id} value={coupon.code}>{coupon.name} · {coupon.code}</option>)}
      </select>
    </label>}
    {error && <p id="retail-coupon-error" role="alert" className="text-sm text-error">{error}</p>}
  </div>;
}
