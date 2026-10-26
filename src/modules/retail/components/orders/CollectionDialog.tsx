import CashSessionPicker from "./CashSessionPicker";
import React from "react";
import PaymentDialog from "../pos/PaymentDialog";
import { retailOrdersApi } from "../../api/retailOrders.api";
import { useRetailScope } from "../../hooks/useRetailScope";
import { ApiClientError } from "../../../../services/apiClientError";
import { getApiErrorMessage } from "../../../../utils/errorMessage";
import type { RetailOrder, RetailPaymentInput } from "../../types";

import { collectionCandidates, clearCollectionCandidate, readCollection, saveCollection, clearCollection, lockCollection, sameCollection, type PendingCollection } from "./collectionRequest";
export default function CollectionDialog({ order, close, done }: { order: RetailOrder; close: () => void; done: (order: RetailOrder) => void }) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, order._id]);
  const initialIdentity = React.useRef(identity);
  const currentIdentity = React.useRef(identity);
  currentIdentity.current = identity;
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `retail-collection-pending:v1:${identity}`;
  const [initial] = React.useState(() => {
    try {
      const candidates = collectionCandidates(storageKey);
      return { pending: candidates[0] || null, candidates, error: "" };
    } catch { return { pending: null, candidates: [], error: "Không đọc được yêu cầu thu tiền đang chờ. Vui lòng đối chiếu công nợ trước khi tiếp tục." }; }
  });
  const [cashSessionId, setCashSessionId] = React.useState(initial.pending?.cashSessionId || "");
  const [candidates, setCandidates] = React.useState(initial.candidates);
  const [pending, setPending] = React.useState(initial.pending);
  const pendingRef = React.useRef(initial.pending);
  const inFlight = React.useRef(false);
  const completed = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(initial.error);
  const blocked = identity !== initialIdentity.current || Boolean(initial.error) || !scope || !userProfile?.uid;

  async function reconcile(revoke = false) {
    if (blocked || inFlight.current || completed.current || !scope || !pendingRef.current) return;
    const active = () => mounted.current && currentIdentity.current === identity;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await lockCollection(storageKey, async () => {
        if (!active()) return;
        const request = pendingRef.current!;
        const current = collectionCandidates(storageKey);
        if (!current.some(candidate => sameCollection(candidate, request))) throw new Error("Bản lưu đã thay đổi. Đóng và mở lại đơn để kiểm tra.");
        if (current.length === 1) saveCollection(storageKey, request);
        const result = revoke
          ? await retailOrdersApi.revokeCollection(scope, order._id, request)
          : await retailOrdersApi.reconcileCollection(scope, order._id, request);
        if (result.status === "completed") {
          if (!result.order || result.order._id !== order._id) throw new Error("Kết quả đối chiếu không khớp đơn. Giữ nguyên yêu cầu.");
          clearCollectionCandidate(storageKey, request);
          const remaining = collectionCandidates(storageKey);
          pendingRef.current = remaining[0] || null;
          if (active()) { setCandidates(remaining); setPending(pendingRef.current); }
          if (!remaining.length) { completed.current = true; if (active()) done(result.order); }
          else if (active()) setError("Khoản thu đã xác minh. Còn một bản lưu khác cần xử lý.");
        } else if (result.status === "revoked") {
          clearCollectionCandidate(storageKey, request);
          const remaining = collectionCandidates(storageKey);
          pendingRef.current = remaining[0] || null;
          if (active()) { setCandidates(remaining); setPending(pendingRef.current); setError(result.message); }
          if (!remaining.length && active()) close();
        } else if (active()) setError(result.message);
      });
    } catch (cause) {
      if (active()) setError(getApiErrorMessage(cause, "Không đối chiếu được khoản thu. Yêu cầu cũ vẫn được giữ nguyên."));
    } finally { inFlight.current = false; if (active()) setBusy(false); }
  }

  const collectableAmount = Math.max(0, order.dueAmount - Number(order.pendingTransferAmount || 0));
  const canCollect = order.status === "confirmed" && collectableAmount > 0;
  async function submit(payments: RetailPaymentInput[]) {
    if (blocked || candidates.length > 1 || inFlight.current || completed.current || !scope) return;
    const active = () => mounted.current && currentIdentity.current === identity;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await lockCollection(storageKey, async () => {
        if (!active()) return;
        const saved = readCollection(storageKey);
        if (pendingRef.current && (!saved || !sameCollection(saved, pendingRef.current))) throw new Error("Bản lưu đã thay đổi ở tab khác. Hãy đóng và mở lại đơn để kiểm tra.");
        // A stale form adopts the saved request, but requires an explicit retry.
        if (saved && !pendingRef.current) {
          pendingRef.current = saved;
          setPending(saved);
          setError("Đã tìm thấy khoản thu đang chờ ở tab khác. Kiểm tra và thử lại đúng khoản thu cũ.");
          return;
        }
        if (!saved && !canCollect) throw new Error("Đơn hiện không còn đủ điều kiện thu công nợ.");
        const retry = Boolean(saved);
        if (!saved && payments.some((payment) => payment.method === "cash") && !cashSessionId) throw new Error("Chọn phiên/két để thu tiền mặt.");
        const request: PendingCollection = saved || { ...(cashSessionId ? { cashSessionId } : {}), payments, expectedVersion: order.version, idempotencyKey: crypto.randomUUID() };
        saveCollection(storageKey, request);
        pendingRef.current = request;
        setPending(request);
        try {
          const updated = await retailOrdersApi.collect(scope, order._id, request.payments, { cashSessionId: request.cashSessionId, idempotencyKey: request.idempotencyKey, expectedVersion: request.expectedVersion });
          completed.current = true;
          clearCollection(storageKey, request);
          if (active()) done(updated);
        } catch (cause) {
          if (!retry && cause instanceof ApiClientError && cause.status === 400 && cause.code === "COLLECTION_INVALID") {
            clearCollection(storageKey, request);
            pendingRef.current = null;
            if (active()) setPending(null);
          }
          throw cause;
        }
      });
    } catch (cause) {
      if (active()) setError(getApiErrorMessage(cause, "Chưa xác định được kết quả thu tiền. Hãy thử lại yêu cầu cũ."));
    } finally { inFlight.current = false; if (active()) setBusy(false); }
  }

  if (pending || blocked || !canCollect) return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
    <div role="dialog" aria-label="Khoản thu đang chờ" className="w-full max-w-lg rounded-2xl bg-white p-5">
      <h2 className="text-lg font-bold">Kiểm tra kết quả thu công nợ</h2>
      <p className="mt-3">Yêu cầu đã lưu được giữ nguyên để tránh ghi nhận tiền thu hai lần. Đóng cửa sổ không hủy khoản thu đã gửi.</p>
      {!pending && !blocked && <p className="mt-3">Không có khoản thu đang chờ trên trình duyệt này. Đơn hiện không đủ điều kiện thu thêm.</p>}
      {candidates.length > 1 && <div className="mt-3"><p>Hai bản lưu khác nhau. Chọn từng yêu cầu để đối chiếu hoặc hủy; chưa thể thu thêm.</p>{candidates.map((candidate, index) => <button className="mr-3 underline" key={index} disabled={busy || blocked} onClick={() => { pendingRef.current = candidate; setPending(candidate); setError(""); }}>Yêu cầu {index + 1}{pending && sameCollection(candidate, pending) ? " (đang chọn)" : ""}</button>)}</div>}
      {pending && <p className="mt-2 text-xs break-all">Mã yêu cầu: {pending.idempotencyKey}</p>}
      {pending && <ul className="mt-3">{pending.payments.map((payment, index) => <li key={index}>{({ cash: "Tiền mặt", card: "Thẻ", transfer: "Chuyển khoản", ewallet: "Ví điện tử" })[payment.method]}: {new Intl.NumberFormat("vi-VN").format(payment.amount)} ₫{payment.reference ? ` · ${payment.reference}` : ""}</li>)}</ul>}
      {blocked && <p role="alert">Phạm vi đã thay đổi hoặc không đọc được yêu cầu. Vui lòng mở lại đúng đơn để đối chiếu.</p>}
      {error && <p role="alert" className="mt-3 text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3"><button onClick={close}>Đóng</button><button disabled={busy || blocked || !pending || completed.current} onClick={() => void reconcile()}>Đối chiếu khoản thu</button><button disabled={busy || blocked || !pending || completed.current} onClick={() => void reconcile(true)}>Hủy yêu cầu chưa ghi nhận</button><button disabled={busy || blocked || candidates.length > 1 || !pending || completed.current} onClick={() => void submit([])}>{busy ? "Đang xử lý..." : "Thử lại khoản thu cũ"}</button></div>
    </div>
  </div>;
  return <><PaymentDialog total={collectableAmount} busy={busy} customerId={order.customerId} transferContent={order.paymentCode || order.orderCode} onClose={close} onSubmit={submit}><CashSessionPicker scope={scope} value={cashSessionId} onChange={setCashSessionId} disabled={busy} /></PaymentDialog>{error && <div role="alert" className="fixed bottom-4 left-4 z-[70] rounded-xl bg-white p-4 text-red-600">{error}</div>}</>;
}
