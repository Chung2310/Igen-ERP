import { Search, X } from "lucide-react";

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
    <div className="flex shrink-0 flex-col gap-3 bg-white px-5 py-4 lg:flex-row lg:items-end lg:justify-between sm:px-6">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Tìm tài khoản"
            placeholder="Tìm tên hoặc email"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="min-h-10 w-full rounded-xl bg-slate-50 py-2 pl-10 pr-10 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-cyan-200"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
            Từ ngày
            <input type="date" value={filterStartDate} onChange={(event) => onFilterStartDateChange(event.target.value)} className="min-h-10 min-w-0 rounded-xl bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-cyan-200" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
            Đến ngày
            <input type="date" value={filterEndDate} onChange={(event) => onFilterEndDateChange(event.target.value)} className="min-h-10 min-w-0 rounded-xl bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-cyan-200" />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pb-1 text-xs text-slate-500 lg:justify-end">
        <span>{visibleUsersCount} / {totalUsersCount} tài khoản</span>
        {(searchQuery || filterStartDate || filterEndDate) && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-cyan-50 hover:text-cyan-700">
            <X className="h-3.5 w-3.5" /> Xóa lọc
          </button>
        )}
      </div>
    </div>
  );
}
