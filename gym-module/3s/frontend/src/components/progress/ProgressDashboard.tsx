import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Search,
  SearchX,
  TrendingDown,
  User,
  Users,
  X,
} from 'lucide-react';
import type { CustomerProgressOverview } from '../../types/progress';
import Pagination from '../ui/Pagination';
import ProgressEmptyState from './ProgressEmptyState';

const PROGRESS_ITEMS_PER_PAGE = 12;
const number = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : 'Chưa có');

export default function ProgressDashboard({
  items,
  onView,
  onLogWorkout,
}: {
  items: CustomerProgressOverview[];
  onView: (item: CustomerProgressOverview) => void;
  onLogWorkout: (item: CustomerProgressOverview) => void;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN');
    return keyword
      ? items.filter(
        (item) =>
          item.customer.fullName.toLocaleLowerCase('vi-VN').includes(keyword) ||
          item.customer.phone.includes(keyword),
      )
      : items;
  }, [items, search]);
  const totalPages = Math.ceil(filtered.length / PROGRESS_ITEMS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const visibleItems = useMemo(() => {
    const start = (currentPage - 1) * PROGRESS_ITEMS_PER_PAGE;
    return filtered.slice(start, start + PROGRESS_ITEMS_PER_PAGE);
  }, [currentPage, filtered]);

  const totalSessions = items.reduce((sum, item) => sum + item.sessionCount, 0);
  const activeCustomers = items.filter((item) => item.sessionCount > 0).length;
  const attendanceRates = items
    .map((item) => item.analytics.attendance.rate)
    .filter((value): value is number => value !== null);
  const averageAttendance = attendanceRates.length
    ? attendanceRates.reduce((sum, value) => sum + value, 0) / attendanceRates.length
    : null;

  return (
    <div className="flex flex-col gap-[18px]">
      {/* 1. Metrics Banner — dùng đúng chuẩn pt-metrics-banner */}
      <section aria-label="Tổng quan tiến độ" className="pt-metrics-banner">
        <article className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Khách được quản lý</div>
            <div className="pt-metric-val text-[#003b70]">{items.length} khách hàng</div>
          </div>
          <div className="pt-metric-icon bg-sky-50 text-sky-600">
            <Users size={20} />
          </div>
        </article>

        <article className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Khách có hoạt động</div>
            <div className="pt-metric-val text-emerald-600">{activeCustomers}</div>
          </div>
          <div className="pt-metric-icon bg-emerald-50 text-emerald-600">
            <Activity size={20} />
          </div>
        </article>

        <article className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Tổng buổi đã ghi nhận</div>
            <div className="pt-metric-val text-amber-600">{totalSessions}</div>
          </div>
          <div className="pt-metric-icon bg-amber-50 text-amber-600">
            <CalendarDays size={20} />
          </div>
        </article>

        <article className="pt-metric-card">
          <div>
            <div className="pt-metric-label">Tham gia trung bình</div>
            <div className="pt-metric-val text-[#003b70]">
              {averageAttendance === null ? '—' : `${number(averageAttendance)}%`}
            </div>
          </div>
          <div className="pt-metric-icon bg-indigo-50 text-indigo-600">
            <TrendingDown size={20} />
          </div>
        </article>
      </section>

      {/* 2. Toolbar — dùng đúng chuẩn pt-toolbar và search-field */}
      <div className="pt-toolbar">
        <div className="search-field max-w-[360px]">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên hoặc số điện thoại..."
            aria-label="Tìm kiếm học viên"
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              aria-label="Xóa tìm kiếm"
              title="Xóa tìm kiếm"
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="text-xs font-bold text-slate-500 shrink-0">
          {filtered.length} / {items.length} học viên
        </div>
      </div>

      {/* 3. Grid danh sách — dùng đúng chuẩn pt-grid / pt-card */}
      {filtered.length > 0 ? (
        <div className="pt-grid">
          {visibleItems.map((item) => {
            const weightDelta = item.analytics.bodyDeltas?.weight;
            return (
              <article className="pt-card group" key={item.customer._id}>
                <div className="pt-card-body">
                  {/* Customer Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/90 shrink-0 flex items-center justify-center shadow-2xs">
                        <div className="w-full h-full bg-gradient-to-br from-[#003b70] to-[#00a4e4] text-white font-bold flex items-center justify-center text-sm">
                          {item.customer.fullName
                            ? item.customer.fullName.trim().charAt(0).toUpperCase()
                            : <User size={16} />}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-[#003b70] text-sm group-hover:text-sky-600 transition-colors leading-snug truncate">
                          {item.customer.fullName}
                        </h3>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                          {item.customer.phone || '—'}
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${item.customer.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                      {item.customer.status === 'ACTIVE' ? 'Đang tập' : item.customer.status}
                    </span>
                  </div>

                  {/* Metric Stats */}
                  <dl
                    role="group"
                    aria-label={`Thông tin tiến độ của ${item.customer.fullName}`}
                    className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-600"
                  >
                    <div className="flex items-center justify-between">
                      <dt className="font-semibold text-slate-500">Buổi đã tập</dt>
                      <dd className="font-bold text-slate-800">
                        {item.sessionCount} <span className="font-normal text-slate-400">buổi</span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-semibold text-slate-500">Tỷ lệ tham gia</dt>
                      <dd className="font-bold text-slate-800">
                        {item.analytics.attendance.rate === null
                          ? '—'
                          : `${number(item.analytics.attendance.rate)}%`}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-semibold text-slate-500">Cân nặng</dt>
                      <dd className="font-bold text-slate-800">
                        {item.latestMeasurement?.weight
                          ? `${number(item.latestMeasurement.weight)} kg`
                          : '—'}
                        {typeof weightDelta === 'number' && (
                          <span
                            className={
                              weightDelta > 0
                                ? 'ml-1.5 text-rose-600 font-semibold'
                                : 'ml-1.5 text-emerald-600 font-semibold'
                            }
                          >
                            ({weightDelta > 0 ? '+' : ''}
                            {number(weightDelta)})
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="font-semibold text-slate-500">Buổi gần nhất</dt>
                      <dd className="font-bold text-slate-800">{date(item.lastSessionAt)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Card Footer — dùng đúng chuẩn pt-card-footer */}
                <div className="pt-card-footer">
                  <button
                    type="button"
                    className="h-9 px-4 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap min-w-[110px]"
                    aria-label={`Xem tiến độ ${item.customer.fullName}`}
                    onClick={() => onView(item)}
                  >
                    Xem tiến độ
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-[#003b70] hover:bg-[#00264d] transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap min-w-[110px]"
                    aria-label={`Ghi nhận buổi tập ${item.customer.fullName}`}
                    onClick={() => onLogWorkout(item)}
                  >
                    <Dumbbell size={14} aria-hidden="true" />
                    Ghi nhận
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <ProgressEmptyState
          icon={SearchX}
          title="Không tìm thấy học viên"
          description="Thử tìm lại bằng tên hoặc số điện thoại khác."
        />
      )}
      <Pagination
        page={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PROGRESS_ITEMS_PER_PAGE}
        itemLabel="học viên"
        onPageChange={setPage}
      />
    </div>
  );
}
