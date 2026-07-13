import React from "react";

/**
 * Ô chọn giờ định dạng 24h (HH:mm), thay cho <input type="time"> native —
 * native hiển thị AM/PM hay 24h tùy ngôn ngữ hệ điều hành, không ép được 24 giờ.
 * `className` nhận các class vốn đặt trên input cũ (viền, padding, focus...).
 */

const pad2 = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

interface TimeInput24Props {
  /** "HH:mm" hoặc "" khi chưa chọn */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function TimeInput24({ value, onChange, className = "", required, disabled }: TimeInput24Props) {
  const [hour = "", minute = ""] = /^\d{1,2}:\d{2}/.test(value) ? value.split(":") : ["", ""];

  const emit = (h: string, m: string) => {
    if (h === "" && m === "") onChange("");
    else onChange(`${h || "00"}:${m || "00"}`);
  };

  const selectCls =
    "appearance-none bg-transparent outline-none cursor-pointer text-center disabled:cursor-not-allowed";

  return (
    <div className={`inline-flex items-center focus-within:ring-0 ${className}`}>
      <select
        aria-label="Giờ"
        required={required}
        disabled={disabled}
        value={hour}
        onChange={(e) => emit(e.target.value, minute)}
        className={selectCls}
      >
        <option value="" disabled hidden>
          --
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="px-0.5 select-none opacity-60">:</span>
      <select
        aria-label="Phút"
        required={required}
        disabled={disabled}
        value={minute}
        onChange={(e) => emit(hour, e.target.value)}
        className={selectCls}
      >
        <option value="" disabled hidden>
          --
        </option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
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
    <div className={`flex items-center gap-1.5 ${className}`}>
      <input
        type="date"
        required={required}
        disabled={disabled}
        value={datePart}
        onChange={(e) => emit(e.target.value, timePart)}
        className="flex-1 min-w-0 bg-transparent outline-none cursor-pointer disabled:cursor-not-allowed"
      />
      <TimeInput24 value={timePart} onChange={(t) => emit(datePart || new Date().toISOString().slice(0, 10), t)} disabled={disabled} />
    </div>
  );
}
