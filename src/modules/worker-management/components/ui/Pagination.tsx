import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  itemName?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemName = "học viên",
  className,
}: PaginationProps) {
  const pageInputRef = React.useRef<HTMLInputElement>(null);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  const changePage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    onPageChange(nextPage);
    if (pageInputRef.current) {
      pageInputRef.current.value = String(nextPage);
    }
  };

  const handleJumpToPage = () => {
    const parsedPage = Number.parseInt(pageInputRef.current?.value || "", 10);
    if (Number.isNaN(parsedPage)) {
      if (pageInputRef.current) {
        pageInputRef.current.value = String(currentPage);
      }
      return;
    }

    changePage(parsedPage);
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/50 border-t border-slate-100 gap-4 sm:gap-0 no-print",
        className,
      )}
    >
      <div className="text-xs font-medium text-slate-400 order-2 sm:order-1">
        Hiển thị {startItem} - {endItem} của {totalItems} {itemName}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 order-1 sm:order-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            title="Trang trước"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {visiblePages.map((page, index) =>
              page === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-1 text-slate-400">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => changePage(page)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    currentPage === page
                      ? "bg-cyan-600 text-white shadow-md shadow-cyan-100"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-cyan-600 hover:text-cyan-600",
                  )}
                >
                  {page}
                </button>
              ),
            )}
          </div>

          <span className="sm:hidden text-xs font-bold text-slate-600 px-3">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Trang sau"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-medium text-slate-500">
            Đến trang
          </span>
          <input
            key={currentPage}
            ref={pageInputRef}
            type="number"
            min={1}
            max={totalPages}
            defaultValue={currentPage}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleJumpToPage();
              }
            }}
            className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-semibold text-slate-700 outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            aria-label="Nhập số trang"
          />
          <button
            type="button"
            onClick={handleJumpToPage}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-all hover:border-cyan-600 hover:text-cyan-600"
          >
            Đi
          </button>
        </div>
      </div>
    </div>
  );
}

function getVisiblePages(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [
      1,
      "ellipsis",
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ];
}
