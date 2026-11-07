import { useEffect, useRef, useState } from "react";
import { api, formatMoney } from "./api";
import type { CatalogItem } from "./types";

import { catalogActionLabels, type CatalogAction } from "./catalog-actions";
type Preview = { previewHash: string; rows: Array<{ id: string; sku: string; name: string; currency: string; before: { price: number; active: boolean; deleted: boolean }; after: { price: number; active: boolean; deleted: boolean } }> };

export default function CatalogBulkDialog({ action, items, onClose, onApplied }: { action: CatalogAction; items: CatalogItem[]; onClose: () => void; onApplied: (items: CatalogItem[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"amount" | "percent">("percent"), [direction, setDirection] = useState(1), [value, setValue] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, previousOverflow = document.body.style.overflow;
    const element = dialog.current!;
    element.showModal(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previousOverflow; if (previous?.isConnected) previous.focus(); else document.querySelector<HTMLButtonElement>(".price-list-add-button")?.focus(); };
  }, []);
  const payload = () => ({ action, selection: items.map(item => ({ id: item._id, updatedAt: item.updatedAt || item.createdAt })), ...(action === "price" ? { adjustment: { mode, value: direction * Number(value) } } : {}) });
  const check = async () => {
    setBusy(true); setError("");
    try { setPreview(await api<Preview>("/api/catalog/bulk/preview", { method: "POST", body: JSON.stringify(payload()) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể kiểm tra sản phẩm."); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try { const result = await api<{ items: CatalogItem[] }>("/api/catalog/bulk", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ ...payload(), previewHash: preview.previewHash }) }); onApplied(result.items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa áp dụng được thay đổi. Hãy tải lại để đối chiếu."); }
    finally { setBusy(false); }
  };
  const describe = (state: Preview["rows"][number]["after"]) => state.deleted ? "Đã xóa" : state.active ? "Đang áp dụng" : "Ngừng áp dụng";
  return <dialog ref={dialog} className="template-dialog catalog-bulk-dialog" role={action === "delete" ? "alertdialog" : "dialog"} aria-labelledby="catalog-bulk-title" aria-describedby="catalog-bulk-description" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="settings-card-heading"><h2 id="catalog-bulk-title">{catalogActionLabels[action]} · {items.length} sản phẩm</h2><button type="button" className="icon-button" aria-label="Đóng" disabled={busy} onClick={onClose}>×</button></div>
    <p id="catalog-bulk-description" className="text-pretty">{action === "delete" ? "Sản phẩm được chuyển vào danh sách đã xóa và có thể khôi phục. Chứng từ đã lưu giữ nguyên dữ liệu." : action === "restore" ? "Sản phẩm được khôi phục ở trạng thái ngừng áp dụng để bạn kiểm tra giá trước khi bật lại." : "Kiểm tra thay đổi trước khi xác nhận. Mọi sản phẩm phải còn đúng phiên bản đã chọn."}</p>
    {action === "price" && <div className="catalog-bulk-fields">
      <label>Điều chỉnh<select value={direction} disabled={busy} onChange={event => { setDirection(Number(event.target.value)); setPreview(null); }}><option value={1}>Tăng giá</option><option value={-1}>Giảm giá</option></select></label>
      <label>Cách tính<select value={mode} disabled={busy} onChange={event => { setMode(event.target.value as "amount" | "percent"); setPreview(null); }}><option value="percent">Theo phần trăm (%)</option><option value="amount">Theo số tiền</option></select></label>
      <label>Mức điều chỉnh<input type="number" required min="0" step="any" value={value} disabled={busy} onChange={event => { setValue(event.target.value); setPreview(null); }} aria-describedby={error ? "catalog-bulk-error" : "catalog-bulk-description"} /></label>
    </div>}
    {error && <p id="catalog-bulk-error" className="form-error" role="alert">{error}</p>}
    <div className="table-scroll" role="region" aria-label="Bảng xem trước thay đổi sản phẩm" tabIndex={0}><table className="data-table"><thead><tr><th>Sản phẩm</th><th>Giá hiện tại</th><th>Giá sau thao tác</th><th>Trạng thái sau thao tác</th></tr></thead><tbody>{(preview?.rows || items.map(item => ({ id: item._id, sku: item.sku, name: item.name, currency: item.currency, before: { price: item.price, active: item.active, deleted: Boolean(item.deletedAt) }, after: null }))).map(row => <tr key={row.id}><td><strong>{row.name}</strong><span className="table-subtext">{row.sku}</span></td><td>{formatMoney(row.before.price, row.currency)}</td><td>{row.after ? formatMoney(row.after.price, row.currency) : "Chưa xem trước"}</td><td>{row.after ? describe(row.after) : "—"}</td></tr>)}</tbody></table></div>
    <div className="preview-actions"><button type="button" className="button button-soft" autoFocus disabled={busy} onClick={onClose}>Hủy</button><button type="button" className="button button-soft" disabled={busy || (action === "price" && (!value || !Number.isFinite(Number(value)) || Number(value) < 0))} onClick={() => void check()}>{busy ? "Đang kiểm tra…" : "Xem trước thay đổi"}</button><button type="button" className={`button ${action === "delete" ? "button-danger" : "button-primary"}`} disabled={busy || !preview} onClick={() => void apply()}>Xác nhận {items.length} sản phẩm</button></div>
  </dialog>;
}
