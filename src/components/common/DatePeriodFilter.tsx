import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import {
  emptyDatePeriodFilter,
  formatDateVi,
  formatMonthVi,
  getCurrentMonthString,
  getDaysAgoDateString,
  getLastMonthString,
  getMonthDateRange,
  getTodayDateString,
  type DatePeriodFilterValue,
} from "../../utils/datePeriodFilter";

type DatePeriodFilterProps = {
  label: string;
  value: DatePeriodFilterValue;
  onChange: (value: DatePeriodFilterValue) => void;
  className?: string;
  compact?: boolean;
};

const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

export function DatePeriodFilter({
  label,
  value,
  onChange,
  className = "",
  compact = false,
}: DatePeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"range" | "month">("range");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 340 });

  // Popover internal staging state
  const [draftFrom, setDraftFrom] = useState(value.from || "");
  const [draftTo, setDraftTo] = useState(value.to || "");
  const [selectedYear, setSelectedYear] = useState(() => {
    if (value.mode === "month" && value.month) {
      return Number(value.month.slice(0, 4));
    }
    return new Date().getFullYear();
  });

  const fromInputId = useId();
  const toInputId = useId();

  const today = getTodayDateString();
  const currentMonth = getCurrentMonthString();
  const lastMonth = getLastMonthString();

  // Identify active preset
  const isAll = value.mode === "all" || (!value.from && !value.to && !value.day && !value.month);
  const isToday = value.mode === "day" && value.day === today;
  const isThisMonth = value.mode === "month" && value.month === currentMonth;
  const isLastMonth = value.mode === "month" && value.month === lastMonth;
  const isCustom = !isAll && !isToday && !isThisMonth && !isLastMonth;

  // Staging synchronization when opening popover
  useEffect(() => {
    if (open) {
      setDraftFrom(value.from || (value.mode === "day" ? value.day : ""));
      setDraftTo(value.to || (value.mode === "day" ? value.day : ""));
      if (value.mode === "month" && value.month) {
        setSelectedYear(Number(value.month.slice(0, 4)));
        setActiveTab("month");
      } else {
        setActiveTab("range");
      }
    }
  }, [open, value]);

  // Position calculation for popover
  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(360, window.innerWidth - 24);
      const height = popoverRef.current?.getBoundingClientRect().height || 360;
      const placeAbove = window.innerHeight - rect.bottom < height + 12 && rect.top > height;
      const top = placeAbove ? rect.top - height - 8 : rect.bottom + 8;
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      setPosition({ top: Math.max(12, top), left, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, activeTab]);

  // Dismiss listeners
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Handler for presets
  const handleSelectAll = () => onChange(emptyDatePeriodFilter());
  const handleSelectToday = () => {
    onChange({ mode: "day", day: today, month: "", from: today, to: today });
  };
  const handleSelectThisMonth = () => {
    onChange({ mode: "month", month: currentMonth, day: "", from: "", to: "" });
  };
  const handleSelectLastMonth = () => {
    onChange({ mode: "month", month: lastMonth, day: "", from: "", to: "" });
  };

  const handleApplyRange = (from: string, to: string) => {
    if (!from && !to) {
      onChange(emptyDatePeriodFilter());
    } else {
      onChange({
        mode: "range",
        from: from || "",
        to: to || "",
        day: "",
        month: "",
      });
    }
    setOpen(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const monthStr = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    if (getMonthDateRange(monthStr)) {
      onChange({
        mode: "month",
        month: monthStr,
        day: "",
        from: "",
        to: "",
      });
      setOpen(false);
    }
  };

  // Human-friendly label for custom button
  const getCustomLabel = () => {
    if (value.mode === "range" && (value.from || value.to)) {
      if (value.from && value.to) {
        if (value.from === value.to) return formatDateVi(value.from);
        return `${formatDateVi(value.from)} - ${formatDateVi(value.to)}`;
      }
      if (value.from) return `Từ ${formatDateVi(value.from)}`;
      return `Đến ${formatDateVi(value.to)}`;
    }
    if (value.mode === "month" && isCustom) {
      return formatMonthVi(value.month);
    }
    if (value.mode === "day" && isCustom) {
      return `Ngày ${formatDateVi(value.day)}`;
    }
    return "Tùy chọn...";
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${className}`}
      aria-label={`Bộ lọc ${label}`}
    >
      {/* ── Segmented Presets (Tất cả, Hôm nay, Tháng này, Tháng trước) ── */}
      <div className="inline-flex items-center rounded-xl border border-outline-variant bg-surface-container-low p-0.5 shadow-2xs">
        <button
          type="button"
          onClick={handleSelectAll}
          className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
            isAll
              ? "bg-surface-container-lowest text-primary font-semibold shadow-2xs"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50"
          }`}
          aria-pressed={isAll}
        >
          Tất cả
        </button>

        <button
          type="button"
          onClick={handleSelectToday}
          className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
            isToday
              ? "bg-surface-container-lowest text-primary font-semibold shadow-2xs"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50"
          }`}
          aria-pressed={isToday}
        >
          Hôm nay
        </button>

        <button
          type="button"
          onClick={handleSelectThisMonth}
          className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
            isThisMonth
              ? "bg-surface-container-lowest text-primary font-semibold shadow-2xs"
              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50"
          }`}
          aria-pressed={isThisMonth}
        >
          Tháng này
        </button>

        {!compact && (
          <button
            type="button"
            onClick={handleSelectLastMonth}
            className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
              isLastMonth
                ? "bg-surface-container-lowest text-primary font-semibold shadow-2xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50"
            }`}
            aria-pressed={isLastMonth}
          >
            Tháng trước
          </button>
        )}
      </div>

      {/* ── Custom Range / Month Popover Trigger ── */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Tùy chọn thời gian ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={`inline-flex min-h-8.5 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            isCustom
              ? "border-primary/40 bg-primary/10 text-primary font-semibold shadow-2xs"
              : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-outline hover:text-on-surface"
          }`}
        >
          <Calendar aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{getCustomLabel()}</span>
          {isCustom ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Xóa tùy chọn khoảng ngày"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectAll();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  handleSelectAll();
                }
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 text-primary"
            >
              <X aria-hidden="true" className="size-3 shrink-0" />
            </span>
          ) : (
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 text-on-surface-variant/70 transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {/* ── Popover Dialog ── */}
        {open &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={`Chọn khoảng thời gian cho ${label}`}
              style={{
                position: "fixed",
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
              }}
              className="z-50 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3.5 shadow-xl text-on-surface animate-in fade-in zoom-in-95 duration-100"
            >
              {/* Popover Sub-tabs */}
              <div className="flex items-center gap-1 border-b border-outline-variant pb-2.5 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("range")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "range"
                      ? "bg-primary text-on-primary font-semibold shadow-2xs"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  Khoảng ngày
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("month")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "month"
                      ? "bg-primary text-on-primary font-semibold shadow-2xs"
                      : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  Chọn theo tháng
                </button>
              </div>

              {activeTab === "range" ? (
                <div className="space-y-3">
                  {/* Quick shortcuts for range */}
                  <div className="flex flex-wrap items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const from7 = getDaysAgoDateString(7);
                        setDraftFrom(from7);
                        setDraftTo(today);
                      }}
                      className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                      7 ngày qua
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const from30 = getDaysAgoDateString(30);
                        setDraftFrom(from30);
                        setDraftTo(today);
                      }}
                      className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                      30 ngày qua
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const firstOfMonth = `${currentMonth}-01`;
                        setDraftFrom(firstOfMonth);
                        setDraftTo(today);
                      }}
                      className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                      Đầu tháng đến nay
                    </button>
                  </div>

                  {/* Date inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor={fromInputId}
                        className="mb-1 block text-[11px] font-medium text-on-surface-variant"
                      >
                        Từ ngày
                      </label>
                      <input
                        id={fromInputId}
                        type="date"
                        value={draftFrom}
                        max={draftTo || undefined}
                        onChange={(e) => setDraftFrom(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={toInputId}
                        className="mb-1 block text-[11px] font-medium text-on-surface-variant"
                      >
                        Đến ngày
                      </label>
                      <input
                        id={toInputId}
                        type="date"
                        value={draftTo}
                        min={draftFrom || undefined}
                        onChange={(e) => setDraftTo(e.target.value)}
                        className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftFrom("");
                        setDraftTo("");
                        handleSelectAll();
                        setOpen(false);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-error transition-colors"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Xóa lọc
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyRange(draftFrom, draftTo)}
                      className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:bg-primary/90 transition-colors shadow-2xs"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              ) : (
                /* Month picker grid */
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-on-surface">
                      Năm {selectedYear}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Năm trước"
                        onClick={() => setSelectedYear((prev) => prev - 1)}
                        className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                      >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label="Năm sau"
                        onClick={() => setSelectedYear((prev) => prev + 1)}
                        className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low transition-colors"
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {MONTH_NAMES.map((name, index) => {
                      const monthVal = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
                      const isSelected = value.mode === "month" && value.month === monthVal;
                      const isThis = monthVal === currentMonth;

                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => handleSelectMonth(index)}
                          className={`rounded-xl py-2 text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-primary text-on-primary font-semibold shadow-2xs"
                              : isThis
                                ? "border border-primary/40 bg-primary/10 text-primary font-semibold"
                                : "border border-outline-variant/60 bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectAll();
                        setOpen(false);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-error transition-colors"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      Xóa lọc
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="text-xs text-on-surface-variant hover:text-on-surface"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
