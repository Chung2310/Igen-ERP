import React from "react";
import { RefreshCw } from "lucide-react";
import { RetailEmptyState } from "../RetailEmptyState";
import { useRetailScope } from "../../hooks/useRetailScope";
import { retailOrdersApi } from "../../api/retailOrders.api";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
import { cancellationCandidates, clearCancellationCandidate, listPendingCancellations, sameCancellation, saveCancellation, lockCancellation } from "./cancellationRequest";

export default function PendingCancellations({ onResolved }: { onResolved: () => void }) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid]);
  const current = React.useRef(identity), mounted = React.useRef(true), inFlight = React.useRef(false);
  current.current = identity;
  const [rows, setRows] = React.useState<ReturnType<typeof listPendingCancellations>>([]);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const reload = React.useCallback(() => {
    try {
      setRows(scope?.branchId && userProfile?.uid ? listPendingCancellations(scope.companyCode, scope.branchId, userProfile.uid) : []);
      setError("");
    } catch { setRows([]); setError("Không đọc được một số yêu cầu hủy. Giữ bản lưu để đối chiếu."); }
  }, [identity]);
  React.useEffect(() => {
    mounted.current = true; reload();
    window.addEventListener("storage", reload); window.addEventListener("focus", reload);
    return () => { mounted.current = false; window.removeEventListener("storage", reload); window.removeEventListener("focus", reload); };
  }, [reload]);
  async function reconcile(row: typeof rows[number], revoke = false) {
    if (!scope || inFlight.current) return;
    const active = () => mounted.current && current.current === identity;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await lockCancellation(row.key, async () => {
        if (!active()) return;
        const request = row.request;
        const candidates = cancellationCandidates(row.key);
        if (!candidates.some(candidate => sameCancellation(candidate, request))) throw new Error("Yêu cầu đã thay đổi. Hãy tải lại danh sách.");
        if (candidates.length === 1) saveCancellation(row.key, request);
        const result = revoke ? await retailOrdersApi.revokeCancellation(scope, row.orderId, request) : await retailOrdersApi.reconcileCancellation(scope, row.orderId, request);
        if (result.status === "completed") {
          if (!result.order || result.order._id !== row.orderId) throw new Error("Kết quả không khớp đơn. Giữ nguyên bản lưu.");
          clearCancellationCandidate(row.key, request);
          if (active()) { reload(); onResolved(); }
        } else if (result.status === "revoked") {
          clearCancellationCandidate(row.key, request);
          if (active()) { reload(); onResolved(); }
        } else if (active()) setError(result.message);
      });
    } catch (cause) { if (active()) setError(getApiErrorMessage(cause, "Không đối chiếu được yêu cầu hủy.")); }
    finally { inFlight.current = false; if (active()) setBusy(false); }
  }
  return <aside aria-busy={busy} className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
      <h2 className="text-balance border-l-4 border-primary pl-2.5 text-sm font-medium text-on-surface">Yêu cầu hủy cần đối chiếu</h2>
      <button type="button" disabled={busy} onClick={reload} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
        <RefreshCw className={`size-3.5 text-primary ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        Tải lại yêu cầu hủy
      </button>
    </div>
    {!rows.length && !error && <RetailEmptyState kind="fee" compact className="border-t border-outline-variant">Không có yêu cầu cần đối chiếu.</RetailEmptyState>}
    {rows.map((row, index) => <div key={row.key + index} className="flex flex-col gap-3 border-t border-outline-variant px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="text-on-surface">Yêu cầu {index + 1} · Đơn <span className="font-medium text-primary">{row.orderId}</span> · {row.request.reason}</p>
        <p className="text-on-surface-variant">Tiền hoàn: <span className="font-medium tabular-nums text-primary">{new Intl.NumberFormat("vi-VN").format(row.request.refunds.reduce((sum, p) => sum + p.amount, 0))} ₫</span></p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void reconcile(row)} className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Đối chiếu yêu cầu hủy</button>
        <button type="button" disabled={busy} onClick={() => void reconcile(row, true)} className="inline-flex min-h-9 items-center rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Thu hồi yêu cầu chưa ghi nhận</button>
      </div>
    </div>)}
    {error && <p role="alert" className="border-t border-outline-variant bg-error-container px-3 py-2.5 text-sm text-on-error-container sm:px-4">{error}</p>}
  </aside>;
}
