import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";

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
  variant?: "default" | "flat";
}

export function TimeInput24({
  value,
  onChange,
  className = "",
  required,
  disabled,
  variant = "default",
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
          activeHour.scrollIntoView({ block: "center", behavior: "auto" });
        }
        if (activeMin) {
          activeMin.scrollIntoView({ block: "center", behavior: "auto" });
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

  return (
    <div ref={containerRef} className={`relative inline-block text-xs text-slate-800 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-required={required}
        onClick={() => setIsOpen(!isOpen)}
        className={
          isFlat
            ? "w-full flex items-center justify-between text-left cursor-pointer bg-transparent border-0 outline-none focus:outline-none font-normal font-sans py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
            : `w-full flex items-center justify-between text-left cursor-pointer bg-white border border-slate-200 hover:border-sky-200 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15 rounded-xl font-normal font-sans px-3.5 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed`
        }
      >
        <span>{current || "--:--"}</span>
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
      </button>

      {isOpen && createPortal(
        <div ref={menuRef} className="fixed z-[200] bg-white border border-[#DCE7F4] rounded-2xl shadow-xl p-3.5 flex flex-col w-[170px] select-none animate-fade-in animate-scale-in" style={menuPosition}>
          <div className="grid grid-cols-2 text-center text-xs font-normal text-slate-500 mb-2 font-sans">
            <div>Giờ</div>
            <div>Phút</div>
          </div>
          <div className="h-px bg-gray-100 -mx-3.5 mb-2.5" />
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
                    data-active={isSelected}
                    onClick={() => handleHourSelect(h)}
                    className={`w-full py-1.5 text-center text-xs font-normal rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "text-slate-700 hover:bg-sky-50"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            {/* Vạch ngăn giữa */}
            <div className="w-px bg-gray-100 mx-1.5 self-stretch" />

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
                    data-active={isSelected}
                    onClick={() => handleMinuteSelect(m)}
                    className={`w-full py-1.5 text-center text-xs font-normal rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "text-slate-700 hover:bg-sky-50"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>, document.body,
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
}

/** Ngày + giờ 24h, thay cho <input type="datetime-local"> native. */
export function DateTimeInput24({ value, onChange, className = "", required, disabled }: DateTimeInput24Props) {
  const [datePart = "", rawTime = ""] = value ? value.split("T") : ["", ""];
  const timePart = rawTime.slice(0, 5);

  const emit = (d: string, t: string) => {
    if (!d) onChange("");
    else onChange(`${d}T${t || "00:00"}`);
  };

  return (
    <div
      className={`flex items-center gap-1.5 bg-white border border-slate-200 hover:border-sky-200 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/15 rounded-xl px-3.5 py-2 transition-all ${className}`}
    >
      <BrandedDateInput value={datePart} onChange={(date) => emit(date, timePart)} required={required} disabled={disabled} />
      <div className="w-px bg-gray-200 self-stretch my-0.5 shrink-0" />
      <TimeInput24
        value={timePart}
        onChange={(t) => emit(datePart || new Date().toISOString().slice(0, 10), t)}
        disabled={disabled}
        variant="flat"
        className="shrink-0 w-24"
      />
    </div>
  );
}

const toDateValue = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const parseDateValue = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

function BrandedDateInput({ value, onChange, required, disabled }: Pick<DateTimeInput24Props, "value" | "onChange" | "required" | "disabled">) {
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
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selected = parseDateValue(value);
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1));
  const chooseDate = (date: Date) => {
    onChange(toDateValue(date));
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="min-w-0 flex-1">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label="Chọn ngày"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required}
        onClick={() => {
          const date = selected || new Date();
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setOpen((current) => !current);
        }}
        className="flex w-full min-w-0 items-center justify-between gap-1 rounded-lg px-1 py-1 text-left text-xs font-normal text-slate-800 outline-none hover:bg-[#F5FAFE] focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? "truncate" : "truncate text-slate-400"}>{selected ? new Intl.DateTimeFormat("vi-VN").format(selected) : "Chọn ngày"}</span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#007EB8]" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={popoverRef} role="dialog" aria-label="Lịch chọn ngày" className="fixed z-[200] max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-[#DCE7F4] bg-white p-3 text-slate-800 shadow-[0_18px_50px_rgba(13,48,78,0.18)]" style={position}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium capitalize">{new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(month)}</span>
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#E8F7FF]"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-1.5 text-slate-500 hover:bg-[#E8F7FF]"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((date) => {
              const dateValue = toDateValue(date);
              const isSelected = dateValue === value;
              return <button key={dateValue} type="button" aria-label={`Chọn ngày ${new Intl.DateTimeFormat("vi-VN").format(date)}`} aria-pressed={isSelected} onClick={() => chooseDate(date)} className={`h-8 rounded-lg text-xs transition-colors ${isSelected ? "bg-[#00ADFC] text-white" : date.getMonth() === month.getMonth() ? "text-slate-700 hover:bg-[#E8F7FF]" : "text-slate-400 hover:bg-[#F5FAFE]"} ${dateValue === toDateValue(new Date()) && !isSelected ? "ring-1 ring-[#00ADFC]/50" : ""}`}>{date.getDate()}</button>;
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#E8F0F8] pt-2 text-xs">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-[#F5FAFE]">Xóa ngày</button>
            <button type="button" onClick={() => chooseDate(new Date())} className="rounded-lg bg-[#E8F7FF] px-2 py-1 text-[#007EB8] hover:bg-[#D7F1FF]">Hôm nay</button>
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
