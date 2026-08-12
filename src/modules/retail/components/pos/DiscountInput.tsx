import React from "react";
import type { RetailDiscountInput } from "../../types";

type Props = { label: string; value: RetailDiscountInput; onChange: (value: RetailDiscountInput) => void };

export default function DiscountInput({ label, value, onChange }: Props) {
  return <fieldset className="min-w-0 border-0 p-0 text-xs text-slate-500">
    <legend>{label}</legend>
    <div className="mt-1 grid grid-cols-[120px_1fr] gap-2">
      <select aria-label={`Loại ${label.toLowerCase()}`} className="rounded-xl border bg-white px-2 py-2 text-sm text-slate-900" value={value.type} onChange={(event) => onChange({ type: event.target.value as RetailDiscountInput["type"], value: 0 })}>
        <option value="amount">Số tiền</option><option value="percent">Phần trăm</option>
      </select>
      <input aria-label={label} type="number" min="0" max={value.type === "percent" ? 100 : undefined} step={value.type === "percent" ? "0.01" : "1"} className="rounded-xl border bg-white px-3 py-2 text-sm text-slate-900" value={value.value} onChange={(event) => onChange({ ...value, value: Math.max(0, Number(event.target.value) || 0) })} />
    </div>
  </fieldset>;
}
