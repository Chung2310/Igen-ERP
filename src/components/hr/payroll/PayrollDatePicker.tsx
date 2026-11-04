import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  clearable?: boolean;
  portalTarget?: () => Element | null;
};

const parseDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null;
};

const toValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDate = (date: Date) => date.toLocaleDateString("vi-VN");

export function PayrollDatePicker({ value, onChange, label, clearable = true, portalTarget }: Props) {
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
      className="flex min-h-11 w-full items-center justify-between rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-left text-sm text-on-surface hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className={selected ? "" : "text-on-surface-variant"}>{selected ? formatDate(selected) : "Chọn ngày"}</span>
      <CalendarDays className="size-4 text-primary" aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={calendarRef} role="dialog" aria-label={`Chọn ${label.toLowerCase()}`} className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-on-surface shadow-lg" style={position}>
        <div className="mb-2 flex items-center justify-between rounded-md bg-primary/10 px-2 py-1">
          <span className="text-sm font-medium capitalize text-on-surface">{month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-md p-1.5 text-on-surface hover:bg-surface-container-lowest focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-md p-1.5 text-on-surface hover:bg-surface-container-lowest focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-medium text-on-surface-variant">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const selectedDay = toValue(date) === value;
            const inMonth = date.getMonth() === month.getMonth();
            const isToday = toValue(date) === toValue(today);
            return <button key={toValue(date)} type="button" aria-label={formatDate(date)} aria-pressed={selectedDay} onClick={() => choose(date)} className={`h-8 rounded-md text-xs focus-visible:outline-2 focus-visible:outline-primary ${selectedDay ? "border border-primary bg-primary/15 font-semibold text-on-surface" : isToday ? "bg-primary/10 font-medium text-on-surface" : inMonth ? "text-on-surface hover:bg-primary/5" : "text-on-surface-variant hover:bg-primary/5"}`}>{date.getDate()}</button>;
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs">
          {clearable && <button type="button" onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }} className="rounded-md px-2 py-1.5 text-on-surface-variant hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">Xóa ngày</button>}
          <button type="button" onClick={() => choose(today)} className="rounded-md bg-primary/10 px-2 py-1.5 font-medium text-on-surface hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary">Hôm nay</button>
        </div>
      </div>,
      portalTarget?.() ?? document.body,
    )}
  </div>;
}
