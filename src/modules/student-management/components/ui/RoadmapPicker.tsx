import React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type RoadmapPickerOption = { value: string; label: string };

export function RoadmapPicker({ value, options, placeholder, disabled = false, allowClear = true, className = "", portal = false, ariaLabel, onChange }: { value: string; options: RoadmapPickerOption[]; placeholder: string; disabled?: boolean; allowClear?: boolean; className?: string; portal?: boolean; ariaLabel?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0, maxHeight: 224 });
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  React.useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  React.useEffect(() => {
    if (!open || !portal) return;
    const close = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, portal]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    if (portal) {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const desiredHeight = Math.min(224, (options.length + Number(allowClear)) * 40 + 8);
      const below = window.innerHeight - bounds.bottom - 8;
      const above = bounds.top - 8;
      const placeAbove = below < desiredHeight && above > below;
      const maxHeight = Math.min(desiredHeight, Math.max(80, placeAbove ? above : below));
      setPosition({
        top: placeAbove ? bounds.top - maxHeight - 4 : bounds.bottom + 4,
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - bounds.width - 8)),
        width: Math.min(bounds.width, window.innerWidth - 16),
        maxHeight,
      });
    }
    setOpen(true);
  };

  const menu = <div ref={menuRef} role="listbox" aria-label={ariaLabel || placeholder} className={`${portal ? "fixed" : "absolute mt-1 w-full"} z-[100] max-h-56 overflow-y-auto rounded-xl border border-sky-100 bg-white p-1 shadow-lg shadow-slate-200/50`} style={portal ? position : undefined}>
    {allowClear && <button type="button" role="option" data-placeholder aria-selected={!value} onClick={() => { onChange(""); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-normal text-slate-500 hover:bg-sky-50">{placeholder}</button>}
    {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm font-normal transition-colors hover:bg-sky-50 ${option.value === value ? "bg-brand-primary/10 text-brand-primary" : "text-slate-700"}`}>{option.label}</button>)}
  </div>;

  return <div ref={rootRef} className="relative">
    <button ref={triggerRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={toggle} className={`flex h-9 w-full items-center justify-between rounded-xl border border-sky-100 bg-white px-3 text-left text-sm font-normal text-slate-800 outline-none transition-colors hover:border-sky-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}>
      <span data-placeholder={selected ? undefined : ""} className={selected ? "truncate" : "truncate text-slate-500"}>{selected?.label || placeholder}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && (portal ? createPortal(menu, document.body) : menu)}
  </div>;
}
