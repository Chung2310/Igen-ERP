import React, { useEffect, useRef, useState, useId } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import type { SupplyItem } from "../../types/supply";

/** In-flow picker: its list stays within the modal rather than overflowing or being clipped. */
export function SupplyLinePicker({
  items,
  value,
  onChange,
  label,
  disabled,
}: {
  items: SupplyItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = items.find((item) => item._id === value);
  const query = search.trim().toLocaleLowerCase("vi");
  const matches = items.filter((item) => `${item.name} ${item.code}`.toLocaleLowerCase("vi").includes(query));
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    setSearch("");
    trigger.current?.focus();
  };
  return (
    <div
      className="min-w-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-xs transition hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold text-slate-900">
            {selected?.name || "Chọn vật tư"}
          </span>
          <span className="mt-1 block break-all text-xs text-slate-500">
            {selected?.code || "Tìm theo tên hoặc mã vật tư"}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={id} className="mt-2 min-w-0 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              ref={field}
              aria-label={`Tìm ${label.toLowerCase()}`}
              className="h-10 w-full min-w-0 bg-transparent text-base text-slate-900 outline-none"
              placeholder="Tìm theo tên hoặc mã…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>
          <div className="max-h-60 overflow-y-auto overscroll-contain" role="group" aria-label="Kết quả tìm vật tư">
            {matches.map((item) => (
              <button
                key={item._id}
                type="button"
                disabled={disabled}
                aria-pressed={item._id === value}
                className="flex w-full min-w-0 items-start gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none"
                onClick={() => {
                  onChange(item._id);
                  close();
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="mt-1 block break-words text-xs text-slate-500">
                    {item.code} · Tồn: {item.quantity.toLocaleString("vi-VN")} {item.unit}
                  </span>
                </span>
                {item._id === value && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                )}
              </button>
            ))}
            {!matches.length && <p className="p-4 text-sm text-slate-500">Không tìm thấy vật tư phù hợp.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
