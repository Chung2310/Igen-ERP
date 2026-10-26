import React, { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { RetailReportFilters } from "../../types";
import { validateRetailReportRange } from "./retailReportRange";

type RetailReportFiltersProps = {
  filters: RetailReportFilters;
  currentRange?: { from: string; to: string };
  today: string;
  disabled?: boolean;
  onChange: (filters: RetailReportFilters) => void;
};

const buttonClass =
  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";

export default function RetailReportFilters({
  filters,
  currentRange,
  today,
  disabled,
  onChange,
}: RetailReportFiltersProps) {
  const isCustomFilter = "from" in filters && typeof filters.from === "string";
  const [showCustom, setShowCustom] = React.useState(isCustomFilter);
  const [from, setFrom] = React.useState(isCustomFilter ? filters.from : currentRange?.from || today);
  const [to, setTo] = React.useState(isCustomFilter ? filters.to : currentRange?.to || today);
  const [validationError, setValidationError] = React.useState("");
  const [showDimensions, setShowDimensions] = React.useState(
    Boolean(
      filters.salespersonId ||
      filters.productId ||
      filters.sku ||
      filters.category ||
      filters.brand
    )
  );
  const [dimensions, setDimensions] = React.useState({
    salespersonId: filters.salespersonId || "",
    productId: filters.productId || "",
    sku: filters.sku || "",
    category: filters.category || "",
    brand: filters.brand || "",
  });
  const validationErrorId = React.useId();

  React.useEffect(() => {
    if (!isCustomFilter) return;
    setShowCustom(true);
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters, isCustomFilter]);

  const choosePreset = (next: RetailReportFilters) => {
    setShowCustom(false);
    setValidationError("");
    onChange({
      ...next,
      ...Object.fromEntries(Object.entries(dimensions).filter(([, value]) => value.trim())),
    } as RetailReportFilters);
  };

  const openCustom = () => {
    if (!showCustom) {
      setFrom(isCustomFilter ? filters.from : currentRange?.from || today);
      setTo(isCustomFilter ? filters.to : currentRange?.to || today);
    }
    setValidationError("");
    setShowCustom(true);
  };

  const applyCustom = () => {
    const nextError = validateRetailReportRange(from, to);
    if (nextError) {
      setValidationError(nextError);
      return;
    }
    setValidationError("");
    onChange({
      from,
      to,
      ...Object.fromEntries(Object.entries(dimensions).filter(([, value]) => value.trim())),
    } as RetailReportFilters);
  };

  const applyDimensions = () => {
    const {
      salespersonId: _salespersonId,
      productId: _productId,
      sku: _sku,
      category: _category,
      brand: _brand,
      ...range
    } = filters;
    onChange({
      ...range,
      ...Object.fromEntries(
        Object.entries(dimensions)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value)
      ),
    } as RetailReportFilters);
  };

  const activeDimensionsCount = Object.values(dimensions).filter((v) => v.trim()).length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs transition hover:border-slate-300">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 block">Khoảng thời gian báo cáo</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" className="flex flex-wrap gap-1.5 rounded-2xl bg-slate-100 p-1 border border-slate-200/60" aria-label="Chọn khoảng báo cáo">
            <button
              type="button"
              aria-pressed={!showCustom && filters.preset === undefined}
              disabled={disabled}
              onClick={() => choosePreset({})}
              className={`${buttonClass} ${
                !showCustom && filters.preset === undefined
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              aria-pressed={!showCustom && filters.preset === "7d"}
              disabled={disabled}
              onClick={() => choosePreset({ preset: "7d" })}
              className={`${buttonClass} ${
                !showCustom && filters.preset === "7d"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              7 ngày
            </button>
            <button
              type="button"
              aria-pressed={!showCustom && filters.preset === "30d"}
              disabled={disabled}
              onClick={() => choosePreset({ preset: "30d" })}
              className={`${buttonClass} ${
                !showCustom && filters.preset === "30d"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              30 ngày
            </button>
            <button
              type="button"
              aria-pressed={showCustom}
              disabled={disabled}
              onClick={openCustom}
              className={`${buttonClass} ${
                showCustom
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              Tùy chọn
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDimensions((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              showDimensions || activeDimensionsCount > 0
                ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Lọc chi tiết</span>
            {activeDimensionsCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">
                {activeDimensionsCount}
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showDimensions ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Custom Date Range Panel */}
      {showCustom && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition-all">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="text-xs font-bold text-slate-700">
              <span className="block mb-1">Từ ngày</span>
              <input
                type="date"
                value={from}
                disabled={disabled}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? validationErrorId : undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100"
              />
            </label>
            <label className="text-xs font-bold text-slate-700">
              <span className="block mb-1">Đến ngày</span>
              <input
                type="date"
                value={to}
                disabled={disabled}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? validationErrorId : undefined}
                onChange={(event) => setTo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-slate-100"
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={applyCustom}
              className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:from-slate-800 hover:to-slate-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Áp dụng khoảng ngày
            </button>
          </div>
          {validationError && (
            <p
              id={validationErrorId}
              role="alert"
              className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600"
            >
              {validationError}
            </p>
          )}
        </div>
      )}

      {/* Dimension Filters Panel */}
      <div className={`mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all ${showDimensions ? "" : "hidden"}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">
              Lọc theo thứ nguyên (nhân viên, sản phẩm, ngành hàng)
            </span>
            {activeDimensionsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDimensions({
                    salespersonId: "",
                    productId: "",
                    sku: "",
                    category: "",
                    brand: "",
                  });
                }}
                className="text-[11px] font-semibold text-cyan-600 hover:underline cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(
              [
                ["salespersonId", "Nhân viên bán hàng", "Mã nhân viên..."],
                ["productId", "Mã sản phẩm", "Mã hệ thống..."],
                ["sku", "SKU", "VD: IP15-PRO-BLK"],
                ["category", "Danh mục", "VD: Điện thoại"],
                ["brand", "Thương hiệu", "VD: Apple, Samsung"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="text-xs font-bold text-slate-700">
                <span className="block mb-1">{label}</span>
                <input
                  aria-label={label}
                  placeholder={placeholder}
                  value={dimensions[key]}
                  disabled={disabled}
                  onChange={(event) =>
                    setDimensions((value) => ({ ...value, [key]: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </label>
            ))}
          </div>
          <div className="mt-3.5 flex justify-end">
            <button
              type="button"
              disabled={disabled}
              onClick={applyDimensions}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:from-cyan-500 hover:to-blue-500 cursor-pointer"
            >
              Áp dụng bộ lọc
            </button>
          </div>
        </div>
      </div>
  );
}
