import React from "react";

type Props = {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
};

const formatter = new Intl.NumberFormat("vi-VN");

export default function CurrencyInput({ label, description, value, onChange }: Props) {
  return (
    <label className="block min-w-0 text-sm font-semibold">
      <span>{label}</span>
      {description && <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span>}
      <span className="relative mt-1 block min-w-0">
        <input
          aria-label={label}
          type="text"
          inputMode="numeric"
          className="w-full min-w-0 rounded-xl border px-3 py-2 pr-8"
          value={value ? formatter.format(value) : ""}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            onChange(Number(digits || 0));
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">₫</span>
      </span>
    </label>
  );
}
