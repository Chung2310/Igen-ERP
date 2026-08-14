import React, { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Pencil, X } from "lucide-react";
import type { InventoryBalance } from "../../services/inventoryReceivingService";

type Props = { balances: InventoryBalance[]; onSave: (balance: InventoryBalance, minStock: number, maxStock?: number) => Promise<void> };
type AlertLevel = "out" | "low" | "near" | "over";
const format = (value: number) => Number(value || 0).toLocaleString("vi-VN");

function getAlert(balance: InventoryBalance): AlertLevel | null {
  const available = Math.max(0, balance.quantity - balance.reservedQuantity);
  const min = Number(balance.minStock || 0);
  const max = balance.maxStock;
  if (available === 0) return "out";
  if (min > 0 && available < min) return "low";
  if (min > 0 && available <= Math.ceil(min * 1.2)) return "near";
  if (max !== undefined && max > 0 && available > max) return "over";
  return null;
}

const alertStyle: Record<AlertLevel, { label: string; className: string }> = {
  out: { label: "Hết hàng", className: "bg-rose-50 text-rose-700" },
  low: { label: "Dưới mức tối thiểu", className: "bg-orange-50 text-orange-700" },
  near: { label: "Sắp chạm mức tối thiểu", className: "bg-amber-50 text-amber-700" },
  over: { label: "Vượt mức tối đa", className: "bg-violet-50 text-violet-700" },
};

export function StockAlertPanel({ balances, onSave }: Props) {
  const [editing, setEditing] = useState<InventoryBalance | null>(null);
  const [minStock, setMinStock] = useState("0");
  const [maxStock, setMaxStock] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => balances.map((balance) => ({ balance, level: getAlert(balance) })).filter((item): item is { balance: InventoryBalance; level: AlertLevel } => Boolean(item.level)), [balances]);
  const counts = useMemo(() => ({ out: rows.filter((item) => item.level === "out").length, low: rows.filter((item) => item.level === "low").length, near: rows.filter((item) => item.level === "near").length, over: rows.filter((item) => item.level === "over").length }), [rows]);
  const open = (balance: InventoryBalance) => { setEditing(balance); setMinStock(String(balance.minStock || 0)); setMaxStock(balance.maxStock === undefined ? "" : String(balance.maxStock)); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!editing) return; const min = Number(minStock); const max = maxStock.trim() === "" ? undefined : Number(maxStock); if (!Number.isFinite(min) || min < 0 || (max !== undefined && (!Number.isFinite(max) || max < min))) return; setSaving(true); try { await onSave(editing, min, max); setEditing(null); } finally { setSaving(false); } };
  return <section className="space-y-3" aria-label="Cảnh báo tồn kho">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">Cảnh báo tồn kho</h3><p className="mt-1 text-sm text-slate-500">Tính theo tồn khả dụng: tồn thực tế trừ hàng đã giữ.</p></div><span className="text-xs text-slate-500">Thiết lập min/max riêng theo từng SKU</span></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Hết hàng" value={counts.out} tone="rose" /><Metric label="Dưới mức min" value={counts.low} tone="orange" /><Metric label="Sắp chạm min" value={counts.near} tone="amber" /><Metric label="Vượt mức max" value={counts.over} tone="violet" /></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">SKU / biến thể</th><th className="px-4 py-3 text-right">Khả dụng</th><th className="px-4 py-3 text-right">Min</th><th className="px-4 py-3 text-right">Max</th><th className="px-4 py-3">Cảnh báo</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-9 text-center text-slate-500"><Boxes className="mx-auto mb-2 h-6 w-6 text-emerald-400" />Tồn kho đang nằm trong ngưỡng đã thiết lập.</td></tr> : rows.map(({ balance, level }) => { const available = Math.max(0, balance.quantity - balance.reservedQuantity); const suggestion = level === "out" || level === "low" || level === "near" ? Math.max(0, Number(balance.minStock || 0) - available) : 0; return <tr key={balance._id}><td className="px-4 py-3"><p className="font-semibold text-slate-800">{balance.productName || balance.sku}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{balance.sku}{balance.variantName ? ` · ${balance.variantName}` : ""}</p></td><td className="px-4 py-3 text-right font-semibold tabular-nums">{format(available)}</td><td className="px-4 py-3 text-right tabular-nums">{format(Number(balance.minStock || 0))}</td><td className="px-4 py-3 text-right tabular-nums">{balance.maxStock === undefined ? "—" : format(balance.maxStock)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${alertStyle[level].className}`}>{alertStyle[level].label}{suggestion > 0 ? ` · cần thêm ${format(suggestion)}` : ""}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => open(balance)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Ngưỡng</button></td></tr>; })}</tbody></table></div></div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"><form onSubmit={save} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between"><div><h4 className="font-bold text-slate-900">Thiết lập ngưỡng tồn kho</h4><p className="mt-1 text-sm text-slate-500">{editing.sku}{editing.variantName ? ` · ${editing.variantName}` : ""}</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="mt-5 grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-700">Tồn tối thiểu<input type="number" min="0" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3" /></label><label className="text-sm font-medium text-slate-700">Tồn tối đa<input type="number" min="0" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} placeholder="Không giới hạn" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3" /></label></div><p className="mt-3 flex gap-2 text-xs text-slate-500"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />Mức tối đa để trống nghĩa là không cảnh báo tồn vượt ngưỡng.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu ngưỡng"}</button></div></form></div>}
  </section>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "rose" | "orange" | "amber" | "violet" }) { const tones = { rose: "border-rose-200 bg-rose-50 text-rose-700", orange: "border-orange-200 bg-orange-50 text-orange-700", amber: "border-amber-200 bg-amber-50 text-amber-700", violet: "border-violet-200 bg-violet-50 text-violet-700" }; return <div className={`rounded-xl border p-3 ${tones[tone]}`}><p className="text-xs font-medium">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>; }
