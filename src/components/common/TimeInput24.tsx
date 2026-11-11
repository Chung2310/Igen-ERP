import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

/**
 * Dropdown chọn giờ định dạng 24h (HH:mm) với giao diện cuộn Giờ & Phút riêng biệt
 * mô phỏng theo thiết kế hiện đại.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES_STEP5 = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

interface TimeInput24Props {
  /** "HH:mm" hoặc "" khi chưa chọn */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  variant?: "default" | "flat" | "compact";
  ariaLabel?: string;
}

export function TimeInput24({
  value,
  onChange,
  className = "",
  required,
  disabled,
  variant = "default",
  ariaLabel,
}: TimeInput24Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const current = /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : "";
  const [selectedHour, selectedMinute] = current ? current.split(":") : ["", ""];

  // Giữ lại giá trị phút lệch (ví dụ: 09:07) bằng cách sắp xếp động vào danh sách
  const minutesOptions = current && !MINUTES_STEP5.includes(selectedMinute)
    ? [...MINUTES_STEP5, selectedMinute].sort()
    : MINUTES_STEP5;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const height = menuRef.current?.getBoundingClientRect().height || 250;
      const placeAbove = window.innerHeight - bounds.bottom < height + 12 && bounds.top > height;
      setMenuPosition({
        top: Math.max(12, Math.min(placeAbove ? bounds.top - height - 6 : bounds.bottom + 6, window.innerHeight - height - 12)),
        left: Math.max(12, Math.min(bounds.right - 170, window.innerWidth - 182)),
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  // Tự động cuộn các phần tử được chọn vào giữa danh sách khi mở dropdown
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const activeHour = hourRef.current?.querySelector("[data-active='true']");
        const activeMin = minuteRef.current?.querySelector("[data-active='true']");
        if (activeHour) {
          activeHour.scrollIntoView?.({ block: "center", behavior: "auto" });
        }
        if (activeMin) {
          activeMin.scrollIntoView?.({ block: "center", behavior: "auto" });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleHourSelect = (h: string) => {
    const nextMin = selectedMinute || "00";
    onChange(`${h}:${nextMin}`);
  };

  const handleMinuteSelect = (m: string) => {
    const nextHour = selectedHour || "09";
    onChange(`${nextHour}:${m}`);
    setIsOpen(false); // Đóng ngay sau khi chọn phút
  };

  const isFlat = variant === "flat";
  const isCompact = variant === "compact";

  return (
    <div ref={containerRef} className={cn("relative inline-block text-xs text-on-surface", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        disabled={disabled}
        aria-required={required}
        onClick={() => setIsOpen(!isOpen)}
        className={
          isFlat
            ? "w-full flex items-center justify-between text-left cursor-pointer bg-transparent border-0 outline-none focus:outline-none font-normal font-sans py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
            : isCompact
              ? "flex h-9 w-full items-center justify-between rounded-xl border border-[#DCE7F4] bg-white px-2.5 text-left font-normal text-sm transition-colors hover:border-[#B8DFF3] focus:border-[#70D5FF] focus:outline-none focus:ring-2 focus:ring-[#00ADFC]/15 disabled:cursor-not-allowed disabled:opacity-50"
              : "w-full flex items-center justify-between text-left cursor-pointer bg-white border border-slate-200 hover:border-sky-200 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 rounded-xl font-normal font-sans px-3.5 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        <span>{current || "--:--"}</span>
        <Clock className="ml-1.5 size-3.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} role="dialog" aria-label={ariaLabel ? `Chọn ${ariaLabel.toLowerCase()}` : "Chọn giờ"} className="fixed z-[200] flex w-[170px] select-none flex-col rounded-md border border-outline-variant bg-surface-container-lowest p-3.5 text-on-surface shadow-sm" style={menuPosition}>
          <div className="mb-2 grid grid-cols-2 text-center font-sans text-xs font-normal text-on-surface-variant">
            <div>Giờ</div>
            <div>Phút</div>
          </div>
          <div className="-mx-3.5 mb-2.5 h-px bg-outline-variant" />
          <div className="flex h-[180px] items-stretch">
            {/* Danh sách giờ */}
            <div
              ref={hourRef}
              className="flex-1 overflow-y-auto pr-1 space-y-0.5 scrolling-touch scrollbar-thin"
              style={{ scrollbarWidth: "thin" }}
            >
              {HOURS.map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Giờ ${h}`}
                    data-active={isSelected}
                    onClick={() => handleHourSelect(h)}
                    className={`w-full cursor-pointer rounded-lg py-1.5 text-center text-xs font-normal transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-on-surface hover:bg-primary/5"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            {/* Vạch ngăn giữa */}
            <div className="mx-1.5 w-px self-stretch bg-outline-variant" />

            {/* Danh sách phút */}
            <div
              ref={minuteRef}
              className="flex-1 overflow-y-auto pl-1 space-y-0.5 scrolling-touch scrollbar-thin"
              style={{ scrollbarWidth: "thin" }}
            >
              {minutesOptions.map((m) => {
                const isSelected = selectedMinute === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-label={`Phút ${m}`}
                    data-active={isSelected}
                    onClick={() => handleMinuteSelect(m)}
                    className={`w-full cursor-pointer rounded-lg py-1.5 text-center text-xs font-normal transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-on-surface hover:bg-primary/5"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>, triggerRef.current?.closest("dialog") || document.body,
      )}
    </div>
  );
}

interface DateTimeInput24Props {
  /** "YYYY-MM-DDTHH:mm" hoặc "" khi chưa chọn */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

interface DateInput24Props extends Omit<DateTimeInput24Props, "className"> {
  className?: string;
  ariaLabel?: string;
  showYearSelect?: boolean;
}

/** Branded date-only field with the same calendar popover used by DateTimeInput24. */
export function DateInput24({ value, onChange, className = "", required, disabled, ariaLabel = "Chọn ngày", showYearSelect = false }: DateInput24Props) {
  return (
    <div className={`flex min-h-10 w-full items-center rounded-xl border border-[#DCE7F4] bg-white px-2.5 transition-colors hover:border-[#B8DFF3] focus-within:border-[#70D5FF] focus-within:ring-2 focus-within:ring-[#00ADFC]/15 ${className}`}>
      <BrandedDateInput value={value} onChange={onChange} required={required} disabled={disabled} ariaLabel={ariaLabel} showYearSelect={showYearSelect} />
    </div>
  );
}

/** Ngày + giờ 24h, thay cho <input type="datetime-local"> native. */
export function DateTimeInput24({ value, onChange, className = "", required, disabled, ariaLabel = "Chọn ngày giờ" }: DateTimeInput24Props) {
  const [datePart = "", rawTime = ""] = value ? value.split("T") : ["", ""];
  const timePart = rawTime.slice(0, 5);

  const emit = (d: string, t: string) => {
    if (!d) onChange("");
    else onChange(`${d}T${t || "00:00"}`);
  };

  return (
    <div
      className={cn("flex min-h-10 items-center gap-1.5 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 text-sm text-on-surface transition-colors focus-within:border-primary", className)}
    >
        <BrandedDateInput value={datePart} onChange={(date) => emit(date, timePart)} required={required} disabled={disabled} ariaLabel={`${ariaLabel} - ngày`} className="pr-1.5" />
      <div className="my-0.5 w-px shrink-0 self-stretch bg-outline-variant" />
      <TimeInput24
        value={timePart}
        onChange={(t) => emit(datePart || toDateValue(new Date()), t)}
        disabled={disabled}
        variant="flat"
        ariaLabel={`${ariaLabel} - giờ`}
        className="w-24 shrink-0 text-sm"
      />
    </div>
  );
}

const toDateValue = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseDateValue = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

function BrandedDateInput({ value, onChange, required, disabled, ariaLabel, showYearSelect = false, className = "" }: Pick<DateTimeInput24Props, "value" | "onChange" | "required" | "disabled"> & { ariaLabel: string; showYearSelect?: boolean; className?: string }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const date = parseDateValue(value) || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [position, setPosition] = useState({ top: 0, left: 0, width: 288 });

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const width = Math.min(288, window.innerWidth - 24);
      const height = popoverRef.current?.getBoundingClientRect().height || 350;
      const placeAbove = window.innerHeight - bounds.bottom < height + 12 && bounds.top > height;
      setPosition({
        top: Math.max(12, Math.min(placeAbove ? bounds.top - height - 6 : bounds.bottom + 6, window.innerHeight - height - 12)),
        left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)),
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
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

  const selected = parseDateValue(value);
  const currentYear = new Date().getFullYear();
  const firstYear = Math.min(1900, month.getFullYear());
  const lastYear = Math.max(currentYear, month.getFullYear());
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1));
  const chooseDate = (date: Date) => {
    onChange(toDateValue(date));
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className={cn("min-w-0 flex-1", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required}
        onClick={() => {
          const date = selected || new Date();
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setOpen((current) => !current);
        }}
        className="flex w-full min-w-0 items-center justify-between gap-1 rounded-md px-1 py-1 text-left text-sm font-normal text-on-surface outline-none hover:bg-primary/5 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? "truncate" : "truncate text-on-surface-variant"}>{selected ? new Intl.DateTimeFormat("vi-VN").format(selected) : "Chọn ngày"}</span>
        <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={popoverRef} role="dialog" aria-label="Lịch chọn ngày" className="fixed z-[200] max-h-[calc(100vh-24px)] overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-on-surface shadow-sm" style={position}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium capitalize">{new Intl.DateTimeFormat("vi-VN", showYearSelect ? { month: "long" } : { month: "long", year: "numeric" }).format(month)}</span>
            <div className="flex items-center gap-0.5">
              {showYearSelect && (
                <select
                  aria-label="Chọn năm sinh"
                  value={month.getFullYear()}
                  onChange={(event) => setMonth(new Date(Number(event.target.value), month.getMonth(), 1))}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-1 py-1 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index).map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              )}
              <button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft className="size-4" /></button>
              <button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight className="size-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-on-surface-variant">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const dateValue = toDateValue(date);
              const isSelected = dateValue === value;
              return <button key={dateValue} type="button" aria-label={`Chọn ngày ${new Intl.DateTimeFormat("vi-VN").format(date)}`} aria-pressed={isSelected} onClick={() => chooseDate(date)} className={cn("h-8 rounded-lg text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary", isSelected ? "bg-primary/10 text-primary" : date.getMonth() === month.getMonth() ? "text-on-surface hover:bg-primary/5" : "text-on-surface-variant hover:bg-primary/5", dateValue === toDateValue(new Date()) && !isSelected && "ring-1 ring-primary")}>{date.getDate()}</button>;
            })}
          </div>
          <div className={cn("mt-2 flex items-center border-t border-outline-variant pt-2 text-xs", required ? "justify-end" : "justify-between")}>
            {!required && <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-md px-2 py-1 text-on-surface-variant hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">Xóa ngày</button>}
            <button type="button" onClick={() => chooseDate(new Date())} className="rounded-md bg-primary/10 px-2 py-1 text-primary hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary">Hôm nay</button>
          </div>
        </div>, triggerRef.current?.closest("dialog") || document.body,
      )}
    </div>
  );
}
