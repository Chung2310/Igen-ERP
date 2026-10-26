import { useEffect, useRef, useState } from "react";
import { ApiClientError } from "../../../services/apiClientError";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import type { RetailAfterSaleInput, RetailScope } from "../types";

import { afterSaleCandidates, clearAfterSaleCandidate, readAfterSale, saveAfterSale, clearAfterSale, lockAfterSale, sameAfterSale } from "./afterSaleRequest";
export function useAfterSaleRequest(scope: RetailScope | null, actorId: string, orderId: string) {
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, actorId, orderId]);
  const origin = useRef(identity);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `retail-after-sale-pending:v1:${identity}`;
  const [initial] = useState(() => {
    try {
      const candidates = afterSaleCandidates(storageKey);
      if (candidates.some(row => row.orderId !== orderId)) throw new Error();
      return { candidates, pending: candidates[0] || null, error: "" };
    } catch {
      return { candidates: [], pending: null, error: "Không đọc được yêu cầu đang chờ. Vui lòng đối chiếu chứng từ trước khi tiếp tục." };
    }
  });
  const [candidates, setCandidates] = useState(initial.candidates);
  const [pending, setPending] = useState(initial.pending);
  const pendingRef = useRef(initial.pending);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(initial.error);
  const scopeChanged = origin.current !== identity;

  async function send(input: Omit<RetailAfterSaleInput, "idempotencyKey">) {
    if (inFlight.current || completed.current) return;
    if (!scope || !actorId || scopeChanged || storageError) throw new Error("Phạm vi hoặc phiên thao tác đã thay đổi. Vui lòng mở lại đơn hàng.");
    if (candidates.length > 1) throw new Error("Có hai bản lưu khác nhau. Đối chiếu hoặc thu hồi từng yêu cầu trước.");
    if (pendingRef.current && pendingRef.current.type !== input.type) throw new Error("Đơn này có yêu cầu đang chờ thuộc nghiệp vụ khác. Vui lòng mở lại đúng thao tác để kiểm tra kết quả.");
    const active = () => mounted.current && currentIdentity.current === identity;
    inFlight.current = true;
    setBusy(true);
    try {
      return await lockAfterSale(storageKey, async () => {
        if (!active()) return;
        const saved = readAfterSale(storageKey);
        if (saved && saved.orderId !== orderId) throw new Error("Bản lưu không khớp đơn.");
        if (pendingRef.current && (!saved || !sameAfterSale(saved, pendingRef.current))) throw new Error("Bản lưu đã thay đổi. Đóng và mở lại thao tác để kiểm tra.");
        if (saved && !pendingRef.current) {
          pendingRef.current = saved; setPending(saved);
          throw new Error("Đã tìm thấy yêu cầu cũ ở tab khác. Kiểm tra nội dung và thử lại đúng yêu cầu.");
        }
        if (input.orderId !== orderId) throw new Error("Yêu cầu không khớp đơn đang mở.");
        const retry = Boolean(saved);
        const request = saved || JSON.parse(JSON.stringify({ ...input, idempotencyKey: crypto.randomUUID() })) as RetailAfterSaleInput;
        try { saveAfterSale(storageKey, request); }
        catch {
          if (active()) setStorageError("Không lưu được yêu cầu để thử lại an toàn. Chưa gửi chứng từ; vui lòng kiểm tra bộ nhớ trình duyệt.");
          return;
        }
        pendingRef.current = request; setPending(request);
        try {
          const result = await retailAfterSalesApi.create(scope, request);
          completed.current = true;
          clearAfterSale(storageKey, request);
          return active() ? result : undefined;
        } catch (error) {
          if (!retry && error instanceof ApiClientError && error.status === 400 && error.code === "AFTER_SALE_INVALID") {
            clearAfterSale(storageKey, request);
            pendingRef.current = null;
            if (active()) setPending(null);
          }
          throw error;
        }
      });
    } catch (error) {
      if (active()) throw error;
      return undefined;
    } finally {
      inFlight.current = false;
      if (active()) setBusy(false);
    }
  }

  async function reconcile(revoke = false) {
    if (inFlight.current || completed.current) return;
    if (!scope || !actorId || scopeChanged || storageError || !pendingRef.current) throw new Error("Mở lại đúng yêu cầu để đối chiếu.");
    const active = () => mounted.current && currentIdentity.current === identity;
    inFlight.current = true; setBusy(true);
    try {
      return await lockAfterSale(storageKey, async () => {
        if (!active()) return;
        const request = pendingRef.current!;
        const saved = afterSaleCandidates(storageKey);
        if (!saved.some(row => sameAfterSale(row, request)) || request.orderId !== orderId) throw new Error("Bản lưu đã thay đổi. Mở lại yêu cầu để kiểm tra.");
        if (saved.length === 1) saveAfterSale(storageKey, request);
        const result = revoke ? await retailAfterSalesApi.revoke(scope, request) : await retailAfterSalesApi.reconcile(scope, request);
        if (result.status !== "completed" && result.status !== "revoked") throw new Error(result.message);
        if (result.status === "completed" && (!result.document || result.document.orderId !== orderId || result.document.type !== request.type || !result.document._id)) throw new Error("Kết quả không khớp yêu cầu. Giữ nguyên bản lưu.");
        clearAfterSaleCandidate(storageKey, request);
        const remaining = afterSaleCandidates(storageKey);
        pendingRef.current = remaining[0] || null;
        if (active()) { setCandidates(remaining); setPending(pendingRef.current); }
        if (remaining.length) return;
        completed.current = true;
        return active() ? result.status === "completed" ? result.document : { revoked: true as const } : undefined;
      });
    } catch (error) { if (active()) throw error; return undefined; }
    finally { inFlight.current = false; if (active()) setBusy(false); }
  }
  function selectCandidate(index: number) {
    if (inFlight.current || scopeChanged) return;
    const request = candidates[index];
    if (request) { pendingRef.current = request; setPending(request); }
  }
  return { pending, candidates, selectCandidate, busy, send, reconcile, scopeChanged, storageError };
}
