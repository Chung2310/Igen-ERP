import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export function MonthPicker({ value, onChange, ariaLabel = "Chọn tháng lương", appearance = "default" }: { value: string; onChange: (value: string) => void; ariaLabel?: string; appearance?: "default" | "erp" }) {
  const erp = appearance === "erp";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const [position, setPosition] = useState({ top: 0, left: 0, width: 272 });
  const selectedMonth = Number(value.slice(5, 7));

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(272, window.innerWidth - 24);
      const height = popoverRef.current?.getBoundingClientRect().height || 250;
      const placeAbove = window.innerHeight - bounds.bottom < height + 12 && bounds.top > height;
      setPosition({
        top: Math.max(12, Math.min(placeAbove ? bounds.top - height - 6 : bounds.bottom + 6, window.innerHeight - height - 12)),
        left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)),
        width,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const displayValue = /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? `${MONTHS[selectedMonth - 1]}/${value.slice(0, 4)}`
    : value;

  return <div>
    <button
      ref={triggerRef}
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => { setYear(Number(value.slice(0, 4))); setOpen((current) => !current); }}
      className={erp ? "flex h-9 min-w-40 items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal text-on-surface hover:border-primary focus-visible:border-primary focus-visible:outline-none" : "flex h-10 min-w-40 items-center justify-between gap-3 rounded-xl border border-[#DCE7F4] bg-white px-3.5 text-sm font-normal text-slate-700 outline-none transition-colors hover:border-[#B8E8FF] focus-visible:ring-2 focus-visible:ring-[#00ADFC]/20"}
    >
      <span>{displayValue}</span>
      <CalendarDays className={erp ? "size-4 shrink-0 text-primary" : "h-4 w-4 shrink-0 text-[#007EB8]"} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={popoverRef} role="dialog" aria-label={`Lịch ${ariaLabel.toLowerCase()}`} className={erp ? "fixed z-[200] rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-on-surface shadow-sm" : "fixed z-[200] rounded-2xl border border-[#DCE7F4] bg-white p-3 text-slate-700 shadow-[0_18px_50px_rgba(13,48,78,0.18)]"} style={position}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm">Năm {year}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Năm trước" onClick={() => setYear((current) => current - 1)} className={erp ? "rounded-md p-1.5 text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary" : "rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-[#E8F7FF] hover:text-[#007EB8]"}><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Năm sau" onClick={() => setYear((current) => current + 1)} className={erp ? "rounded-md p-1.5 text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary" : "rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-[#E8F7FF] hover:text-[#007EB8]"}><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((month, index) => {
            const monthValue = `${year}-${String(index + 1).padStart(2, "0")}`;
            return <button key={month} type="button" aria-label={`${month} năm ${year}`} aria-pressed={monthValue === value} onClick={() => { onChange(monthValue); setOpen(false); triggerRef.current?.focus(); }} className={erp ? `rounded-md px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-primary ${monthValue === value ? "bg-primary text-on-primary" : "text-on-surface hover:bg-primary/5"}` : `rounded-lg px-2 py-2 text-xs transition-colors ${monthValue === value ? "bg-[#00ADFC] text-white" : "text-slate-700 hover:bg-[#E8F7FF] hover:text-[#007EB8]"}`}>{month}</button>;
          })}
        </div>
      </div>, document.body,
    )}
  </div>;
}
