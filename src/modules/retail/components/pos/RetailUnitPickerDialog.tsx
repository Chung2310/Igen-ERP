import React from "react";
import { X } from "lucide-react";
import { inventorySerialService, type InventorySerialUnit } from "../../../../services/inventorySerialService";

type Props = { productId: string; variantId?: string; quantity: number; value: string[]; onChange: (values: string[]) => void };

function Picker({ productId, variantId, quantity, value, onChange, mode }: Props & { mode: "serial" | "unit_barcode" }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<InventorySerialUnit[]>([]);
  const [error, setError] = React.useState("");
  React.useEffect(() => { if (!open) return; let active = true; void inventorySerialService.list({ productId, variantId, status: "in_stock", limit: 100 }).then((result) => { if (active) setItems(result.items); }).catch((problem) => { if (active) setError(problem instanceof Error ? problem.message : "Không thể tải dữ liệu tồn kho."); }); return () => { active = false; }; }, [open, productId, variantId]);
  const filtered = items.filter((item) => { const text = `${item.serialNumber} ${item.internalBarcode}`.toLowerCase(); return text.includes(query.trim().toLowerCase()); });
  const toggle = (item: InventorySerialUnit) => { const next = mode === "serial" ? item.normalizedSerialNumber : item.normalizedInternalBarcode; if (value.includes(next)) onChange(value.filter((itemValue) => itemValue !== next)); else if (value.length < quantity) onChange([...value, next]); };
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-2 w-full rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-left text-xs font-bold text-cyan-900 hover:bg-cyan-100">{mode === "serial" ? "IMEI / Serial" : "Mã vạch nội bộ"}: {value.length}/{quantity} <span className="float-right font-semibold text-cyan-700">Chọn</span></button>
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"><div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b px-5 py-4"><div><h3 className="font-bold text-slate-900">Chọn {mode === "serial" ? "IMEI / Serial" : "mã vạch"}</h3><p className="mt-1 text-xs text-slate-500">Đã chọn {value.length}/{quantity}</p></div><button type="button" onClick={() => setOpen(false)}><X className="h-5 w-5 text-slate-400" /></button></div><div className="space-y-3 overflow-y-auto p-5"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm IMEI hoặc mã vạch..." className="w-full rounded-lg border px-3 py-2 text-sm" />{error && <p className="text-xs text-rose-600">{error}</p>}{filtered.map((item) => { const option = mode === "serial" ? item.normalizedSerialNumber : item.normalizedInternalBarcode; const checked = value.includes(option); const disabled = !checked && value.length >= quantity; return <label key={item._id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${checked ? "border-cyan-300 bg-cyan-50" : "border-slate-200"} ${disabled ? "opacity-50" : "cursor-pointer"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(item)} /><span className="text-sm">{mode === "serial" ? item.serialNumber : item.internalBarcode}</span></label>; })}{!filtered.length && !error && <p className="py-8 text-center text-sm text-slate-500">Không tìm thấy dữ liệu.</p>}</div><div className="flex justify-end border-t px-5 py-4"><button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white">Xác nhận</button></div></div></div>}
  </>;
}

export function SerialPicker(props: Props) { return <Picker {...props} mode="serial" />; }
export function UnitBarcodePicker(props: Props) { return <Picker {...props} mode="unit_barcode" />; }
