import React from "react";
import type { RetailScope } from "../../types";
import { retailOrdersApi } from "../../api/retailOrders.api";
import { verifyDraftResult, hasDraftCandidate, clearDraftCreation, listDraftRequests, readDraftRequest, retainDraftRequest, withDraftRequestLock } from "../../offline/draftCreationRequest";

export default function PendingDraftRequests({ scope, userId, busy, onRecovered }: { scope: RetailScope; userId: string; busy: boolean; onRecovered: () => void }) {
  const requestConfirmation = ({ title, description }: { title: string; description: string; confirmLabel?: string; tone?: "warning" | "danger" }) => Promise.resolve(window.confirm(`${title}\n\n${description}`));
  const [rows, setRows] = React.useState<ReturnType<typeof listDraftRequests>>([]);
  const [message, setMessage] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const scopeToken = React.useMemo(() => ({}), [scope.companyCode, scope.branchId, userId]);
  const liveScope = React.useRef(scopeToken); liveScope.current = scopeToken;
  React.useEffect(() => { setWorking(false); }, [scopeToken]);
  const refresh = React.useCallback(() => {
    try { setRows(listDraftRequests(scope, userId)); setMessage(""); }
    catch (error) { setRows([]); setMessage(error instanceof Error ? error.message : "Không đọc được yêu cầu nháp."); }
  }, [scope.companyCode, scope.branchId, userId]);
  React.useEffect(() => {
    refresh(); window.addEventListener("storage", refresh); window.addEventListener("focus", refresh); window.addEventListener("retail-draft-requests-changed", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("retail-draft-requests-changed", refresh); };
  }, [refresh, busy]);
  const recover = async (row: typeof rows[number], action: "recover" | "reconcile" | "revoke" = "recover") => {
    const current = () => alive.current && liveScope.current === scopeToken;
    if (action === "revoke" && !await requestConfirmation({ title: "Thu hồi yêu cầu lưu nháp?", description: "Yêu cầu chưa ghi nhận sẽ bị khóa; đơn đã lưu được giữ nguyên.", confirmLabel: "Thu hồi yêu cầu", tone: "danger" })) return;
    let message = "Đã khôi phục kết quả lưu nháp. Chưa thực hiện thanh toán.";
    let resolved = false;
    setWorking(true); setMessage("");
    try {
      await withDraftRequestLock(scope, userId, async () => {
        if (!hasDraftCandidate(scope, userId, row.request, row.orderId)) throw new Error("Bản lưu đã thay đổi. Tải lại danh sách trước khi xử lý.");
        if (action !== "recover") {
          const result = await (action === "revoke" ? retailOrdersApi.revokeDraftRequest : retailOrdersApi.reconcileDraftRequest)(scope, { request: row.request, ...(row.orderId ? { orderId: row.orderId } : {}) });
          message = result?.message || "Chưa đủ bằng chứng. Giữ yêu cầu để đối chiếu.";
          if (result?.status === "completed" || result?.status === "revoked") {
            if (result.status === "completed") {
              verifyDraftResult(result.order, row.orderId);
              if (row.orderId && result.order.version < Number(row.request.input.version) + 1) throw new Error("Phiên bản phản hồi chưa chứng minh lần lưu gốc.");
            }
            if (!hasDraftCandidate(scope, userId, row.request, row.orderId)) throw new Error("Bản lưu đã thay đổi. Không dọn yêu cầu khác.");
            clearDraftCreation(scope, userId, row.request, row.orderId); resolved = true;
          }
          return;
        }
        const saved = readDraftRequest(scope, userId, row.orderId);
        if (!saved || JSON.stringify(saved) !== JSON.stringify(row.request)) throw new Error("Bản lưu đã thay đổi. Tải lại danh sách trước khi khôi phục.");
        retainDraftRequest(scope, userId, saved, row.orderId);
        const input = { ...saved.input, idempotencyKey: saved.idempotencyKey };
        const order = row.orderId ? await retailOrdersApi.updateDraft(scope, row.orderId, input) : await retailOrdersApi.createDraft(scope, input);
        verifyDraftResult(order, row.orderId);
        clearDraftCreation(scope, userId, saved, row.orderId); resolved = true;
      });
      if (current()) { refresh(); if (resolved) onRecovered(); setMessage(message); }
    } catch (error) { if (current()) setMessage(error instanceof Error ? error.message : "Chưa khôi phục được bản nháp."); }
    finally { if (current()) setWorking(false); }
  };
  if (!rows.length && !message) return null;
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
    <b>Yêu cầu lưu nháp chưa rõ kết quả</b>
    <p>Khôi phục đúng nội dung đã gửi. Không tự thanh toán; đơn trong hàng đợi vẫn xử lý tại mục đồng bộ.</p>
    {rows.some(row => row.conflict) && <p>Bản lưu chung khác bản tab cũ. Đối chiếu hoặc thu hồi từng bản trước khi gửi lại.</p>}
    {rows.map(row => <div className="mt-2 flex items-center justify-between gap-2" key={JSON.stringify([row.orderId, row.source, row.request.idempotencyKey])}>
      <span>{row.source === "legacy" ? "Bản tab cũ · " : "Bản lưu chung · "}{row.orderId ? "Sửa đơn #" + row.orderId.slice(-6) : "Tạo đơn mới"} · {row.request.idempotencyKey.slice(-8)}{row.orderId ? " · phiên bản " + String(row.request.input.version) : ""}</span>
      <button disabled={busy || working || row.conflict} onClick={() => void recover(row)} className="rounded border bg-white px-3 py-1 disabled:opacity-50">Khôi phục bản nháp</button>
      <button disabled={busy || working} onClick={() => void recover(row, "reconcile")} className="rounded border bg-white px-3 py-1 disabled:opacity-50">Đối chiếu</button>
      <button disabled={busy || working} onClick={() => void recover(row, "revoke")} className="rounded border bg-white px-3 py-1 text-red-700 disabled:opacity-50">Thu hồi yêu cầu</button>
    </div>)}
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>;
}
