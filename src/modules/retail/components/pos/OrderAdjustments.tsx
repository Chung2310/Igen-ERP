import React from "react";
import type { RetailDiscountInput } from "../../types";
import DiscountInput from "./DiscountInput";

type Value = { orderDiscount: RetailDiscountInput; taxRate: number; shippingFee: number };
type Props = Value & { onChange: (value: Value) => void };

export default function OrderAdjustments({ orderDiscount, taxRate, shippingFee, onChange }: Props) {
  return (
    <div className="space-y-3.5">
      <DiscountInput
        label="Giảm giá đơn"
        value={orderDiscount}
        onChange={(next) => onChange({ orderDiscount: next, taxRate, shippingFee })}
      />
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label htmlFor="tax-rate-field" className="block text-xs font-semibold text-slate-600 mb-1">
            Thuế suất
          </label>
          <div className="relative flex items-center">
            <input
              id="tax-rate-field"
              aria-label="Thuế suất"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:border-[#0866f5] focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 transition"
              value={taxRate}
              onChange={(event) =>
                onChange({
                  orderDiscount,
                  taxRate: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                  shippingFee,
                })
              }
            />
            <span className="pointer-events-none absolute right-3 text-xs font-bold text-slate-400 select-none">
              %
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="shipping-fee-field" className="block text-xs font-semibold text-slate-600 mb-1">
            Phí vận chuyển
          </label>
          <div className="relative flex items-center">
            <input
              id="shipping-fee-field"
              aria-label="Phí vận chuyển"
              type="number"
              min="0"
              step="1"
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:border-[#0866f5] focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 transition"
              value={shippingFee}
              onChange={(event) =>
                onChange({
                  orderDiscount,
                  taxRate,
                  shippingFee: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                })
              }
            />
            <span className="pointer-events-none absolute right-3 text-xs font-bold text-slate-400 select-none">
              ₫
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
