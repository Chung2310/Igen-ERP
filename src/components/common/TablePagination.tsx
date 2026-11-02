import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dropdown } from "./Dropdown";

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  itemLabel = "bản ghi",
  pageSizeOptions = [10, 15, 25, 50],
  className = "",
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const safeTotalPages = Math.max(1, totalPages);

  const dropdownOptions = pageSizeOptions.map((opt) => ({
    value: opt,
    label: `${opt} dòng`,
  }));

  return (
    <div
      className={`relative z-20 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Left: Rows Per Page & Item Range Summary */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500 font-medium">Mỗi trang:</span>
        <Dropdown<number>
          aria-label="Số dòng mỗi trang"
          value={pageSize}
          onChange={(val) => {
            onPageSizeChange(val);
            onPageChange(1);
          }}
          options={dropdownOptions}
          variant="default"
          size="xs"
          direction="up"
        />
        <span className="text-slate-500 ml-1">
          (Hiển thị <b className="text-slate-800">{startItem} - {endItem}</b> trong{" "}
          <b className="text-slate-800">{totalItems}</b> {itemLabel})
        </span>
      </div>

      {/* Right: Page Navigation Controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
          title="Trang đầu"
        >
          «
        </button>

        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Trước</span>
        </button>

        <span className="rounded-lg bg-slate-100 border border-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-800">
          {currentPage} / {safeTotalPages}
        </span>

        <button
          type="button"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
        >
          <span>Sau</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
          title="Trang cuối"
        >
          »
        </button>
      </div>
    </div>
  );
}
