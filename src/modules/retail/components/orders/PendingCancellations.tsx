import React from "react";
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
  return <aside className="rounded-xl border bg-white p-4">
    <div className="flex justify-between"><h2>Yêu cầu hủy đang chờ trên trình duyệt</h2><button disabled={busy} onClick={reload}>Tải lại yêu cầu hủy</button></div>
    {!rows.length && !error && <p className="text-sm text-slate-500">Không có yêu cầu đang chờ.</p>}
    {rows.map((row, index) => <div key={row.key + index} className="mt-3 border-t pt-2">
      <p>Yêu cầu {index + 1} · Đơn {row.orderId} · {row.request.reason}</p>
      <p>Tiền hoàn: {new Intl.NumberFormat("vi-VN").format(row.request.refunds.reduce((sum, p) => sum + p.amount, 0))} ₫</p>
      <button disabled={busy} onClick={() => void reconcile(row)}>Đối chiếu yêu cầu hủy</button>
      <button className="ml-4" disabled={busy} onClick={() => void reconcile(row, true)}>Thu hồi yêu cầu chưa ghi nhận</button>
    </div>)}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
