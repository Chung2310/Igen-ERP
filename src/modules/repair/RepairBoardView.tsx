import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { StyledSelect } from '../../components/common/StyledSelect';
import { TablePagination } from '../../components/common/TablePagination';
import type { RepairStatus, RepairTicket } from '../../services/repairService';
import { cn } from '../student-management/lib/utils';
import './repair-board-view.css';
import { repairSubjectKey, repairSubjectLabels } from './repairPresentation';

type Stage = { key: string; label: string; shortLabel: string; description: string; tip: string; statuses: RepairStatus[]; color: string };
const stages: Stage[] = [
  { key: 'received', label: '1. Tiếp nhận', shortLabel: '1. Tiếp nhận', description: 'Sản phẩm, thiết bị hoặc hạng mục mới tiếp nhận', tip: 'Phân công kỹ thuật viên kiểm tra', statuses: ['received'], color: 'border-blue-200 bg-blue-50 text-blue-700' },
  { key: 'diagnosing', label: '2. Kiểm tra / đánh giá', shortLabel: '2. Kiểm tra', description: 'Kỹ thuật viên đang kiểm tra và chẩn đoán', tip: 'Nhập báo giá để gửi khách hàng', statuses: ['diagnosing'], color: 'border-amber-200 bg-amber-50 text-amber-800' },
  { key: 'quoted', label: '3. Báo giá chờ duyệt', shortLabel: '3. Báo giá', description: 'Đã có giá, chờ khách hàng xác nhận', tip: 'Duyệt báo giá khi khách hàng đồng ý', statuses: ['quoted'], color: 'border-purple-200 bg-purple-50/60 text-purple-800' },
  { key: 'repairing', label: '4. Đang thực hiện', shortLabel: '4. Đang xử lý', description: 'Đã duyệt hoặc đang thực hiện kỹ thuật', tip: 'Hoàn tất công việc để chuyển sang chờ giao', statuses: ['approved', 'repairing'], color: 'border-violet-200 bg-violet-50 text-violet-800' },
  { key: 'waiting', label: '5. Chờ vật tư / NCC', shortLabel: '5. Chờ vật tư', description: 'Đang chờ vật tư hoặc nhà cung cấp hỗ trợ', tip: 'Có vật tư hoặc kết quả từ NCC thì tiếp tục xử lý', statuses: ['waiting_parts', 'waiting_supplier'], color: 'border-orange-200 bg-orange-50 text-orange-800' },
  { key: 'done', label: '6. Chờ bàn giao', shortLabel: '6. Chờ bàn giao', description: 'Đã hoàn tất, chờ thanh toán và bàn giao', tip: 'Kiểm tra thanh toán trước khi bàn giao', statuses: ['done'], color: 'border-blue-200 bg-blue-50 text-blue-700' },
  { key: 'delivered', label: '7. Đã bàn giao', shortLabel: '7. Đã bàn giao', description: 'Đã bàn giao cho khách hàng', tip: 'Xem lịch sử và hỗ trợ sau bàn giao', statuses: ['delivered'], color: 'border-teal-200 bg-teal-50 text-teal-800' },
];
type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month';
const datePresets: { value: DateFilter; label: string }[] = [{ value: 'all', label: 'Tất cả ngày' }, { value: 'today', label: 'Hôm nay' }, { value: 'yesterday', label: 'Hôm qua' }, { value: 'week', label: '7 ngày qua' }, { value: 'month', label: 'Tháng này' }];
const outlineButton = 'min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40';
const segment = 'min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
function dayKey(value: Date) {
  if (!Number.isFinite(value.getTime())) return '';
  const parts = dayFormatter.formatToParts(value);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
function matchesDate(ticket: RepairTicket, filter: DateFilter, history: boolean) {
  if (filter === 'all') return true;
  const date = dayKey(new Date((history ? ticket.deliveredAt : ticket.receivedAt) || ticket.completedAt || ticket.receivedAt));
  if (!date) return false;
  const today = dayKey(new Date());
  const [year, month, day] = today.split('-').map(Number);
  const previous = (offset: number) => new Date(Date.UTC(year, month - 1, day - offset)).toISOString().slice(0, 10);
  if (filter === 'today') return date === today;
  if (filter === 'yesterday') return date === previous(1);
  return date >= (filter === 'week' ? previous(6) : today.slice(0, 7) + '-01') && date <= today;
}
const ticketKind = (ticket: RepairTicket) => ticket.ticketType || (ticket.coverage.customer.covered || ticket.coverage.supplier.covered || ['shop', 'supplier'].includes(ticket.coverage.costBearer) ? 'warranty' : 'service');
const technicianKey = (ticket: RepairTicket) => ticket.technicianId ? `id:${ticket.technicianId}` : ticket.technicianName?.trim() ? `name:${ticket.technicianName.trim()}` : 'unassigned';

function RepairStage({ stage, tickets, renderTicket, onHistory }: { stage: Stage; tickets: RepairTicket[]; renderTicket: (ticket: RepairTicket) => ReactNode; onHistory: () => void }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tickets.length / 8));
  const currentPage = Math.min(page, totalPages);
  return <section aria-label={stage.label} className="flex min-h-72 w-[335px] shrink-0 flex-col rounded-3xl border border-outline-variant bg-slate-100/60 p-4 shadow-xs sm:w-[365px]">
    <header className="mb-5 px-1"><div className="flex items-center justify-between gap-2"><h2 className="text-balance text-sm font-semibold">{stage.label}</h2><span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums', stage.color)}>{tickets.length} phiếu</span></div><p className="mt-1 text-pretty text-xs text-on-surface-variant">{stage.description}</p></header>
    {tickets.length ? <div className="flex flex-1 flex-col gap-3"><div className="space-y-3">{tickets.slice((currentPage - 1) * 8, currentPage * 8).map(ticket => <div key={ticket._id}>{renderTicket(ticket)}</div>)}</div>{totalPages > 1 && <div className="mt-auto flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-2 text-xs tabular-nums"><button type="button" aria-label={`Trang trước: ${stage.label}`} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className={outlineButton}><ChevronLeft aria-hidden="true" className="size-4" /></button><span>{currentPage} / {totalPages}</span><button type="button" aria-label={`Trang sau: ${stage.label}`} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className={outlineButton}><ChevronRight aria-hidden="true" className="size-4" /></button></div>}{stage.key === 'delivered' && <button type="button" onClick={onHistory} className={cn(outlineButton, 'mt-auto text-primary')}>Xem toàn bộ lịch sử ({tickets.length})</button>}</div> : <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest/50 p-5 text-center text-sm text-on-surface-variant"><p className="text-pretty font-medium">Chưa có phiếu ở bước này</p><p className="text-pretty text-xs">{stage.tip}</p></div>}
  </section>;
}

interface Props {
  board: Partial<Record<RepairStatus, RepairTicket[]>>;
  loading: boolean;
  error: string;
  onRetry: () => void;
  intakeAction: ReactNode;
  renderTicket: (ticket: RepairTicket) => ReactNode;
  onSelect: (ticket: RepairTicket) => void;
}

/** The retail repair workspace, with ERP's detailed statuses grouped into seven visual steps. */
export default function RepairBoardView({ board, loading, error, onRetry, intakeAction, renderTicket, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [source, setSource] = useState('all');
  const [subject, setSubject] = useState('all');
  const [technician, setTechnician] = useState('all');
  const [stageFilter, setStageFilter] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [history, setHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const scroller = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState({ left: false, right: false });
  const allTickets = stages.flatMap(stage => stage.statuses.flatMap(status => board[status] || []));
  const needle = query.trim().toLocaleLowerCase('vi-VN');
  const filtered = allTickets.filter(ticket => (!needle || [ticket.ticketCode, ticket.customerName, ticket.customerPhone, ticket.customerCode, ticket.device.name, ticket.device.serialNumber, ticket.device.imei, ticket.technicianName].some(value => value?.toLocaleLowerCase('vi-VN').includes(needle))) && (source === 'all' || ticketKind(ticket) === source) && (subject === 'all' || repairSubjectKey(ticket) === subject) && (technician === 'all' || technicianKey(ticket) === technician) && matchesDate(ticket, dateFilter, history));
  const counts = stages.map(stage => ({ ...stage, tickets: filtered.filter(ticket => stage.statuses.includes(ticket.status)) }));
  const activeCount = counts.filter(stage => stage.key !== 'delivered').reduce((total, stage) => total + stage.tickets.length, 0);
  const delivered = counts.find(stage => stage.key === 'delivered')?.tickets || [];
  const visibleStages = counts.filter(stage => (!stageFilter || stageFilter === stage.key) && (!hideEmpty || stage.tickets.length));
  const totalPages = Math.max(1, Math.ceil(delivered.length / pageSize));
  const currentPage = Math.min(historyPage, totalPages);
  const technicians = new Map(allTickets.filter(ticket => technicianKey(ticket) !== 'unassigned').map(ticket => [technicianKey(ticket), ticket.technicianName || ticket.technicianId || 'Kỹ thuật viên']));
  const hasFilters = Boolean(query || dateFilter !== 'all' || source !== 'all' || subject !== 'all' || technician !== 'all' || stageFilter);
  const resetFilters = () => { setQuery(''); setDateFilter('all'); setSource('all'); setSubject('all'); setTechnician('all'); setStageFilter(''); setHideEmpty(false); setHistoryPage(1); };
  const updateArrows = () => { const element = scroller.current; if (element) setArrows({ left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 }); };
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => setArrows({ left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 });
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => observer?.disconnect();
  }, [history, hideEmpty, stageFilter, loading]);

  return <div className="repair-board-view min-w-0 space-y-4 text-on-surface [--color-on-surface-variant:var(--color-slate-600)]">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-balance text-xl font-semibold sm:text-2xl">Quản lý bảo hành & sửa chữa</h1><span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-xs font-medium tabular-nums">{loading ? 'Đang tải…' : `${activeCount} phiếu đang xử lý`}</span></div><p className="mt-1 text-pretty text-sm text-on-surface-variant">Phân tách: <strong className="font-medium">Bảo hành</strong> và <strong className="font-medium">Sửa chữa dịch vụ</strong> cho sản phẩm, thiết bị và hạng mục.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" aria-pressed={history} onClick={() => { setHistory(!history); setStageFilter(''); setHistoryPage(1); }} className={cn(outlineButton, history && 'border-primary bg-primary/10 text-primary')}>Lịch sử bàn giao ({loading ? '—' : delivered.length})</button>{intakeAction}</div></header>

    <div role="group" aria-label="Lọc theo bước xử lý" className="flex flex-wrap gap-2"><button type="button" aria-pressed={!stageFilter && !history} onClick={() => { setStageFilter(''); setHistory(false); }} className={cn('inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary', !stageFilter && !history ? 'border-inverse-surface bg-inverse-surface text-inverse-on-surface' : 'border-outline-variant bg-surface-container-lowest')}>Tất cả <span className="rounded-full bg-current/10 px-1.5 text-xs tabular-nums">{loading ? '—' : activeCount}</span></button>{counts.map(stage => <button key={stage.key} type="button" aria-pressed={stageFilter === stage.key && !history} onClick={() => { setHistory(false); setStageFilter(stageFilter === stage.key ? '' : stage.key); }} className={cn('inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary', stage.color, stageFilter === stage.key && !history && 'ring-2 ring-current ring-offset-2 ring-offset-surface')}><span>{stage.shortLabel}</span><span className="rounded-full bg-current/10 px-1.5 text-xs tabular-nums">{loading ? '—' : stage.tickets.length}</span></button>)}</div>

    <section aria-label="Bộ lọc phiếu sửa chữa" className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 shadow-xs"><div className="flex flex-wrap items-center gap-2"><div className="relative w-full min-w-0 sm:max-w-sm sm:flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-on-surface-variant" /><input type="search" aria-label="Tìm phiếu sửa chữa" placeholder="Tìm mã phiếu, khách hàng, mã định danh..." value={query} onChange={event => { setQuery(event.target.value); setHistoryPage(1); }} className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-10 text-sm focus-visible:outline-2 focus-visible:outline-primary" />{query && <button type="button" aria-label="Xóa tìm kiếm phiếu" onClick={() => { setQuery(''); setHistoryPage(1); }} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl focus-visible:outline-2 focus-visible:outline-primary"><X aria-hidden="true" className="size-4" /></button>}</div><div role="group" aria-label="Lọc theo ngày" className="flex max-w-full flex-wrap gap-1 rounded-xl bg-surface-container p-1">{datePresets.map(preset => <button key={preset.value} type="button" aria-pressed={dateFilter === preset.value} onClick={() => { setDateFilter(preset.value); setHistoryPage(1); }} className={cn(segment, dateFilter === preset.value ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-lowest/50')}>{preset.label}</button>)}</div></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-3"><div className="flex max-w-full flex-wrap items-center gap-2"><div role="group" aria-label="Lọc loại phiếu" className="flex flex-wrap gap-1 rounded-xl bg-surface-container p-1">{[{ value: 'all', label: 'Tất cả loại phiếu' }, { value: 'warranty', label: 'Bảo hành' }, { value: 'service', label: 'Sửa chữa' }].map(option => <button type="button" key={option.value} aria-pressed={source === option.value} onClick={() => { setSource(option.value); setHistoryPage(1); }} className={cn(segment, source === option.value ? 'bg-surface-container-lowest text-on-surface shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-lowest/50')}>{option.label}</button>)}</div><div className="w-full min-w-0 sm:w-48"><StyledSelect ariaLabel="Lọc loại đối tượng" value={subject} onChange={value => { setSubject(value); setHistoryPage(1); }} options={[{ value: 'all', label: 'Tất cả đối tượng' }, ...Object.entries(repairSubjectLabels).map(([value, label]) => ({ value, label })), { value: 'unrecorded', label: 'Chưa phân loại' }]} /></div><div className="w-full min-w-0 sm:w-56"><StyledSelect ariaLabel="Lọc theo kỹ thuật viên" value={technician} onChange={value => { setTechnician(value); setHistoryPage(1); }} options={[{ value: 'all', label: 'Tất cả kỹ thuật viên' }, { value: 'unassigned', label: 'Chưa phân công' }, ...Array.from(technicians, ([value, label]) => ({ value, label }))]} /></div>{hasFilters && <button type="button" onClick={resetFilters} className="min-h-11 rounded-xl px-3 text-sm font-medium text-error hover:underline focus-visible:outline-2 focus-visible:outline-primary">Xóa bộ lọc</button>}</div>{!history && <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface-variant"><input type="checkbox" checked={hideEmpty} onChange={event => setHideEmpty(event.target.checked)} className="size-4 accent-primary" />Ẩn bước trống</label>}</div>
    </section>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container"><p className="text-pretty">{error}</p><button type="button" disabled={loading} onClick={onRetry} className={outlineButton}>Thử lại</button></div>}
    {loading && <div role="status" className="space-y-3"><p className="text-sm text-on-surface-variant">Đang tải phiếu sửa chữa…</p><div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-64 rounded-3xl border border-outline-variant bg-surface-container" />)}</div></div>}

    {!history && <div className={cn('relative', loading && 'hidden')}><button type="button" aria-label="Cuộn sang trái" disabled={!arrows.left} onClick={() => scroller.current?.scrollBy({ left: -385, behavior: 'auto' })} className="absolute -left-3 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30 sm:flex"><ChevronLeft aria-hidden="true" className="size-6" /></button>
      <div ref={scroller} onScroll={updateArrows} data-testid="repair-board-scroll" tabIndex={0} role="region" aria-label="Bảng các bước sửa chữa, cuộn ngang để xem thêm" className="-mx-4 overflow-x-auto px-4 pb-3 focus-visible:outline-2 focus-visible:outline-primary sm:mx-0 sm:px-0"><div className={cn('flex items-stretch gap-4', visibleStages.length > 3 && 'min-w-[1250px]')}>{visibleStages.map(stage => <RepairStage key={`${stage.key}:${query}:${dateFilter}:${source}:${subject}:${technician}`} stage={stage} tickets={stage.tickets} renderTicket={renderTicket} onHistory={() => { setHistory(true); setStageFilter(''); setHistoryPage(1); }} />)}</div></div>
      <button type="button" aria-label="Cuộn sang phải" disabled={!arrows.right} onClick={() => scroller.current?.scrollBy({ left: 385, behavior: 'auto' })} className="absolute -right-3 top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-30 sm:flex"><ChevronRight aria-hidden="true" className="size-6" /></button>
      {!visibleStages.length && !error && <div role="status" className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center"><p className="text-pretty text-sm text-on-surface-variant">Không có phiếu phù hợp với bộ lọc.</p><button type="button" onClick={resetFilters} className={cn(outlineButton, 'mt-3')}>Xóa bộ lọc</button></div>}
    </div>}
    {history && !loading && <section aria-labelledby="repair-delivered-title" className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant p-4"><div><h2 id="repair-delivered-title" className="text-balance font-semibold">Lịch sử đã bàn giao</h2><p className="mt-1 text-pretty text-xs text-on-surface-variant">Lọc theo ngày bàn giao; mở phiếu để xem chi tiết và hoàn tiền.</p></div><button type="button" onClick={() => setHistory(false)} className={outlineButton}>Quay lại bảng xử lý</button></header>{delivered.length ? <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Các phiếu sửa chữa đã bàn giao</caption><thead className="bg-surface text-xs text-on-surface-variant"><tr>{['Mã phiếu', 'Khách hàng', 'Sản phẩm / hạng mục', 'Kỹ thuật viên', 'Ngày bàn giao', 'Tổng tiền'].map(label => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant">{delivered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(ticket => <tr key={ticket._id}><td className="p-3"><button type="button" onClick={() => onSelect(ticket)} className="min-h-11 rounded-lg font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">{ticket.ticketCode}</button></td><td className="max-w-52 break-words p-3">{ticket.customerName}</td><td className="max-w-64 break-words p-3">{ticket.device.name}</td><td className="p-3">{ticket.technicianName || '—'}</td><td className="p-3 tabular-nums">{ticket.deliveredAt ? new Date(ticket.deliveredAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận'}</td><td className="whitespace-nowrap p-3 font-medium tabular-nums">{Number(ticket.totalAmount || 0).toLocaleString('vi-VN')} ₫</td></tr>)}</tbody></table></div><TablePagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} totalItems={delivered.length} onPageChange={setHistoryPage} onPageSizeChange={value => { setPageSize(value); setHistoryPage(1); }} itemLabel="phiếu" /></> : <p role="status" className="p-8 text-center text-pretty text-sm text-on-surface-variant">Chưa có phiếu đã bàn giao phù hợp.</p>}</section>}
  </div>;
}
