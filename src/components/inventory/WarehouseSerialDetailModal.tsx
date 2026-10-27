import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { inventorySerialService, type InventorySerialUnit } from "../../services/inventorySerialService";
import type { InventoryBalance } from "../../services/inventoryReceivingService";

type Props = { balance: InventoryBalance; onClose: () => void };
const date = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa cập nhật";

export function WarehouseSerialDetailModal(props: Props) {
  const { balance } = props;
  return <UnitDetails key={`${balance.warehouseId}:${balance.productId}:${balance.variantId || ''}:${balance.sku}:${balance.trackingMode}`} {...props} />;
}

function UnitDetails({ balance, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [items, setItems] = useState<InventorySerialUnit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mode = balance.trackingMode === "unit_barcode" ? "unit_barcode" : "serial";
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); trigger?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    void inventorySerialService.list({ warehouseId: balance.warehouseId, productId: balance.productId, variantId: balance.variantId,
      sku: balance.sku, trackingMode: mode, status: "in_stock", limit: 100,
    }).then((result) => { if (active) setItems(result.items || []); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách đơn vị hàng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [balance.warehouseId, balance.productId, balance.variantId, balance.sku, mode]);
  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? items.filter((item) => [item.serialNumber, item.internalBarcode].some((code) => String(code || "").toLowerCase().includes(value))) : items;
  }, [items, query]);
  const hasWarranty = items.some((item) => item.supplierWarranty?.endAt);
  return createPortal(<dialog ref={dialogRef} aria-labelledby={titleId} onCancel={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[80vh] w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/50 [--color-on-surface-variant:var(--color-slate-600)]">
    <div className="flex max-h-[80vh] flex-col">
      <header className="flex items-start justify-between border-b border-outline-variant px-5 py-4">
        <div><h2 id={titleId} className="text-balance text-lg font-semibold">Chi tiết đơn vị hàng</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">{balance.productName || "Sản phẩm"} - {balance.variantName || balance.sku}</p></div>
        <button type="button" aria-label="Đóng chi tiết đơn vị" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="border-b border-outline-variant px-5 py-3"><div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 text-on-surface-variant" size={17} aria-hidden="true" />
        <input aria-label="Tìm đơn vị hàng" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm số sê-ri hoặc mã đơn vị" className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" />
      </div><p className="mt-2 text-xs tabular-nums text-on-surface-variant">Còn khả dụng: {Math.max(0, balance.quantity - balance.reservedQuantity)} | Hiển thị: {filteredItems.length}</p></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5" aria-busy={loading}>
        {loading && <p role="status" className="py-8 text-center text-sm text-on-surface-variant">Đang tải...</p>}
        {!loading && error && <p role="alert" className="py-8 text-center text-sm text-error">{error}</p>}
        {!loading && !error && !filteredItems.length && <p className="py-8 text-center text-sm text-on-surface-variant">Không có đơn vị hàng phù hợp.</p>}
        {!loading && !error && filteredItems.length > 0 && <div className="overflow-x-auto rounded-lg border border-outline-variant"><table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs text-on-surface-variant"><tr>{mode === "serial" && <th className="px-4 py-3">Số sê-ri</th>}<th className="px-4 py-3">Mã đơn vị</th>{hasWarranty && <th className="px-4 py-3">Bảo hành nhà cung cấp đến</th>}<th className="px-4 py-3">Trạng thái</th></tr></thead>
          <tbody className="divide-y divide-outline-variant">{filteredItems.map((item) => <tr key={item._id}>{mode === "serial" && <td className="px-4 py-3 font-medium">{item.serialNumber || "—"}</td>}<td className="px-4 py-3 text-xs text-on-surface-variant">{item.internalBarcode || "—"}</td>{hasWarranty && <td className="px-4 py-3 text-xs text-on-surface-variant">{date(item.supplierWarranty?.endAt)}</td>}<td className="px-4 py-3 text-sm">Trong kho</td></tr>)}</tbody>
        </table></div>}
      </div>
    </div>
  </dialog>, document.body);
}
