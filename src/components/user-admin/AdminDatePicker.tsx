import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  inline?: boolean;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  hideLabel?: boolean;
};

const toLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

const toValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dateLabel = (date: Date) => new Intl.DateTimeFormat("vi-VN").format(date);
const monthLabel = (date: Date) => new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(date);

export function AdminDatePicker({ label, value, onChange, min, max, inline = false, disabled = false, required = false, clearable = true, hideLabel = false }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousMonthRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [month, setMonth] = useState(() => {
    const initial = toLocalDate(value) || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [yearText, setYearText] = useState(() => String((toLocalDate(value) || new Date()).getFullYear()));
  const [position, setPosition] = useState({ top: 0, left: 0, width: 312 });

  useEffect(() => {
    setYearText(String(month.getFullYear()));
  }, [month]);

  useEffect(() => {
    if (value) setInvalid(false);
  }, [value]);

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
    previousMonthRef.current?.focus();
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
    setInvalid(false);
    onChange(toValue(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(false);
    triggerRef.current?.focus();
  };
  const showInvalid = invalid && required && !value && !disabled;
  const allowed = (date: Date) => {
    const next = toValue(date);
    return (!min || next >= min) && (!max || next <= max);
  };

  return (
    <div className={cn("min-w-0", inline && "flex items-center gap-2")}>
      {!hideLabel && <span className={cn("mb-1 block text-xs font-medium text-on-surface-variant", inline && "mb-0 shrink-0 text-sm font-normal")}>{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-invalid={showInvalid || undefined}
        disabled={disabled}
        onClick={() => {
          const next = selected || new Date();
          setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
          setYearText(String(next.getFullYear()));
          setOpen((current) => !current);
        }}
        className={cn("flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-left text-sm font-normal tabular-nums text-on-surface hover:border-primary focus-visible:border-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50", showInvalid && "border-error focus-visible:border-error", inline && "w-36")}
      >
        <span className={selected ? "" : "text-on-surface-variant"}>{selected ? dateLabel(selected) : "Chọn ngày"}</span>
        <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </button>
      {required && (
        <input
          type="date"
          className="sr-only"
          tabIndex={-1}
          required
          disabled={disabled}
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            setInvalid(false);
            onChange(event.target.value);
          }}
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            triggerRef.current?.scrollIntoView?.({ block: "nearest" });
            triggerRef.current?.focus();
          }}
        />
      )}
      {showInvalid && (
        <span role="alert" className="mt-1 block text-xs text-error">
          Vui lòng chọn {label.toLocaleLowerCase("vi")}.
        </span>
      )}
      {open && !disabled && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Chọn ${label.toLowerCase()}`}
          className="fixed z-50 max-h-[calc(100vh-24px)] overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-on-surface shadow-sm"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="sr-only">{monthLabel(month)}</span>
            <span aria-hidden="true" className="text-sm font-medium capitalize">{new Intl.DateTimeFormat("vi-VN", { month: "long" }).format(month)}</span>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label={/sinh/i.test(label) ? "Nhập năm sinh" : "Nhập năm"}
                placeholder="Năm"
                value={yearText}
                maxLength={4}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, "").slice(0, 4);
                  setYearText(next);
                  if (next.length === 4 && Number(next) >= 1000) {
                    setMonth(new Date(Number(next), month.getMonth(), 1));
                  }
                }}
                onBlur={() => setYearText(String(month.getFullYear()))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (yearText.length === 4 && Number(yearText) >= 1000) {
                      setMonth(new Date(Number(yearText), month.getMonth(), 1));
                    } else {
                      setYearText(String(month.getFullYear()));
                    }
                  }
                }}
                className="h-8 w-16 rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 text-center text-sm font-medium tabular-nums text-on-surface focus:border-primary focus:outline-none"
              />
              <button ref={previousMonthRef} type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-md p-2 text-on-surface-variant hover:bg-surface hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft className="size-4" aria-hidden="true" /></button>
              <button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-md p-2 text-on-surface-variant hover:bg-surface hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight className="size-4" aria-hidden="true" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-on-surface-variant">
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
                className={`h-9 rounded-md text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30 ${isSelected ? "bg-primary font-medium text-on-primary" : isCurrentMonth ? "text-on-surface hover:bg-surface" : "text-on-surface-variant hover:bg-surface"} ${dateValue === toValue(today) && !isSelected ? "bg-primary/10 text-on-surface" : ""}`}
              >{date.getDate()}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 pt-2 text-xs">
            {clearable && !required && <button type="button" onClick={() => { onChange(""); setOpen(false); triggerRef.current?.focus(); }} className="rounded-md px-2.5 py-1.5 text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">Xóa ngày</button>}
            <button type="button" disabled={!allowed(today)} onClick={() => choose(today)} className="rounded-md bg-primary/10 px-2.5 py-1.5 font-medium text-on-surface hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">Hôm nay</button>
          </div>
        </div>,
        triggerRef.current?.closest("dialog") || document.body,
      )}
    </div>
  );
}
