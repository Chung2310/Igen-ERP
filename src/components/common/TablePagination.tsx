import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
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
  appearance?: "erp";
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
  appearance,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const safeTotalPages = Math.max(1, totalPages);
  const erp = appearance === "erp";
  const mutedText = erp ? "text-on-surface-variant" : "text-slate-500";
  const strongText = erp ? "text-on-surface" : "text-slate-800";
  const buttonColors = erp
    ? "min-h-8 border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"
    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900";
  const buttonStyle = cn("rounded-lg border py-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs", buttonColors);

  const dropdownOptions = pageSizeOptions.map((opt) => ({
    value: opt,
    label: `${opt} dòng`,
  }));

  return (
    <div
      className={cn("relative z-20 flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 py-3 text-xs select-none",
        erp ? "border-outline-variant bg-surface-container-lowest text-on-surface" : "border-slate-100 bg-slate-50/50 text-slate-600",
        className)}
    >
      {/* Left: Rows Per Page & Item Range Summary */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("font-medium", mutedText)}>Mỗi trang:</span>
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
        <span className={cn("ml-1", mutedText)}>
          (Hiển thị <b className={strongText}>{startItem} - {endItem}</b> trong{" "}
          <b className={strongText}>{totalItems}</b> {itemLabel})
        </span>
      </div>

      {/* Right: Page Navigation Controls */}
      <nav aria-label="Phân trang" className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className={cn("px-2 font-bold", buttonStyle)}
          aria-label="Trang đầu"
          title="Trang đầu"
        >
          «
        </button>

        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className={cn("inline-flex items-center gap-1 px-2.5 font-semibold", buttonStyle)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Trước</span>
        </button>

        <span className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums",
          erp ? "border-outline-variant bg-surface-container text-on-surface" : "border-slate-200/80 bg-slate-100 text-slate-800")}>
          {currentPage} / {safeTotalPages}
        </span>

        <button
          type="button"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))}
          className={cn("inline-flex items-center gap-1 px-2.5 font-semibold", buttonStyle)}
        >
          <span>Sau</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          className={cn("px-2 font-bold", buttonStyle)}
          aria-label="Trang cuối"
          title="Trang cuối"
        >
          »
        </button>
      </nav>
    </div>
  );
}
