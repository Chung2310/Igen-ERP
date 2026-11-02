import React from "react";
import { Search, X } from "lucide-react";
import { DatePeriodFilter } from "./DatePeriodFilter";
import type { DatePeriodFilterValue } from "../../utils/datePeriodFilter";

export type TableFilterToolbarProps = {
  search?: {
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
    className?: string;
  };
  dateFilter?: {
    label: string;
    value: DatePeriodFilterValue;
    onChange: (value: DatePeriodFilterValue) => void;
    compact?: boolean;
  };
  children?: React.ReactNode;
  actions?: React.ReactNode;
  totalCount?: number;
  countLabel?: string;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  resetLabel?: string;
  className?: string;
};

export function TableFilterToolbar({
  search,
  dateFilter,
  children,
  actions,
  totalCount,
  countLabel = "kết quả",
  hasActiveFilters = false,
  onResetFilters,
  resetLabel = "Xóa bộ lọc",
  className = "",
}: TableFilterToolbarProps) {
  return (
    <div
      className={`rounded-2xl border border-outline-variant bg-surface-container-lowest p-3.5 sm:p-4 shadow-2xs space-y-3 ${className}`}
    >
      {/* ── Hàng 1: Tìm kiếm + Bộ lọc mở rộng + Đếm kết quả & Nút xóa lọc ── */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Ô tìm kiếm */}
          {search && (
            <div className={`relative min-w-[220px] flex-1 max-w-md ${search.className || ""}`}>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant/60"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label={search.ariaLabel || "Tìm kiếm"}
                placeholder={search.placeholder || "Tìm kiếm..."}
                value={search.value}
                disabled={search.disabled}
                onChange={(e) => search.onChange(e.target.value)}
                onKeyDown={search.onKeyDown}
                className="h-9.5 w-full rounded-xl border border-outline-variant bg-surface-container-low/60 pl-9 pr-8 text-xs text-on-surface placeholder:text-on-surface-variant/60 outline-none transition focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              {search.value && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => search.onChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Các bộ lọc phụ (Dropdowns, Selects, Buttons) */}
          {children}
        </div>

        {/* Số đếm & Hành động xóa lọc / Nút thao tác */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-on-surface-variant">
          {actions}

          {totalCount !== undefined && (
            <span className="inline-flex items-center rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface-variant">
              Tổng{" "}
              <strong className="ml-1 text-on-surface tabular-nums">
                {totalCount.toLocaleString("vi-VN")}
              </strong>
              &nbsp;{countLabel}
            </span>
          )}

          {hasActiveFilters && onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-error hover:bg-error-container/40 transition-colors"
            >
              <X className="size-3" aria-hidden="true" />
              {resetLabel}
            </button>
          )}
        </div>
      </div>

      {/* ── Hàng 2: Bộ lọc thời gian (nếu có) ── */}
      {dateFilter && (
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-outline-variant/60">
          <span className="text-xs font-medium text-on-surface-variant shrink-0">
            Thời gian:
          </span>
          <DatePeriodFilter
            label={dateFilter.label}
            value={dateFilter.value}
            onChange={dateFilter.onChange}
            compact={dateFilter.compact}
          />
        </div>
      )}
    </div>
  );
}

