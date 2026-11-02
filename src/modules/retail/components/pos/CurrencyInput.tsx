import React from "react";

type Props = {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
};

const formatter = new Intl.NumberFormat("vi-VN");

export default function CurrencyInput({ label, description, value, onChange, readOnly }: Props) {
  return (
    <label className="block min-w-0">
      <div className="h-9 flex flex-col justify-start overflow-hidden">
        <span className="block text-xs font-bold text-slate-700 truncate">{label}</span>
        {description && (
          <span
            className="mt-0.5 block text-[11px] font-normal text-slate-400 truncate"
            title={description}
          >
            {description}
          </span>
        )}
      </div>
      <span className="relative mt-1.5 block min-w-0">
        <input
          aria-label={label}
          readOnly={readOnly}
          type="text"
          inputMode="numeric"
          className="w-full h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 pr-8 font-mono text-sm font-bold text-slate-900 shadow-2xs hover:border-slate-300 focus:border-[#0866f5] focus:outline-none focus:ring-2 focus:ring-[#0866f5]/20 transition"
          value={value ? formatter.format(value) : ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            onChange(Number(digits || 0));
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
          ₫
        </span>
      </span>
    </label>
  );
}
