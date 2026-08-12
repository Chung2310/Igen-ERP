import React, { useEffect, useState } from "react";
import { Boxes, RefreshCw } from "lucide-react";
import { inventoryReceivingService, type InventoryBalance, type Warehouse } from "../../services/inventoryReceivingService";
import { toast } from "../../pages/Toast";

const number = (value: number) => Number(value || 0).toLocaleString("vi-VN");

export function WarehouseSection() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const nextWarehouses = await inventoryReceivingService.listWarehouses();
      setWarehouses(nextWarehouses);
      const selected = warehouseId && nextWarehouses.some((item) => item._id === warehouseId) ? warehouseId : nextWarehouses[0]?._id || "";
      setWarehouseId(selected);
      setBalances(await inventoryReceivingService.listBalances(selected));
    } catch (error: any) { toast.error(error?.message || "Không thể tải số dư kho."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (warehouseId) void inventoryReceivingService.listBalances(warehouseId).then(setBalances).catch(() => undefined); }, [warehouseId]);

  return <section className="space-y-5" aria-label="Kho hàng và số dư">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div><h3 className="text-base font-semibold text-slate-900">Kho hàng và số dư</h3><p className="mt-1 text-sm text-slate-500">Số dư được theo dõi riêng theo từng kho và mã SKU.</p></div>
      <div className="flex gap-2"><select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Chọn kho</option>{warehouses.map((item) => <option key={item._id} value={item._id}>{item.name}{item.isDefault ? " (mặc định)" : ""}</option>)}</select><button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" title="Làm mới"><RefreshCw className="h-4 w-4" /></button></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="border border-slate-200 p-4"><p className="text-xs text-slate-500">Số kho</p><p className="mt-1 text-2xl font-semibold text-slate-900">{warehouses.length}</p></div><div className="border border-slate-200 p-4"><p className="text-xs text-slate-500">Mã hàng trong kho</p><p className="mt-1 text-2xl font-semibold text-slate-900">{balances.length}</p></div><div className="border border-slate-200 p-4"><p className="text-xs text-slate-500">Tổng số lượng</p><p className="mt-1 text-2xl font-semibold text-slate-900">{number(balances.reduce((sum, item) => sum + item.quantity, 0))}</p></div></div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200"><tr><th className="px-4 py-3.5 font-medium">Mã SKU</th><th className="px-4 py-3.5 font-medium">Sản phẩm</th><th className="px-4 py-3.5 font-medium">Kho</th><th className="px-4 py-3.5 text-right font-medium">Số lượng tồn</th><th className="px-4 py-3.5 text-right font-medium">Giá vốn bình quân</th><th className="px-4 py-3.5 text-right font-medium">Tổng giá trị</th></tr></thead><tbody className="divide-y divide-slate-200">{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Đang tải số dư...</td></tr> : balances.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500"><Boxes className="mx-auto mb-2 h-7 w-7 text-slate-300" />Chưa có số dư được chuyển đổi hoặc phát sinh.</td></tr> : balances.map((item) => <tr key={item._id} className="hover:bg-slate-50"><td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{item.sku}</td><td className="px-4 py-3.5 font-medium text-slate-900">{item.productName || "Sản phẩm không xác định"}</td><td className="px-4 py-3.5 text-slate-600">{warehouses.find((warehouse) => warehouse._id === item.warehouseId)?.name || item.warehouseId}</td><td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-700">{number(item.quantity)}</td><td className="px-4 py-3.5 text-right tabular-nums text-slate-600">{number(item.averageCost)}</td><td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-900">{number(item.quantity * item.averageCost)}</td></tr>)}</tbody></table></div>
  </section>;
}
