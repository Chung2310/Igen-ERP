import React, { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { inventorySerialService, type InventorySerialUnit } from "../../services/inventorySerialService";
import type { InventoryBalance } from "../../services/inventoryReceivingService";

type Props = { balance: InventoryBalance; onClose: () => void };

export function WarehouseSerialDetailModal({ balance, onClose }: Props) {
  const [items, setItems] = useState<InventorySerialUnit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    inventorySerialService.list({ warehouseId: balance.warehouseId, productId: balance.productId, variantId: balance.variantId, sku: balance.sku, status: "in_stock", limit: 100 })
      .then((result) => { if (active) setItems(result.items || []); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không thể tải danh sách IMEI/serial"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [balance.warehouseId, balance.productId, balance.variantId, balance.sku]);

  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => [item.serialNumber, item.internalBarcode].some((code) => String(code || "").toLowerCase().includes(value)));
  }, [items, query]);

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
    <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between border-b px-5 py-4"><div><h2 className="text-lg font-semibold text-slate-900">IMEI / serial tồn kho</h2><p className="mt-1 text-sm text-slate-500">{balance.productName || "Sản phẩm"} - {balance.variantName || balance.sku}</p></div><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={18} /></button></div>
      <div className="border-b px-5 py-3"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm IMEI, serial hoặc mã vạch" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div><div className="mt-2 text-xs text-slate-500">Còn khả dụng: {Math.max(0, balance.quantity - balance.reservedQuantity)} | Hiển thị: {filteredItems.length}</div></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{loading && <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>}{!loading && error && <div className="py-8 text-center text-sm text-red-600">{error}</div>}{!loading && !error && filteredItems.length === 0 && <div className="py-8 text-center text-sm text-slate-500">SKU này không có IMEI/serial hoặc mã vạch tồn kho.</div>}{!loading && !error && filteredItems.length > 0 && <div className="divide-y rounded-lg border border-slate-200">{filteredItems.map((item) => <div key={item._id} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{item.serialNumber || item.internalBarcode || "Không có mã định danh"}</div>{item.serialNumber && item.internalBarcode && <div className="text-xs text-slate-500">Mã vạch: {item.internalBarcode}</div>}</div><span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Còn tồn</span></div>)}</div>}</div>
    </div>
  </div>;
}
