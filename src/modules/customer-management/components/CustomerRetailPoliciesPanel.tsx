import React from "react";
import { retailCustomerApi, type CustomerPointPolicy } from "../retailCustomerApi";

const field = "mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60";
const button = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";

export default function CustomerRetailPoliciesPanel({ companyCode, branchId, canRead, canManagePoints }: { companyCode: string; branchId?: string; canRead: boolean; canManagePoints: boolean }) {
  const [points, setPoints] = React.useState<CustomerPointPolicy | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const scope = branchId ? { companyCode, branchId } : null;

  const load = React.useCallback(async () => {
    if (!scope || !canRead) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      setPoints(await retailCustomerApi.pointPolicy(scope));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chính sách bán lẻ."); }
    finally { setLoading(false); }
  }, [canRead, scope?.branchId, scope?.companyCode]);
  React.useEffect(() => { void load(); }, [load]);

  async function savePoints(event: React.FormEvent) {
    event.preventDefault(); if (!scope || !points) return;
    setBusy(true); setError(""); setMessage("");
    try { setPoints(await retailCustomerApi.updatePointPolicy(scope, points)); setMessage("Đã lưu chính sách tích điểm."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được chính sách tích điểm."); }
    finally { setBusy(false); }
  }
  if (!canRead) return <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"><h2 className="text-base font-semibold text-on-surface">Chính sách bán lẻ</h2><p className="mt-2 text-sm text-on-surface-variant">Tài khoản chưa có quyền xem chính sách điểm thưởng.</p></section>;
  if (!branchId) return <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"><h2 className="text-base font-semibold text-on-surface">Chính sách bán lẻ</h2><p className="mt-2 text-sm text-on-surface-variant">Chọn chi nhánh để tải chính sách điểm thưởng.</p></section>;
  return <section className="space-y-4" aria-labelledby="customer-retail-policy-title">
    <div><h2 id="customer-retail-policy-title" className="text-base font-semibold text-on-surface">Chính sách bán lẻ</h2><p className="mt-1 text-sm text-on-surface-variant">Thiết lập áp dụng chung cho khách hàng của công ty.</p></div>
    {error && <p role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface">{message}</p>}
    {loading && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Đang tải chính sách...</p>}
    {points && <form onSubmit={(event) => void savePoints(event)} className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <div><h3 className="text-sm font-semibold text-on-surface">Tích điểm và cấn trừ tiền bằng điểm</h3><p className="mt-1 text-sm text-on-surface-variant text-pretty">Điểm tích từ đơn đã thanh toán. Khi bán hàng, POS quy đổi điểm thành tiền giảm trên đơn theo tỷ lệ và mức trần bên dưới.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-medium text-on-surface">Giá trị mua để tích 1 điểm<input disabled={!canManagePoints} required min={1} step={1} type="number" value={points.earnVndPerPoint} onChange={(event) => setPoints({ ...points, earnVndPerPoint: Number(event.target.value) })} className={field} /></label>
        <label className="text-sm font-medium text-on-surface">Số tiền cấn trừ cho 1 điểm (VNĐ)<input disabled={!canManagePoints} required min={1} step={1} type="number" value={points.redeemVndPerPoint} onChange={(event) => setPoints({ ...points, redeemVndPerPoint: Number(event.target.value) })} className={field} /></label>
        <label className="text-sm font-medium text-on-surface">Cấn trừ tối đa trên đơn (%)<input disabled={!canManagePoints} required min={0} max={100} step="0.01" type="number" value={points.maxRedeemPercent} onChange={(event) => setPoints({ ...points, maxRedeemPercent: Number(event.target.value) })} className={field} /></label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium text-on-surface"><input disabled={!canManagePoints} type="checkbox" checked={points.enabled} onChange={(event) => setPoints({ ...points, enabled: event.target.checked })} className="size-4 accent-primary" />Bật tích điểm và cấn trừ tại POS</label>
      </div>
      {canManagePoints && <button type="submit" disabled={busy || loading} className={button}>{busy ? "Đang lưu..." : "Lưu chính sách điểm"}</button>}
    </form>}
  </section>;
}
