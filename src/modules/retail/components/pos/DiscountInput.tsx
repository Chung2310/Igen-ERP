import React from "react";
import { Dropdown } from "../../../../components/common/Dropdown";
import type { RetailDiscountInput } from "../../types";

type Props = { label: string; value: RetailDiscountInput; onChange: (value: RetailDiscountInput) => void };

const discountTypeOptions = [
  { value: "amount", label: "Số tiền" },
  { value: "percent", label: "Phần trăm" },
];

export default function DiscountInput({ label, value, onChange }: Props) {
  return (
    <fieldset className="min-w-0 border-0 p-0 text-xs text-slate-500">
      <legend className="block text-xs font-semibold text-slate-600 mb-1">{label}</legend>
      <div className="grid grid-cols-[130px_1fr] gap-2 items-center">
        <Dropdown<string>
          name={`discountType_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`}
          aria-label={`Loại ${label.toLowerCase()}`}
          value={value.type}
          onChange={(nextType) =>
            onChange({ type: nextType as RetailDiscountInput["type"], value: 0 })
          }
          options={discountTypeOptions}
          variant="form"
          size="sm"
          className="w-full"
          triggerClassName="w-full bg-white border-slate-200 text-slate-800 font-semibold shadow-2xs hover:border-slate-300"
        />
        <div className="relative flex items-center">
          <input
            aria-label={label}
            type="number"
            min="0"
            max={value.type === "percent" ? 100 : undefined}
            step={value.type === "percent" ? "0.01" : "1"}
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:border-[#0866f5] focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 transition"
            value={value.value}
            onChange={(event) =>
              onChange({ ...value, value: Math.max(0, Number(event.target.value) || 0) })
            }
          />
          <span className="pointer-events-none absolute right-3 text-xs font-bold text-slate-400 select-none">
            {value.type === "percent" ? "%" : "₫"}
          </span>
        </div>
      </div>
    </fieldset>
  );
}
