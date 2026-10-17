import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

const parseDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
};

const toValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDate = (date: Date) => date.toLocaleDateString("vi-VN");

export function PayrollDatePicker({ value, onChange, label }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = parseDate(value) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [position, setPosition] = useState({ top: 0, left: 0, width: 300 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(300, window.innerWidth - 24);
      const height = calendarRef.current?.getBoundingClientRect().height || 350;
      const placeAbove = window.innerHeight - trigger.bottom < height + 12 && trigger.top > height;
      setPosition({
        top: Math.max(12, Math.min(placeAbove ? trigger.top - height - 6 : trigger.bottom + 6, window.innerHeight - height - 12)),
        left: Math.max(12, Math.min(trigger.left, window.innerWidth - width - 12)),
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
  }, [open, month]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !calendarRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const selected = parseDate(value);
  const today = new Date();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((offset + dayCount) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  const choose = (date: Date) => {
    onChange(toValue(date));
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div className="mt-1">
    <button
      ref={triggerRef}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => {
        const date = selected ?? new Date();
        setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setOpen((current) => !current);
      }}
      className="flex h-10 w-full items-center justify-between rounded-xl border border-[#DCE7F4] bg-white px-3 text-left text-sm text-slate-700 outline-none transition-colors hover:border-[#A9DDF5] focus-visible:ring-2 focus-visible:ring-[#00ADFC]/20"
    >
      <span className={selected ? "" : "text-slate-400"}>{selected ? formatDate(selected) : "Chọn ngày"}</span>
      <CalendarDays className="h-4 w-4 text-[#008BC9]" aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={calendarRef} role="dialog" aria-label={`Chọn ${label.toLowerCase()}`} className="fixed z-[70] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl bg-white p-3 text-slate-700 shadow-[0_18px_50px_rgba(13,48,78,0.22)]" style={position}>
        <div className="mb-2 flex items-center justify-between rounded-xl bg-[#F0F9FF] px-2 py-1">
          <span className="text-sm font-medium capitalize text-[#096A9E]">{month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-[#007EB8] hover:bg-white"><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-[#007EB8] hover:bg-white"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-[#007EB8]">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const selectedDay = toValue(date) === value;
            const inMonth = date.getMonth() === month.getMonth();
            const isToday = toValue(date) === toValue(today);
            return <button key={toValue(date)} type="button" aria-label={formatDate(date)} aria-pressed={selectedDay} onClick={() => choose(date)} className={`h-8 rounded-lg text-xs transition-colors ${selectedDay ? "bg-[#00A4E8] text-white" : isToday ? "bg-[#E4F6FF] text-[#007EB8]" : inMonth ? "text-slate-700 hover:bg-[#EDF8FE]" : "text-slate-400 hover:bg-slate-50"}`}>{date.getDate()}</button>;
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs">
          <button type="button" onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }} className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-50">Xóa ngày</button>
          <button type="button" onClick={() => choose(today)} className="rounded-lg bg-[#E4F6FF] px-2 py-1.5 text-[#007EB8] hover:bg-[#D4EFFD]">Hôm nay</button>
        </div>
      </div>,
      document.body,
    )}
  </div>;
}
