import React from "react";
import type { RetailDiscountInput } from "../../types";
import DiscountInput from "./DiscountInput";

type Value = { orderDiscount: RetailDiscountInput; taxRate: number; shippingFee: number };
type Props = Value & { onChange: (value: Value) => void };

export default function OrderAdjustments({ orderDiscount, taxRate, shippingFee, onChange }: Props) {
  return <div className="space-y-2 rounded-xl bg-surface-container-low p-3">
    <DiscountInput label="Giảm giá đơn" value={orderDiscount} onChange={(next) => onChange({ orderDiscount: next, taxRate, shippingFee })} />
    <div className="grid grid-cols-2 gap-2">
      <label className="min-w-0 text-xs text-on-surface-variant">Thuế suất<input aria-label="Thuế suất" type="number" min="0" max="100" step="0.01" className="mt-1 w-full min-w-0 rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface" value={taxRate} onChange={(event) => onChange({ orderDiscount, taxRate: Math.min(100, Math.max(0, Number(event.target.value) || 0)), shippingFee })} /></label>
      <label className="min-w-0 text-xs text-on-surface-variant">Phí vận chuyển<input aria-label="Phí vận chuyển" type="number" min="0" step="1" className="mt-1 w-full min-w-0 rounded-xl border border-outline bg-surface-container-lowest px-3 py-2 text-sm text-on-surface" value={shippingFee} onChange={(event) => onChange({ orderDiscount, taxRate, shippingFee: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} /></label>
    </div>
  </div>;
}
