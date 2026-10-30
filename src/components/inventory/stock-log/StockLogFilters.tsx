import React from "react";
import {
  Calendar,
  Download,
  Plus,
  Search,
  ShoppingCart,
  Upload,
  X,
} from "lucide-react";
import { Dropdown, DropdownOption } from "../../common/Dropdown";
import {
  DatePreset,
  getPresetDateRange,
  StockLogStatsData,
} from "./stockLogUtils";

interface StockLogFiltersProps {
  searchLog: string;
  setSearchLog: (val: string) => void;
  typeFilter: "all" | "inbound" | "outbound" | "pos";
  setTypeFilter: (val: "all" | "inbound" | "outbound" | "pos") => void;
  statusFilter: "all" | "pending" | "processing" | "completed";
  setStatusFilter: (val: "all" | "pending" | "processing" | "completed") => void;
  datePreset: DatePreset;
  setDatePreset: (val: DatePreset) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  stats: StockLogStatsData;
  outboundOnly?: boolean;
  readOnly?: boolean;
  hideExcelActions?: boolean;
  isImporting?: boolean;
  onImportExcel: () => void;
  onExportExcel: () => void;
  onOpenCreateModal: () => void;
}

export function StockLogFilters({
  searchLog,
  setSearchLog,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  datePreset,
  setDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  stats,
  outboundOnly = false,
  readOnly = false,
  hideExcelActions = false,
  isImporting = false,
  onImportExcel,
  onExportExcel,
  onOpenCreateModal,
}: StockLogFiltersProps) {
  const statusOptions: DropdownOption<"all" | "pending" | "processing" | "completed">[] = [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "pending", label: "Đang chờ" },
    { value: "processing", label: "Đang xử lý" },
    { value: "completed", label: "Hoàn thành" },
  ];

  const datePresetOptions: DropdownOption<DatePreset>[] = [
    { value: "all", label: "Tất cả thời gian" },
    { value: "today", label: "Hôm nay" },
    { value: "yesterday", label: "Hôm qua" },
    { value: "7days", label: "7 ngày gần nhất" },
    { value: "30days", label: "30 ngày gần nhất" },
    { value: "this_month", label: "Tháng này" },
  ];

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else {
      const range = getPresetDateRange(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  const handleClearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setDatePreset("all");
  };

  return (
    <div
      className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs"
      id="log_filters_bar"
    >
      {/* ── Hàng 1: Tabs phân loại giao dịch (trái) & Nút thao tác (phải) ── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Phân loại Loại giao dịch */}
        {!outboundOnly ? (
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                typeFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Tất cả</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  typeFilter === "all"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {stats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("inbound")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                typeFilter === "inbound"
                  ? "bg-white text-emerald-700 shadow-2xs"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Nhập kho</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  typeFilter === "inbound"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {stats.inboundCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("outbound")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                typeFilter === "outbound"
                  ? "bg-white text-rose-700 shadow-2xs"
                  : "text-slate-600 hover:text-rose-700"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Xuất kho</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  typeFilter === "outbound"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {stats.outboundCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTypeFilter("pos")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                typeFilter === "pos"
                  ? "bg-white text-sky-700 shadow-2xs"
                  : "text-slate-600 hover:text-sky-700"
              }`}
            >
              <ShoppingCart className="h-3 w-3 text-sky-600" />
              <span>Bán POS</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  typeFilter === "pos"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {stats.posSalesCount}
              </span>
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Lịch sử xuất kho
          </div>
        )}

        {/* Action buttons (Nhập Excel / Xuất Excel / Tạo phiếu) */}
        <div className="flex shrink-0 items-center gap-2">
          {!readOnly && !hideExcelActions && (
            <button
              type="button"
              onClick={onImportExcel}
              disabled={isImporting}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              {isImporting ? "Đang nhập..." : "Nhập Excel"}
            </button>
          )}

          {!hideExcelActions && onExportExcel && (
            <button
              type="button"
              onClick={onExportExcel}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 text-xs font-semibold text-emerald-700 shadow-2xs transition-colors hover:bg-emerald-100 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Xuất Excel
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-teal-700 px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-teal-800 active:scale-98 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {outboundOnly ? "Tạo phiếu xuất" : "Tạo phiếu"}
          </button>
        </div>
      </div>

      {/* ── Hàng 2: Tìm kiếm + Lọc trạng thái + Lọc khoảng thời gian (Từ ngày -> Đến ngày) ── */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        {/* Ô tìm kiếm */}
        <div className="relative min-w-[220px] flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm mã phiếu, sản phẩm, SKU, IMEI, người tạo..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs text-slate-800 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100"
            value={searchLog}
            onChange={(event) => setSearchLog(event.target.value)}
          />
          {searchLog && (
            <button
              type="button"
              onClick={() => setSearchLog("")}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Trạng thái filter using common Dropdown */}
        <div className="w-full sm:w-36 shrink-0">
          <Dropdown
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={statusOptions}
            variant="filter"
            size="sm"
            className="w-full"
          />
        </div>

        {/* Dropdown Preset Thời gian */}
        <div className="w-full sm:w-40 shrink-0">
          <Dropdown
            value={datePreset === "custom" ? ("" as any) : datePreset}
            placeholder={startDate || endDate ? "Mốc thời gian" : "Tất cả thời gian"}
            onChange={handleDatePresetChange}
            options={datePresetOptions}
            variant="filter"
            size="sm"
            className="w-full"
          />
        </div>

        {/* Khung lọc khoảng thời gian trực tiếp (Từ ngày ➔ Đến ngày) */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs shadow-2xs shrink-0">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="font-bold text-slate-400 text-[10px] uppercase font-mono shrink-0">
            Từ:
          </span>
          <input
            type="date"
            aria-label="Từ ngày"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setDatePreset("custom");
            }}
            className="bg-transparent font-medium text-slate-700 outline-none text-xs cursor-pointer w-[115px]"
          />
          <span className="text-slate-300 font-bold shrink-0">→</span>
          <span className="font-bold text-slate-400 text-[10px] uppercase font-mono shrink-0">
            Đến:
          </span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setDatePreset("custom");
            }}
            className="bg-transparent font-medium text-slate-700 outline-none text-xs cursor-pointer w-[115px]"
          />
          {(startDate || endDate || datePreset !== "all") && (
            <button
              type="button"
              onClick={handleClearDateFilter}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors ml-0.5 cursor-pointer"
              title="Đặt lại bộ lọc thời gian"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
