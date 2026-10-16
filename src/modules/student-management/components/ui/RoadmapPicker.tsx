import React from "react";
import { ChevronDown } from "lucide-react";

export type RoadmapPickerOption = { value: string; label: string };

export function RoadmapPicker({ value, options, placeholder, disabled = false, className = "", onChange }: { value: string; options: RoadmapPickerOption[]; placeholder: string; disabled?: boolean; className?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  React.useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  return <div ref={rootRef} className="relative">
    <button type="button" disabled={disabled} aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-9 w-full items-center justify-between rounded-xl border border-sky-100 bg-white px-3 text-left text-sm font-normal text-slate-800 outline-none transition-colors hover:border-sky-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${className}`}>
      <span data-placeholder={selected ? undefined : ""} className={selected ? "truncate" : "truncate text-slate-500"}>{selected?.label || placeholder}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open ? <div role="listbox" className="absolute z-[100] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-sky-100 bg-white p-1 shadow-lg shadow-slate-200/50">
      <button type="button" role="option" data-placeholder aria-selected={!value} onClick={() => { onChange(""); setOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm font-normal text-slate-500 hover:bg-sky-50">{placeholder}</button>
      {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} className={`w-full rounded-lg px-3 py-2 text-left text-sm font-normal transition-colors hover:bg-sky-50 ${option.value === value ? "bg-brand-primary/10 text-brand-primary" : "text-slate-700"}`}>{option.label}</button>)}
    </div> : null}
  </div>;
}
