import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
};

const toLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const toValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dateLabel = (date: Date) => new Intl.DateTimeFormat("vi-VN").format(date);
const monthLabel = (date: Date) => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(date);

export function AdminDatePicker({ label, value, onChange, min, max }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = toLocalDate(value) || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [position, setPosition] = useState({ top: 0, left: 0, width: 312 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(312, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const calendarHeight = popoverRef.current?.getBoundingClientRect().height || 380;
      const preferredTop = rect.bottom + calendarHeight + 8 > window.innerHeight && rect.top > calendarHeight
        ? rect.top - calendarHeight - 8
        : rect.bottom + 8;
      const top = Math.max(12, Math.min(preferredTop, window.innerHeight - calendarHeight - 12));
      setPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = toLocalDate(value);
  const today = new Date();
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1));
  const choose = (date: Date) => {
    onChange(toValue(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(false);
    triggerRef.current?.focus();
  };
  const allowed = (date: Date) => {
    const next = toValue(date);
    return (!min || next >= min) && (!max || next <= max);
  };

  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          const next = selected || new Date();
          setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
          setOpen((current) => !current);
        }}
        className="flex min-h-10 w-full min-w-40 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 text-left text-sm text-slate-700 transition-colors hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <span className={selected ? "" : "text-slate-400"}>{selected ? dateLabel(selected) : "Chọn ngày"}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Chọn ${label.toLowerCase()}`}
          className="fixed z-[200] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl bg-white p-4 text-slate-800 shadow-[0_18px_50px_rgba(13,48,78,0.18)]"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium capitalize">{monthLabel(month)}</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-2 text-slate-500 hover:bg-cyan-50 hover:text-cyan-700"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((date) => {
              const dateValue = toValue(date);
              const isSelected = dateValue === value;
              const isCurrentMonth = date.getMonth() === month.getMonth();
              return <button
                key={dateValue}
                type="button"
                aria-label={`Chọn ngày ${dateLabel(date)}`}
                aria-pressed={isSelected}
                disabled={!allowed(date)}
                onClick={() => choose(date)}
                className={`h-9 rounded-lg text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${isSelected ? "bg-[#00ADFC] font-medium text-white" : isCurrentMonth ? "text-slate-700 hover:bg-cyan-50" : "text-slate-400 hover:bg-slate-50"} ${dateValue === toValue(today) && !isSelected ? "bg-cyan-50 text-cyan-700" : ""}`}
              >{date.getDate()}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 pt-2 text-xs">
            <button type="button" onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }} className="rounded-lg px-2.5 py-1.5 text-slate-500 hover:bg-slate-50">Xóa ngày</button>
            <button type="button" disabled={!allowed(today)} onClick={() => choose(today)} className="rounded-lg bg-cyan-50 px-2.5 py-1.5 font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-40">Hôm nay</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
