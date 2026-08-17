import React from "react";
import { inventoryCountService, type InventoryCount } from "../../services/inventoryCountService";
import { toast } from "../../pages/Toast";
import { BarcodeInput } from "./BarcodeInput";
const BarcodeScannerDialog = React.lazy(() => import("./InventoryBarcodeScannerDialog"));

export function InventoryCountingSection({ warehouseId }: { warehouseId: string }) {
  const [count, setCount] = React.useState<InventoryCount | null>(null);
  const [counts, setCounts] = React.useState<InventoryCount[]>([]);
  const [camera, setCamera] = React.useState(false);
  React.useEffect(() => { if (warehouseId) void inventoryCountService.list(warehouseId).then(setCounts).catch(() => undefined); }, [warehouseId]);
  React.useEffect(() => { const sync = () => void inventoryCountService.syncPending(); window.addEventListener("online", sync); sync(); return () => window.removeEventListener("online", sync); }, []);
  const create = async () => { try { const next = await inventoryCountService.create(warehouseId); setCount(next); setCounts((current) => [next, ...current]); } catch (error: any) { toast.error(error?.message || "Không thể tạo phiếu kiểm kê."); } };
  const scan = async (barcode: string) => {
    if (!count) return;
    const item = count.items.find((entry) => entry.barcode === barcode);
    if (!item) { toast.error("Không tìm thấy SKU tương ứng với mã vạch."); return; }
    try { setCount(await inventoryCountService.updateItem(count._id, item._id, item.countedQuantity + 1)); } catch (error: any) { toast.error(error?.message || "Không thể cập nhật số đếm."); }
  };
  const update = async (action: "start" | "submit" | "approve" | "cancel") => {
    if (!count) return;
    try { const next = await inventoryCountService[action](count._id); setCount(next); setCounts((current) => [next, ...current.filter((item) => item._id !== next._id)]); } catch (error: any) { toast.error(error?.message || "Không thể cập nhật phiếu kiểm kê."); }
  };
  const discrepancy = count?.items.reduce((total, item) => total + item.quantityDelta, 0) || 0;
  const matched = count?.items.filter((item) => item.quantityDelta === 0).length || 0;
  const shortages = count?.items.filter((item) => item.quantityDelta < 0).length || 0;
  const surpluses = count?.items.filter((item) => item.quantityDelta > 0).length || 0;
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Kiểm kê kho">
    <div className="flex items-center justify-between"><div><h3 className="font-semibold">Kiểm kê bằng mã vạch</h3><p className="text-sm text-slate-500">Dùng camera điện thoại hoặc đầu đọc USB/Bluetooth.</p></div><button type="button" disabled={!warehouseId} onClick={() => void create()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Tạo phiếu</button></div>
    {counts.length > 0 && <select aria-label="Phiếu kiểm kê" value={count?._id || ""} onChange={(event) => { const selected = counts.find((item) => item._id === event.target.value); if (selected) setCount(selected); }} className="w-full rounded-md border px-3 py-2 text-sm"><option value="">Chọn phiếu đã tạo</option>{counts.map((item) => <option key={item._id} value={item._id}>{item.countCode} · {item.status}</option>)}</select>}
    {count && <><p className="text-sm">Phiếu <strong>{count.countCode}</strong> · {count.status} · Chênh lệch: <strong className={discrepancy === 0 ? "text-emerald-600" : "text-rose-600"}>{discrepancy > 0 ? "+" : ""}{discrepancy}</strong></p><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded bg-emerald-50 p-2 text-emerald-700"><strong className="block text-lg">{matched}</strong>Khớp</div><div className="rounded bg-rose-50 p-2 text-rose-700"><strong className="block text-lg">{shortages}</strong>Thiếu</div><div className="rounded bg-amber-50 p-2 text-amber-700"><strong className="block text-lg">{surpluses}</strong>Thừa</div></div>
      <BarcodeInput onScan={(value) => void scan(value)} onCameraRequest={() => setCamera(true)} disabled={count.status !== "draft" && count.status !== "counting"} />
      <div className="flex gap-2">{count.status === "draft" && <button type="button" onClick={() => void update("start")} className="rounded border px-3 py-1 text-sm">Bắt đầu đếm</button>}{count.status === "counting" && <button type="button" onClick={() => void update("submit")} className="rounded bg-amber-600 px-3 py-1 text-sm text-white">Gửi duyệt</button>}{count.status === "pending_approval" && <button type="button" onClick={() => void update("approve")} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Duyệt điều chỉnh</button>}{(count.status === "draft" || count.status === "counting") && <button type="button" onClick={() => void update("cancel")} className="rounded border border-rose-200 px-3 py-1 text-sm text-rose-700">Hủy phiếu</button>}</div>
      <div className="max-h-80 overflow-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-2">SKU</th><th className="p-2">Mã vạch</th><th className="p-2 text-right">Hệ thống</th><th className="p-2 text-right">Đã đếm</th><th className="p-2 text-right">Chênh</th></tr></thead><tbody>{count.items.map((item) => <tr key={item._id} className="border-t"><td className="p-2 font-mono">{item.sku}</td><td className="p-2">{item.barcode || "—"}</td><td className="p-2 text-right">{item.systemQuantity}</td><td className="p-2 text-right"><input type="number" min="0" disabled={count.status !== "draft" && count.status !== "counting"} value={item.countedQuantity} onChange={(event) => { const quantity = Number(event.target.value); setCount((current) => current ? { ...current, items: current.items.map((line) => line._id === item._id ? { ...line, countedQuantity: quantity, quantityDelta: quantity - line.systemQuantity } : line) } : current); }} onBlur={() => { const line = count.items.find((entry) => entry._id === item._id); if (line) void inventoryCountService.updateItem(count._id, item._id, line.countedQuantity).then(setCount).catch((error: any) => toast.error(error?.message || "Không thể lưu số lượng.")); }} className="w-20 rounded border px-2 py-1 text-right" /></td><td className="p-2 text-right">{item.quantityDelta > 0 ? "+" : ""}{item.quantityDelta}</td></tr>)}</tbody></table></div>
    </>}
    {camera && <React.Suspense fallback={<p className="rounded-xl bg-slate-50 p-3 text-sm">Đang tải bộ quét camera...</p>}><BarcodeScannerDialog onScan={(value) => { setCamera(false); void scan(value); }} onClose={() => setCamera(false)} /></React.Suspense>}
  </section>;
}
