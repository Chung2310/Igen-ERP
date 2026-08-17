import React from "react";
import { inventorySerialService, type InventorySerialUnit } from "../../../../services/inventorySerialService";

export default function UnitBarcodePicker({ productId, variantId, quantity, value, onChange }: { productId: string; variantId?: string; quantity: number; value: string[]; onChange: (values: string[]) => void }) {
  const [items, setItems] = React.useState<InventorySerialUnit[]>([]);
  const [error, setError] = React.useState("");
  React.useEffect(() => { let active = true; void inventorySerialService.list({ productId, variantId, status: "in_stock", limit: 100 }).then((result) => { if (active) setItems(result.items); }).catch((problem) => { if (active) setError(problem instanceof Error ? problem.message : "Không thể tải mã vạch tồn kho."); }); return () => { active = false; }; }, [productId, variantId]);
  return <div className="mt-2 rounded-lg border border-cyan-100 bg-cyan-50/50 p-2"><label className="text-xs font-bold text-cyan-900">Mã vạch nội bộ ({value.length}/{quantity})<select multiple value={value} onChange={(event) => onChange(Array.from(event.target.selectedOptions).map((option) => option.value).slice(0, quantity))} className="mt-1 min-h-20 w-full rounded border border-cyan-200 bg-white p-1 text-xs"><option value="" disabled>{items.length ? "Chọn mã vạch (Ctrl/Cmd để chọn nhiều)" : "Không còn mã vạch tồn"}</option>{items.map((item) => <option key={item._id} value={item.normalizedInternalBarcode}>{item.internalBarcode}</option>)}</select></label>{error && <p className="mt-1 text-xs text-rose-600">{error}</p>}</div>;
}
