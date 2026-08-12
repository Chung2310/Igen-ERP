import React from "react";
import { CalendarDays } from "lucide-react";
import type { RetailReportFilters } from "../../types";
import { validateRetailReportRange } from "./retailReportRange";

type RetailReportFiltersProps = {
  filters: RetailReportFilters;
  currentRange?: { from: string; to: string };
  today: string;
  disabled?: boolean;
  onChange: (filters: RetailReportFilters) => void;
};

const buttonClass = "rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export default function RetailReportFilters({ filters, currentRange, today, disabled, onChange }: RetailReportFiltersProps) {
  const isCustomFilter = "from" in filters && typeof filters.from === "string";
  const [showCustom, setShowCustom] = React.useState(isCustomFilter);
  const [from, setFrom] = React.useState(isCustomFilter ? filters.from : currentRange?.from || today);
  const [to, setTo] = React.useState(isCustomFilter ? filters.to : currentRange?.to || today);
  const [validationError, setValidationError] = React.useState("");
  const [dimensions, setDimensions] = React.useState({ salespersonId: filters.salespersonId || "", productId: filters.productId || "", sku: filters.sku || "", category: filters.category || "", brand: filters.brand || "" });
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
    onChange({ ...next, ...Object.fromEntries(Object.entries(dimensions).filter(([, value]) => value.trim())) } as RetailReportFilters);
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
    onChange({ from, to, ...Object.fromEntries(Object.entries(dimensions).filter(([, value]) => value.trim())) } as RetailReportFilters);
  };

  const applyDimensions = () => {
    const { salespersonId: _salespersonId, productId: _productId, sku: _sku, category: _category, brand: _brand, ...range } = filters;
    onChange({ ...range, ...Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value)) } as RetailReportFilters);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <CalendarDays aria-hidden="true" className="h-4 w-4 text-cyan-600" />
          Khoảng báo cáo
        </div>
        <div role="group" className="flex flex-wrap gap-2" aria-label="Chọn khoảng báo cáo">
          <button
            type="button"
            aria-pressed={!showCustom && filters.preset === undefined}
            disabled={disabled}
            onClick={() => choosePreset({})}
            className={`${buttonClass} ${!showCustom && filters.preset === undefined ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-cyan-50"}`}
          >
            Hôm nay
          </button>
          <button
            type="button"
            aria-pressed={!showCustom && filters.preset === "7d"}
            disabled={disabled}
            onClick={() => choosePreset({ preset: "7d" })}
            className={`${buttonClass} ${!showCustom && filters.preset === "7d" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-cyan-50"}`}
          >
            7 ngày
          </button>
          <button
            type="button"
            aria-pressed={!showCustom && filters.preset === "30d"}
            disabled={disabled}
            onClick={() => choosePreset({ preset: "30d" })}
            className={`${buttonClass} ${!showCustom && filters.preset === "30d" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-cyan-50"}`}
          >
            30 ngày
          </button>
          <button
            type="button"
            aria-pressed={showCustom}
            disabled={disabled}
            onClick={openCustom}
            className={`${buttonClass} ${showCustom ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-cyan-50"}`}
          >
            Tùy chọn
          </button>
        </div>
      </div>

      {showCustom && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="text-sm font-semibold text-slate-700">
              <span>Từ ngày</span>
              <input
                type="date"
                value={from}
                disabled={disabled}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? validationErrorId : undefined}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              <span>Đến ngày</span>
              <input
                type="date"
                value={to}
                disabled={disabled}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? validationErrorId : undefined}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
              />
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={applyCustom}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Áp dụng khoảng ngày
            </button>
          </div>
          {validationError && <p id={validationErrorId} role="alert" className="mt-2 text-sm font-medium text-red-600">{validationError}</p>}
        </div>
      )}
      <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-5">
        {([['salespersonId', 'Nhân viên bán hàng'], ['productId', 'Mã sản phẩm'], ['sku', 'SKU'], ['category', 'Danh mục'], ['brand', 'Thương hiệu']] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold text-slate-700"><span>{label}</span><input aria-label={label} value={dimensions[key]} disabled={disabled} onChange={(event) => setDimensions((value) => ({ ...value, [key]: event.target.value }))} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>)}
      </div>
      <button type="button" disabled={disabled} onClick={applyDimensions} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Áp dụng bộ lọc</button>
    </div>
  );
}
