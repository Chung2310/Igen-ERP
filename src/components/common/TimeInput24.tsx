import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";

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
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const current = /^\d{1,2}:\d{2}/.test(value) ? value.slice(0, 5) : "";
  const [selectedHour, selectedMinute] = current ? current.split(":") : ["", ""];

  // Giữ lại giá trị phút lệch (ví dụ: 09:07) bằng cách sắp xếp động vào danh sách
  const minutesOptions = current && !MINUTES_STEP5.includes(selectedMinute)
    ? [...MINUTES_STEP5, selectedMinute].sort()
    : MINUTES_STEP5;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={
          isFlat
            ? "w-full flex items-center justify-between text-left cursor-pointer bg-transparent border-0 outline-none focus:outline-none font-semibold font-sans py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
            : `w-full flex items-center justify-between text-left cursor-pointer bg-white border border-gray-200 hover:border-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl font-medium font-sans px-3.5 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed`
        }
      >
        <span>{current || "--:--"}</span>
        <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-3.5 flex flex-col w-[170px] select-none animate-fade-in animate-scale-in">
          <div className="grid grid-cols-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 font-sans">
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
                    className={`w-full py-1.5 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-650 hover:bg-slate-100/80 active:scale-95"
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
                    className={`w-full py-1.5 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-650 hover:bg-slate-100/80 active:scale-95"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
      className={`flex items-center gap-1.5 bg-white border border-gray-200 hover:border-gray-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-xl px-3.5 py-2 transition-all ${className}`}
    >
      <input
        type="date"
        required={required}
        disabled={disabled}
        value={datePart}
        onChange={(e) => emit(e.target.value, timePart)}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none focus:ring-0 p-0 cursor-pointer disabled:cursor-not-allowed text-xs font-semibold text-slate-800"
      />
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
