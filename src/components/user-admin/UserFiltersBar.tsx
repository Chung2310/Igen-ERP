import { Search, X } from "lucide-react";
import { AdminDatePicker } from "./AdminDatePicker";

interface Props {
  searchQuery: string;
  filterStartDate: string;
  filterEndDate: string;
  visibleUsersCount: number;
  totalUsersCount: number;
  onSearchChange: (value: string) => void;
  onFilterStartDateChange: (value: string) => void;
  onFilterEndDateChange: (value: string) => void;
  onClear: () => void;
}

export function UserFiltersBar({
  searchQuery,
  filterStartDate,
  filterEndDate,
  visibleUsersCount,
  totalUsersCount,
  onSearchChange,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onClear,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest px-3 py-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Tìm tài khoản"
            placeholder="Tìm tên hoặc email"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-10 text-base font-normal text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary sm:text-sm"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-on-surface-variant hover:bg-surface hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <AdminDatePicker label="Từ ngày" value={filterStartDate} onChange={onFilterStartDateChange} max={filterEndDate || undefined} />
          <AdminDatePicker label="Đến ngày" value={filterEndDate} onChange={onFilterEndDateChange} min={filterStartDate || undefined} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pb-1 text-xs font-normal text-on-surface-variant lg:justify-end">
        <span className="tabular-nums">{visibleUsersCount} / {totalUsersCount} tài khoản</span>
        {(searchQuery || filterStartDate || filterEndDate) && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 font-medium text-on-surface-variant hover:bg-surface hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary">
            <X className="h-3.5 w-3.5" /> Xóa lọc
          </button>
        )}
      </div>
    </div>
  );
}
