import { useId, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Bell, BookOpen, BriefcaseBusiness, CheckCheck, ChevronRight, CircleHelp, Handshake, Package, Receipt, UsersRound, Wallet, Wrench, type LucideIcon } from 'lucide-react';
import type { BusinessOverview, OverviewPoint, OverviewProject, OverviewSection, OverviewStatus } from '../../../shared/business-overview';
import { cn } from '../../modules/student-management/lib/utils';
import { DASHBOARD_CHART_PALETTE, DASHBOARD_CHART_TRACK } from './dashboardPalette';
import { buildOverviewSeries } from './businessOverviewCharts';
import { businessOverviewPresentation, overviewDestinations as destination, type DashboardAlert, type DashboardMetric } from './businessOverviewPresentation';
import { BUSINESS_TIME_ZONE, businessDateKey, parseBusinessDate } from '../../../shared/business-calendar';

const count = (value: number) => value.toLocaleString('vi-VN');
const money = (value: number) => `${count(value)} ₫`;
const compactMoney = (value: number) => Math.abs(value) >= 1e9 ? `${(value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫` : Math.abs(value) >= 1e6 ? `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu ₫` : money(value);
const card = 'min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm sm:p-5';
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container ${focus}`;
const sectionLabels: Record<OverviewSection, string> = { education: 'Học viên & học phí', labor: 'Lao động & dự án', retail: 'Bán hàng/POS', partners: 'Đối tác lao động', hr: 'Nhân sự', inventory: 'Kho hàng', repair: 'Sửa chữa & bảo hành', finance: 'Công nợ tài chính', customer: 'Khách hàng' };
function navigate(href: string) { window.history.pushState(null, '', href); window.dispatchEvent(new PopStateEvent('popstate')); }

function Panel({ title, description, children, action, headerAction, className }: { title: string; description?: string; children: ReactNode; action?: { label: string; href: string }; headerAction?: ReactNode; className?: string }) {
  return <section className={cn(card, 'flex h-full flex-col', className)}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-balance text-base font-semibold">{title}</h2>{description && <p className="mt-1 text-pretty text-xs leading-5 text-on-surface-variant">{description}</p>}</div>
      {headerAction || (action && <button type="button" onClick={() => navigate(action.href)} className={cn(focus, 'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1 text-xs font-medium text-primary')}>{action.label}<ArrowUpRight aria-hidden="true" className="size-3.5" /></button>)}
    </div><div className="min-w-0 flex-1">{children}</div>
  </section>;
}

function Kpi({ icon: Icon, label, value, display, detail, href, change, unavailable }: { icon: LucideIcon; label: string; value: string; display?: string; detail: string; href: string; change?: number | null; unavailable?: boolean }) {
  return <button type="button" onClick={() => navigate(href)} disabled={unavailable} className={cn(card, focus, 'group flex w-full items-start gap-3 text-left transition-colors enabled:hover:border-primary disabled:cursor-default')}>
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span>
    <span className="min-w-0 flex-1"><strong className={cn('block truncate font-semibold tabular-nums', display ? 'text-xl' : 'text-2xl')} title={value}>{display || value}</strong><span className="mt-1 block text-xs font-medium text-on-surface-variant">{label}</span><span className="mt-2 flex items-center gap-1 text-xs text-on-surface-variant">
      {change != null && <>{change >= 0 ? <ArrowUpRight aria-hidden="true" className="size-3 shrink-0" /> : <ArrowDownRight aria-hidden="true" className="size-3 shrink-0" />}<span className="tabular-nums">{change > 0 ? '+' : ''}{change}%</span></>}
      <span className="truncate">{detail}</span>
    </span></span>
  </button>;
}

function Trend({ points, from, to, currency, label: chartLabel }: { points: OverviewPoint[]; from: string; to: string; currency: boolean; label?: string }) {
  const id = useId();
  const rows = buildOverviewSeries(points, from, to);
  const min = Math.min(0, ...rows.map(row => row.value));
  const max = Math.max(1, ...rows.map(row => row.value));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const show = currency ? money : count;
  const x = (index: number) => 42 + index / Math.max(1, rows.length - 1) * 530;
  const y = (value: number) => 180 - (value - min) / (max - min) * 145;
  const label = (date: string) => date.length === 4 ? date : date.length === 7 ? `${date.slice(5)}/${date.slice(0, 4)}` : `${date.slice(8)}/${date.slice(5, 7)}`;
  const ticks = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].filter(index => rows[index]);
  return <>
    <div className="mb-3 flex flex-wrap items-baseline gap-2"><strong className="text-3xl font-semibold tabular-nums">{show(total)}</strong><span className="text-xs text-on-surface-variant">trong khoảng thời gian đã chọn</span></div>
    {rows.every(row => row.value === 0) ? <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface p-5 text-center text-sm text-on-surface-variant">Chưa có phát sinh trong khoảng thời gian này.</div> : <>
      <svg viewBox="0 0 600 225" role="img" aria-labelledby={id} className="h-64 w-full overflow-visible">
        <title id={id}>{chartLabel || (currency ? 'Học phí thực thu' : 'Hồ sơ lao động tạo mới')}: {show(total)}. Bảng số liệu chi tiết nằm bên dưới.</title>
        {[0, 1, 2, 3].map(step => <line key={step} x1="42" x2="572" y1={35 + step * 145 / 3} y2={35 + step * 145 / 3} stroke="currentColor" className="text-outline-variant" strokeDasharray="4 5" />)}
        <polygon points={`42,${y(0)} ${rows.map((row, index) => `${x(index)},${y(row.value)}`).join(' ')} ${x(rows.length - 1)},${y(0)}`} fill="currentColor" className="text-primary" opacity="0.09" />
        <polyline points={rows.map((row, index) => `${x(index)},${y(row.value)}`).join(' ')} fill="none" stroke="currentColor" className="text-primary" strokeWidth="3" strokeLinejoin="round" />
        {ticks.map(index => <g key={index}><circle cx={x(index)} cy={y(rows[index].value)} r="4" fill="currentColor" className="text-primary"><title>{label(rows[index].date)}: {show(rows[index].value)}</title></circle><text x={x(index)} y="210" textAnchor="middle" fill="currentColor" className="text-on-surface-variant" fontSize="12">{label(rows[index].date)}</text></g>)}
      </svg>
      <details className="mt-2 text-xs text-on-surface-variant"><summary className={cn(focus, 'min-h-11 cursor-pointer py-3')}>Xem số liệu chi tiết</summary><div className="max-h-48 overflow-y-auto"><table className="w-full text-left"><caption className="sr-only">Số liệu theo thời gian</caption><thead><tr><th scope="col" className="py-2">Thời gian</th><th scope="col" className="py-2 text-right">{currency ? 'Giá trị (VNĐ)' : 'Hồ sơ mới'}</th></tr></thead><tbody>{rows.map(row => <tr key={row.date} className="border-t border-outline-variant"><th scope="row" className="py-2 font-normal">{label(row.date)}</th><td className="py-2 text-right tabular-nums">{show(row.value)}</td></tr>)}</tbody></table></div></details>
    </>}
  </>;
}

function Distribution({ rows, currency = false }: { rows: OverviewStatus[]; currency?: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let cumulative = 0;
  const slices = rows.map((row, index) => {
    const start = cumulative;
    cumulative += total ? row.value / total * 100 : 0;
    return `${DASHBOARD_CHART_PALETTE[index % DASHBOARD_CHART_PALETTE.length]} ${start}% ${cumulative}%`;
  });
  return <div className="flex min-h-56 flex-col items-center justify-center gap-5">
    <div role="img" aria-label={rows.map(row => `${row.label}: ${currency ? money(row.value) : count(row.value)}`).join(', ') || 'Chưa có dữ liệu'} className="grid size-36 shrink-0 place-items-center rounded-full p-4" style={{ background: total ? `conic-gradient(${slices.join(',')})` : DASHBOARD_CHART_TRACK }}><div className="grid size-full place-content-center rounded-full bg-surface-container-lowest text-center"><strong className="text-3xl font-semibold tabular-nums">{currency ? total > 0 ? '100%' : '0%' : count(total)}</strong><span className="text-xs text-on-surface-variant">{currency ? 'Tỷ trọng' : 'Tổng số'}</span></div></div>
    <ul className="w-full space-y-3">{rows.map((row, index) => <li key={row.label} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 flex-1 items-center gap-2"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: DASHBOARD_CHART_PALETTE[index % DASHBOARD_CHART_PALETTE.length] }} /><span className="truncate" title={row.label}>{row.label}</span></span><span className="shrink-0 font-semibold tabular-nums" title={currency ? money(row.value) : undefined}>{currency ? compactMoney(row.value) + ' · ' + (total ? row.value / total * 100 : 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%' : count(row.value)}</span></li>)}</ul>
  </div>;
}

function ProductDistribution({ retail }: { retail: NonNullable<BusinessOverview['retail']> }) {
  const products = retail.products.filter(row => row.netSales > 0).slice().sort((a, b) => b.netSales - a.netSales);
  const rows = products.slice(0, 5).map(row => ({ label: row.productName + (row.sku ? ' (' + row.sku + ')' : ''), value: row.netSales }));
  if (products.length > 5) rows.push({ label: 'Khác', value: products.slice(5).reduce((sum, row) => sum + row.netSales, 0) });
  return rows.length ? <Distribution rows={rows} currency /> : <div className="grid min-h-56 place-items-center rounded-xl bg-surface p-4 text-center text-sm text-on-surface-variant"><p className="text-pretty">Chưa có giá trị sản phẩm dương để tính tỷ trọng. Các khoản hoàn trả vẫn được tính trong doanh số bán hàng.</p></div>;
}

function Projects({ rows, href, labor }: { rows: OverviewProject[]; href: string; labor: boolean }) {
  if (!rows.length) return <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl bg-surface p-4 text-center"><p className="text-pretty text-sm text-on-surface-variant">{labor ? 'Chưa có dự án đang hoặc sắp triển khai.' : 'Chưa có lớp đang học hoặc sắp khai giảng.'}</p><button type="button" onClick={() => navigate(href)} className={button}>{labor ? 'Mở quản lý dự án' : 'Mở quản lý lớp học'}</button></div>;
  return <ul className="divide-y divide-outline-variant">{rows.map(row => <li key={row.id} className="py-3 first:pt-0 last:pb-0"><button type="button" onClick={() => navigate(href)} className={cn(focus, 'flex min-h-11 w-full items-center gap-3 rounded-lg text-left')}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{labor ? <BriefcaseBusiness aria-hidden="true" className="size-4" /> : <BookOpen aria-hidden="true" className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.name}</span><span className="mt-1 block text-xs text-on-surface-variant">{row.status}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{count(row.allocated)}{row.quota > 0 ? ` / ${count(row.quota)}` : ''}</span><span className="mt-1 block text-xs text-on-surface-variant">{labor ? 'lao động' : 'học viên'}</span></span></button>{row.quota > 0 && <div role="progressbar" aria-label={`Phân bổ ${row.name}`} aria-valuemin={0} aria-valuemax={row.quota} aria-valuenow={Math.min(row.allocated, row.quota)} aria-valuetext={`${row.allocated} trên ${row.quota}`} className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.allocated / row.quota * 100)}%` }} /></div>}</li>)}</ul>;
}

const metricIcons: Record<DashboardMetric['icon'], LucideIcon> = { people: UsersRound, money: Wallet, book: BookOpen, project: BriefcaseBusiness, receipt: Receipt, partner: Handshake, stock: Package, repair: Wrench, check: CheckCheck };
const metricColumns: Record<number, string> = { 1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5' };

function MetricGrid({ metrics, label }: { metrics: DashboardMetric[]; label: string }) {
  return <section aria-label={label} className={cn('grid gap-3 sm:grid-cols-2', metricColumns[Math.min(5, metrics.length)])}>
    {metrics.map(metric => <Kpi key={metric.id} icon={metricIcons[metric.icon]} label={metric.label}
      value={metric.money ? money(metric.value) : metric.total != null ? count(metric.value) + ' / ' + count(metric.total) : count(metric.value)}
      display={metric.money ? compactMoney(metric.value) : undefined} detail={metric.detail} href={metric.href} change={metric.change} />)}
  </section>;
}

function OperationList({ metrics }: { metrics: DashboardMetric[] }) {
  return <section aria-label="Vận hành doanh nghiệp"><ul className="divide-y divide-outline-variant">{metrics.map(metric => {
    const Icon = metricIcons[metric.icon];
    return <li key={metric.id}><button type="button" onClick={() => navigate(metric.href)} className={cn(focus, 'flex min-h-16 w-full items-center gap-3 rounded-lg py-3 text-left')}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-pretty text-sm font-medium">{metric.label}</span><span className="mt-1 block text-pretty text-xs text-on-surface-variant">{metric.detail}</span></span><strong className="shrink-0 text-sm font-semibold tabular-nums" title={metric.money ? money(metric.value) : undefined}>{metric.money ? compactMoney(metric.value) : count(metric.value)}</strong></button></li>;
  })}</ul></section>;
}

function AlertPanel({ rows, failed, onRetry }: { rows: DashboardAlert[]; failed: boolean; onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 5);
  return <Panel title="Cảnh báo & nhắc việc" className="min-h-96"
    headerAction={rows.length > 5 ? <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className={cn(focus, 'min-h-11 rounded-lg px-1 text-xs font-medium text-primary')}>{expanded ? 'Thu gọn' : 'Xem tất cả'}</button> : undefined}>
    {visible.length ? <ul className="space-y-3">{visible.map(row => <li key={row.id}>
      <button type="button" onClick={() => navigate(row.href)} className={cn(focus, 'flex min-h-16 w-full items-center gap-2.5 rounded-xl border p-3 text-left', row.value > 0 ? 'border-primary/20 bg-primary/5' : 'border-outline-variant bg-surface')}>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{row.value > 0 ? <Bell aria-hidden="true" className="size-4" /> : <CheckCheck aria-hidden="true" className="size-4" />}</span>
        <span className="min-w-0 flex-1"><span className="block text-pretty text-xs font-semibold leading-5">{row.value > 0 ? row.label : row.healthyLabel}</span><span className="mt-0.5 block text-pretty text-xs leading-4 text-on-surface-variant">{row.value > 0 ? row.detail : row.healthyDetail}</span></span>
        {row.value > 0 && <strong className="shrink-0 text-base tabular-nums">{count(row.value)}</strong>}
        <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
      </button>
    </li>)}</ul> : <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl bg-surface p-4 text-center">
      <CheckCheck aria-hidden="true" className="size-7 text-primary" /><p className="text-pretty text-sm text-on-surface-variant">{failed ? 'Các khối chưa tải được sẽ chưa có cảnh báo để hiển thị.' : 'Chưa có cảnh báo trong các module được cấp quyền.'}</p><button type="button" onClick={onRetry} className={button}>Làm mới số liệu</button>
    </div>}
  </Panel>;
}

function ContractPanel({ hr }: { hr: NonNullable<BusinessOverview['hr']> }) {
  const today = parseBusinessDate(businessDateKey(new Date()))!;
  return <Panel title="Hợp đồng & cảnh báo đến hạn" description="Nhân sự · trong 30 ngày tới" action={{ label: 'Xem tất cả', href: destination.contracts }}>
    {hr.contracts?.length ? <table className="w-full text-left text-xs"><caption className="sr-only">Hợp đồng nhân sự sắp hết hạn</caption><thead className="text-on-surface-variant"><tr><th scope="col" className="pb-3 font-medium">Nhân sự</th><th scope="col" className="pb-3 font-medium">Hạn</th><th scope="col" className="pb-3 text-right font-medium">Còn lại</th></tr></thead><tbody className="divide-y divide-outline-variant">
      {hr.contracts.map(contract => {
        const due = new Date(contract.endDate);
        const valid = !Number.isNaN(due.getTime());
        const remaining = valid ? Math.round((parseBusinessDate(businessDateKey(due))!.getTime() - today.getTime()) / 86400000) : null;
        return <tr key={contract.id}><th scope="row" className="max-w-32 py-3 pr-2 text-left font-medium"><button type="button" onClick={() => navigate(destination.contracts)} className={cn(focus, 'min-h-11 w-full truncate rounded-lg text-left')} title={contract.employeeName}>{contract.employeeName}</button></th><td className="whitespace-nowrap py-3 pr-2 tabular-nums text-on-surface-variant">{valid ? due.toLocaleDateString('vi-VN', { timeZone: BUSINESS_TIME_ZONE }) : '—'}</td><td className="py-3 text-right tabular-nums text-primary">{remaining == null ? '—' : remaining < 0 ? 'Quá hạn' : remaining === 0 ? 'Hôm nay' : count(remaining) + ' ngày'}</td></tr>;
      })}
    </tbody></table> : <div className="grid min-h-40 place-items-center rounded-xl bg-surface p-4 text-center text-sm text-on-surface-variant"><p className="text-pretty">{hr.expiringContracts > 0 ? 'Có ' + count(hr.expiringContracts) + ' hợp đồng sắp hết hạn. Mở danh sách hợp đồng để xem chi tiết.' : 'Không có hợp đồng nhân sự sắp hết hạn.'}</p></div>}
  </Panel>;
}

function TaskProgressPanel({ hr }: { hr: NonNullable<BusinessOverview['hr']> }) {
  const rows = [{ label: 'Đã hoàn thành', value: hr.tasks.done }, { label: 'Đang thực hiện', value: hr.tasks.doing }, { label: 'Chưa bắt đầu', value: hr.tasks.todo }];
  const other = Math.max(0, hr.tasks.total - rows.reduce((sum, row) => sum + row.value, 0));
  if (other) rows.push({ label: 'Trạng thái khác', value: other });
  return <Panel title="Tiến độ công việc" description="Công việc tạo trong kỳ đã chọn" action={{ label: 'Xem tất cả', href: destination.hr }}>
    <div className="space-y-5">{rows.map((row, index) => {
      const percent = hr.tasks.total > 0 ? Math.min(100, row.value / hr.tasks.total * 100) : 0;
      return <div key={row.label}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-on-surface-variant">{row.label}</span><strong className="font-semibold tabular-nums">{count(row.value)} việc</strong></div><div role="progressbar" aria-label={row.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={count(row.value) + ' trên ' + count(hr.tasks.total) + ' công việc'} className="h-2 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full" style={{ width: percent + '%', background: DASHBOARD_CHART_PALETTE[index % DASHBOARD_CHART_PALETTE.length] }} /></div></div>;
    })}</div>
    <p className="mt-5 border-t border-outline-variant pt-3 text-pretty text-xs text-on-surface-variant">Tổng <strong className="font-medium tabular-nums text-on-surface">{count(hr.tasks.total)}</strong> công việc trong kỳ.</p>
  </Panel>;
}

function AttendancePanel({ hr }: { hr: NonNullable<BusinessOverview['hr']> }) {
  const rows = [{ label: 'Có mặt', value: hr.checkedIn }, { label: 'Đi muộn', value: hr.late }, { label: 'Nghỉ có phép', value: hr.approvedLeave }, { label: 'Chưa chấm công, chưa có phép', value: hr.absent }];
  return <Panel title="Tổng hợp chấm công" description="Số liệu hôm nay trong phạm vi đang xem" action={{ label: 'Xem tất cả', href: destination.attendance }}>
    <dl className="grid grid-cols-2 gap-3">{rows.map(row => <div key={row.label} className="rounded-xl bg-surface p-4"><dt className="min-h-8 text-pretty text-xs text-on-surface-variant">{row.label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{row.value == null ? '—' : count(row.value)}</dd></div>)}</dl>
  </Panel>;
}

export function BusinessOverviewDashboard({ data: input, loading, businessType, onRetry }: { data: BusinessOverview | null; loading: boolean; businessType: 'education' | 'labor'; onRetry: () => void }) {
  if (loading) return <div role="status" aria-label="Đang tải tổng quan doanh nghiệp" className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">{[0, 1, 2, 3, 4].map(value => <div key={value} className={cn(card, 'min-h-32')}><div className="h-5 w-1/2 rounded bg-surface-container" /><div className="mt-3 h-8 w-2/3 rounded bg-surface-container" /></div>)}</div><div className="grid gap-4 xl:grid-cols-3">{[0, 1, 2].map(value => <div key={value} className={cn(card, 'min-h-96')} />)}</div><span className="sr-only">Đang tải số liệu, vui lòng chờ.</span></div>;
  if (!input) return null;
  const view = businessOverviewPresentation(input, businessType);
  const { data, education, labor, retail, metrics, operations, alerts } = view;
  const primary = education || labor || retail;
  const isLabor = Boolean(labor);
  const isRetail = Boolean(retail);
  const hasPeople = Boolean(education || labor);
  const extraRetail = !isRetail && data.retail;
  const detailCount = Number(hasPeople) + Number(operations.length > 0) + Number(Boolean(extraRetail));
  const hasAlerts = alerts.length > 0;
  const hasAttendance = data.hr?.checkedIn != null;
  return <div className="space-y-5">
    {data.errors.length > 0 && <div role="alert" className={cn(card, 'flex flex-wrap items-center justify-between gap-3')}><div><p className="text-pretty text-sm">Chưa tải được: {data.errors.map(key => sectionLabels[key]).join(', ')}. Các khối khác vẫn được hiển thị.</p>{data.errors.includes('retail') && (Date.parse(data.range.to) - Date.parse(data.range.from)) / 86400000 + 1 > 366 && <p className="mt-1 text-pretty text-xs text-on-surface-variant">Báo cáo bán hàng hỗ trợ tối đa 366 ngày. Chọn khoảng thời gian ngắn hơn để xem khối này.</p>}</div><button type="button" className={button} onClick={onRetry}>Thử lại</button></div>}
    {metrics.length > 0 && <MetricGrid metrics={metrics} label="Chỉ số chính" />}
    {!primary && !metrics.length && !data.errors.length && <div className={cn(card, 'flex items-start gap-3')}><CircleHelp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-pretty text-sm text-on-surface-variant">Chưa có module được bật và cấp quyền để hiển thị số liệu tổng quan. Liên hệ quản trị doanh nghiệp để kiểm tra quyền truy cập.</p></div>}
    {(primary || alerts.length > 0) && <section aria-label="Phân tích và cảnh báo" className="grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-12">
      {primary && <>
        <div className={cn('min-w-0', hasAlerts ? 'lg:col-span-2 xl:col-span-5' : 'xl:col-span-7')}><Panel title={isRetail ? 'Tổng quan doanh số bán hàng' : isLabor ? 'Hồ sơ lao động tạo mới' : 'Tổng quan học phí thực thu'} description={isRetail ? 'Số liệu POS trong kỳ, sau giảm giá và hoàn trả.' : isLabor ? 'Số hồ sơ được tạo theo thời gian trong kỳ đã chọn.' : 'Giao dịch thu học phí theo ngày thu tiền trong kỳ đã chọn.'} className="min-h-96"><Trend points={primary.series} from={data.range.from} to={data.range.to} currency={!isLabor} label={isRetail ? 'Doanh số bán hàng' : undefined} /></Panel></div>
        <div className={cn('min-w-0', hasAlerts ? 'xl:col-span-4' : 'xl:col-span-5')}><Panel title={isRetail ? 'Sản phẩm bán chạy' : isLabor ? 'Cơ cấu lao động' : 'Tình hình lớp học'} description={isRetail ? 'Top 5 và nhóm khác · giá trị sản phẩm theo báo cáo POS' : 'Trạng thái hiện tại trong phạm vi đang xem'} className="min-h-96">{retail ? <ProductDistribution retail={retail} /> : <Distribution rows={isLabor ? labor!.statuses : education!.classes} />}</Panel></div>
      </>}
      {hasAlerts && <div className={cn('min-w-0', primary ? 'xl:col-span-3' : 'lg:col-span-2 xl:col-span-12')}><AlertPanel rows={alerts} failed={data.errors.length > 0} onRetry={onRetry} /></div>}
    </section>}
    {data.hr && <section aria-label="Điều hành nhân sự" className={cn('grid items-stretch gap-4 lg:grid-cols-2', hasAttendance && 'xl:grid-cols-3')}><ContractPanel hr={data.hr} /><TaskProgressPanel hr={data.hr} />{hasAttendance && <AttendancePanel hr={data.hr} />}</section>}
    {detailCount > 0 && <div className={cn('grid items-start gap-4', detailCount === 2 && 'xl:grid-cols-2', detailCount === 3 && 'xl:grid-cols-3')}>
      {hasPeople && <Panel title={isLabor ? 'Dự án cần theo dõi' : 'Lớp học đang triển khai'}
        description={isLabor ? count(labor!.activeWorkers) + ' lao động hoạt động · ' + count(labor!.placedWorkers) + ' đã bố trí' : count(education!.students) + ' học viên · ' + count(education!.newStudents) + ' hồ sơ mới trong kỳ · ' + count(education!.unpaidStudents) + ' còn kỳ học phí chưa thu'}
        action={{ label: 'Xem tất cả', href: isLabor ? destination.projects : destination.classes }}><Projects rows={isLabor ? labor!.topProjects : education!.topClasses} href={isLabor ? destination.projects : destination.classes} labor={isLabor} /></Panel>}
      {operations.length > 0 && <Panel title="Các module đang hoạt động" description="Chỉ hiển thị module được bật và bạn có quyền xem"><OperationList metrics={operations} /></Panel>}
      {extraRetail && <Panel title="Sản phẩm bán chạy" description="Top 5 và nhóm khác · số liệu riêng từ POS" action={{ label: 'Mở bán hàng', href: destination.retail }}><ProductDistribution retail={extraRetail} /></Panel>}
    </div>}
  </div>;
}
