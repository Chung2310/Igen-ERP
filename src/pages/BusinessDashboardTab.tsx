import { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { AdminDatePicker } from '../components/user-admin/AdminDatePicker';
import { StyledSelect } from '../components/common/StyledSelect';
import { BUSINESS_TYPE_LABELS, resolveBusinessType } from '../config/businessTypes';
import { BusinessOverviewDashboard } from '../components/dashboard/BusinessOverviewDashboard';
import { useBusinessOverview } from '../components/dashboard/useBusinessOverview';
import { getDashboardRange, localDateKey, type DashboardPeriod } from '../components/dashboard/dashboardPeriod';
import { BUSINESS_TIME_ZONE } from '../../shared/business-calendar';

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'today', label: 'Hôm nay' }, { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' }, { value: 'quarter', label: 'Quý này' },
  { value: 'year', label: 'Năm nay' }, { value: 'custom', label: 'Khoảng ngày' },
];

export default function BusinessDashboardTab() {
  const { userProfile } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [fromDate, setFromDate] = useState(() => localDateKey(new Date()));
  const [toDate, setToDate] = useState(() => localDateKey(new Date()));
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => { if (!document.hidden) setClock(Date.now()); };
    const timer = window.setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const range = useMemo(() => getDashboardRange(period, fromDate, toDate, new Date(clock)), [period, fromDate, toDate, clock]);
  const from = range.valid ? localDateKey(range.start) : '';
  const to = range.valid ? localDateKey(range.end) : '';
  const { data, loading, error, refreshError, refresh } = useBusinessOverview(from, to, range.valid);
  const businessType = data?.businessType || resolveBusinessType(userProfile?.businessType);
  const name = userProfile?.displayName?.trim().split(/\s+/).slice(-2).join(' ') || 'bạn';
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TIME_ZONE, hour: 'numeric', hourCycle: 'h23' }).format(new Date(clock)));
  const greeting = hour >= 5 && hour < 11 ? 'Chào buổi sáng' : hour < 14 && hour >= 11 ? 'Chào buổi trưa' : hour < 18 && hour >= 14 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const date = new Date(clock).toLocaleDateString('vi-VN', { timeZone: BUSINESS_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return <div id="dashboard_tab_view" className="mx-auto w-full min-w-0 max-w-screen-2xl space-y-5 pb-8 text-left text-on-surface [--color-on-surface-variant:var(--color-slate-600)]">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-balance text-2xl font-semibold">Tổng quan</h1><span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><Building2 aria-hidden="true" className="size-3.5" />{BUSINESS_TYPE_LABELS[businessType]}</span></div>
        <p className="mt-2 text-pretty text-sm text-on-surface-variant">{greeting}, <strong className="font-medium text-on-surface">{name}</strong>. Theo dõi hoạt động và những việc cần chú ý hôm nay.</p>
        <p className="mt-1 text-pretty text-xs text-on-surface-variant">{activeBranchId ? activeBranch?.name || userProfile?.branchName || 'Chi nhánh đang chọn' : 'Toàn doanh nghiệp'}{data?.primary && data.primary !== businessType ? ' · Nội dung ưu tiên theo module ' + (data.primary === 'retail' ? 'Bán hàng' : BUSINESS_TYPE_LABELS[data.primary]) + ' đang được cấp quyền' : ''}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2"><div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs shadow-sm"><CalendarDays aria-hidden="true" className="size-4 shrink-0 text-primary" /><p className="text-pretty">{date}</p></div><button type="button" onClick={refresh} disabled={loading || !range.valid} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium shadow-sm hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"><RotateCcw aria-hidden="true" className="size-4" />Làm mới</button></div>
    </header>
    <section aria-label="Khoảng thời gian thống kê" className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays aria-hidden="true" className="size-4 text-primary" />Thống kê theo kỳ</div>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {period !== 'custom' && range.valid && <p className="text-xs tabular-nums text-on-surface-variant">{range.start.toLocaleDateString('vi-VN', { timeZone: BUSINESS_TIME_ZONE })} – {range.end.toLocaleDateString('vi-VN', { timeZone: BUSINESS_TIME_ZONE })}</p>}
        <div className="min-w-40"><StyledSelect value={period} options={periods} onChange={value => setPeriod(value as DashboardPeriod)} ariaLabel="Kỳ thống kê" className="min-h-11" /></div>
      </div>
      {period === 'custom' && <div className="grid w-full gap-3 border-t border-outline-variant pt-3 sm:grid-cols-2"><div className="space-y-2"><p className="text-xs font-medium text-on-surface-variant">Từ ngày</p><AdminDatePicker label="Từ ngày" value={fromDate} max={toDate} onChange={setFromDate} /></div><div className="space-y-2"><p className="text-xs font-medium text-on-surface-variant">Đến ngày</p><AdminDatePicker label="Đến ngày" value={toDate} min={fromDate} onChange={setToDate} /></div></div>}
      {!range.valid && <p role="alert" className="w-full text-pretty text-sm">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
    </section>
    {refreshError && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-pretty text-sm text-on-surface-variant">{refreshError}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5"><p className="text-pretty text-sm">{error}</p><button type="button" onClick={refresh} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Thử lại</button></div>}
    {range.valid && !error && <BusinessOverviewDashboard data={data} loading={loading} businessType={businessType} onRetry={refresh} />}
    {data && <p className="text-pretty text-right text-xs text-on-surface-variant">Cập nhật lúc {new Date(data.generatedAt).toLocaleTimeString('vi-VN', { timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit' })} · Số liệu hiện tại và số liệu theo kỳ được ghi rõ tại từng khối.</p>}
  </div>;
}
