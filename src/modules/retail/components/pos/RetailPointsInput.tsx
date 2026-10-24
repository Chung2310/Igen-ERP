import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/lib/apiFetch";
import type { RetailScope } from "../../types";

type Policy = { enabled: boolean; redeemVndPerPoint: number; maxRedeemPercent: number };
type Account = { balance: number };

export default function RetailPointsInput({ scope, customerId, value, onChange }: { scope: RetailScope; customerId?: string; value: number; onChange: (points: number) => void }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void apiFetch<{ data: Policy }>("/retail/points/policy", { params: scope })
      .then((response) => { if (active) setPolicy(response.data); })
      .catch(() => { if (active) setPolicy(null); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId]);
  useEffect(() => {
    if (!customerId) { setAccount(null); return; }
    let active = true;
    setError("");
    void apiFetch<{ data: Account }>(`/retail/points/customers/${customerId}`, { params: scope })
      .then((response) => { if (active) setAccount(response.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được số dư điểm."); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId, customerId]);
  if (!policy?.enabled || !customerId) return null;
  return <div className="space-y-1">
    <label className="block text-sm font-medium text-on-surface">Sử dụng điểm thưởng
      <input type="number" min={0} max={Math.max(0, account?.balance || 0)} step={1} inputMode="numeric" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} aria-describedby={error ? "retail-points-help retail-points-error" : "retail-points-help"} aria-invalid={Boolean(error)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" />
    </label>
    <p id="retail-points-help" className="text-pretty text-xs text-on-surface-variant">Có {Math.max(0, account?.balance || 0).toLocaleString("vi-VN")} điểm · 1 điểm = {policy.redeemVndPerPoint.toLocaleString("vi-VN")} ₫ · Tối đa {policy.maxRedeemPercent}% giá trị hàng.</p>
    {error && <p id="retail-points-error" role="alert" className="text-sm text-error">{error}</p>}
  </div>;
}
