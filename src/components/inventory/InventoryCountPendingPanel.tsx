import React, { useEffect, useRef, useState } from "react";
import { inventoryCountService, countQueueChangedEvent, type CountQueueScope, type CountQueueInspection, type InventoryCount, type PendingUpdate } from "../../services/inventoryCountService";
import { useConfirmation } from "../../context/ConfirmationContext";

const versionLabel = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : "Thiếu hoặc không hợp lệ";

export function InventoryCountPendingPanel({ scope }: { scope: CountQueueScope }) {
  const requestConfirmation = useConfirmation();
  const [inspection, setInspection] = useState<CountQueueInspection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [comparison, setComparison] = useState<{ entry: PendingUpdate; latest: InventoryCount } | null>(null);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const refresh = () => {
    generation.current++;
    setComparison(null); setBusy(false);
    try { setInspection(inventoryCountService.inspectPending(scopeRef.current)); setError(""); }
    catch (cause) { setInspection(null); setError(cause instanceof Error ? cause.message : "Không thể đọc bản chờ."); }
  };
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(countQueueChangedEvent, refresh);
    return () => { generation.current++; window.removeEventListener("storage", refresh); window.removeEventListener(countQueueChangedEvent, refresh); };
  }, [scope.companyCode, scope.branchId, scope.userId]);
  const compare = async (entry: PendingUpdate) => {
    const ticket = ++generation.current;
    setBusy(true); setError(""); setComparison(null);
    try {
      const latest = await inventoryCountService.comparePending(entry, scopeRef.current);
      if (ticket === generation.current && scopeRef.current.isCurrent?.() !== false) setComparison({ entry, latest });
    } catch (cause) {
      if (ticket === generation.current && scopeRef.current.isCurrent?.() !== false) setError(cause instanceof Error ? cause.message : "Không thể đọc phiếu máy chủ. Bản chờ vẫn được giữ.");
    } finally { if (ticket === generation.current) setBusy(false); }
  };
  const verify = async (entry: PendingUpdate) => {
    const ticket = ++generation.current;
    setBusy(true); setError(""); setComparison(null);
    try {
      const result = await inventoryCountService.reconcilePending(entry, scopeRef.current);
      if (ticket === generation.current && scopeRef.current.isCurrent?.() !== false && result.status === "not_found") setError("Máy chủ chưa có bằng chứng cho yêu cầu này. Bản chờ vẫn được giữ; kết quả này không thu hồi yêu cầu đang gửi.");
      if (scopeRef.current.isCurrent?.() !== false && result.status === "revoked") setNotice("Máy chủ xác nhận yêu cầu đã được thu hồi.");
    } catch (cause) {
      if (ticket === generation.current && scopeRef.current.isCurrent?.() !== false) setError(cause instanceof Error ? cause.message : "Không thể xác minh yêu cầu.");
    } finally { if (ticket === generation.current) setBusy(false); }
  };
  const revoke = async (entry: PendingUpdate) => {
    if (!await requestConfirmation({ title: "Thu hồi yêu cầu kiểm kê?", description: "Máy chủ sẽ chặn lần gửi muộn nếu yêu cầu chưa ghi nhận. Nếu đã ghi nhận, hệ thống chỉ đối chiếu và giữ nguyên phiếu.", confirmLabel: "Thu hồi yêu cầu", tone: "danger" })) return;
    const ticket = ++generation.current;
    setBusy(true); setError(""); setComparison(null);
    try {
      const result = await inventoryCountService.revokePending(entry, scopeRef.current);
      if (scopeRef.current.isCurrent?.() !== false) setNotice(result.status === "completed" ? "Yêu cầu đã ghi nhận; phiếu được giữ nguyên và bản chờ đã được xác minh." : "Yêu cầu chưa ghi nhận đã được thu hồi trên máy chủ.");
    } catch (cause) {
      if (ticket === generation.current && scopeRef.current.isCurrent?.() !== false) setError(cause instanceof Error ? cause.message : "Không thể thu hồi yêu cầu. Bản chờ vẫn được giữ.");
    } finally { if (ticket === generation.current) setBusy(false); }
  };
  const download = (raw: string, legacy: boolean) => {
    try {
      const url = URL.createObjectURL(new Blob([raw], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url; link.download = legacy ? "kiem-ke-cu-chua-ro-chu-so-huu.txt" : "kiem-ke-dang-cho.txt";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Không thể xuất dữ liệu. Bản gốc vẫn được giữ trong trình duyệt."); }
  };
  const serverItem = comparison?.latest.items.find(item => item._id === comparison.entry.itemId);
  if (!error && !notice && !inspection?.error && !inspection?.entries.length && inspection?.legacyRaw == null) return null;
  return <section aria-label="Bản kiểm kê đang chờ" className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 text-sm">
    <h4 className="font-semibold">Bản kiểm kê đang chờ — toàn chi nhánh hiện tại</h4>
    <p>Đối chiếu chỉ đọc phiếu máy chủ. Số lượng trùng nhau chưa chứng minh lần lưu đã hoàn tất; bản chờ được giữ nguyên. Xác minh lần lưu chỉ dọn bản chờ khi máy chủ có bằng chứng khớp mã yêu cầu và nội dung gốc.</p>
    <button type="button" onClick={refresh}>Đọc lại bản chờ</button>
    {notice && <p role="status">{notice}</p>}
    {(error || inspection?.error) && <p role="alert">{error || inspection?.error}</p>}
    {!!inspection?.entries.length && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Phiếu / dòng</th><th>Số đếm đã lưu</th><th>Phiên bản gốc</th><th>Đối chiếu</th></tr></thead><tbody>
      {inspection.entries.map((entry, index) => <tr key={index}><td>{entry.id} / {entry.itemId}</td><td>{entry.countedQuantity}</td><td>{versionLabel(entry.expectedVersion)}</td><td><button type="button" disabled={busy} onClick={() => void compare(entry)}>Đối chiếu {entry.id} / {entry.itemId}</button>{entry.requestId ? <button type="button" disabled={busy} onClick={() => void verify(entry)}>Xác minh lần lưu {entry.id} / {entry.itemId}</button> : <span> Bản cũ chưa có mã yêu cầu</span>}{entry.requestId && <button type="button" disabled={busy} onClick={() => void revoke(entry)}>Thu hồi {entry.id} / {entry.itemId}</button>}</td></tr>)}
    </tbody></table></div>}
    {comparison && <div role="status" className="rounded border bg-white p-3">
      <p>Phiếu máy chủ: {comparison.latest.countCode} — kho {comparison.latest.warehouseId}</p>
      <p>Phiên bản gốc: {versionLabel(comparison.entry.expectedVersion)}; phiên bản máy chủ: {comparison.latest.version}</p>
      <p>Số đếm đã lưu: {comparison.entry.countedQuantity}; số đếm máy chủ: {serverItem ? serverItem.countedQuantity : "Không tìm thấy dòng tương ứng"}</p>
      <p>Đây là dữ liệu tại thời điểm đối chiếu; hãy kiểm tra trước khi dùng thao tác tải lại phiếu.</p>
    </div>}
    {inspection?.raw != null && <details><summary>Dữ liệu gốc của tài khoản hiện tại</summary><pre className="max-h-40 overflow-auto whitespace-pre-wrap">{inspection.raw}</pre><button type="button" onClick={() => download(inspection.raw!, false)}>Xuất bản chờ nguyên gốc</button></details>}
    {inspection?.legacyRaw != null && <details><summary>Dữ liệu cũ chưa rõ chủ sở hữu</summary><p>Chưa xác định tài khoản/chi nhánh. Chỉ xem và xuất để phục hồi thủ công.</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap">{inspection.legacyRaw}</pre><button type="button" onClick={() => download(inspection.legacyRaw!, true)}>Xuất dữ liệu cũ nguyên gốc</button></details>}
  </section>;
}
