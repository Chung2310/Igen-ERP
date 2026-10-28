import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { customerApi } from '../customerApi';
import { withRequestTimeout } from '../../../utils/requestTimeout';
import type { CustomerTransactionFilter, CustomerTransactionRow, CustomerTransactionsResult } from '../../../../shared/customer-transactions';

const DetailDialog = lazy(() => import('./CustomerTransactionDetailDialog'));
const money = (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`;
const kindLabels: Record<CustomerTransactionRow['kind'], string> = { sale: 'Mua hàng', repair: 'Sửa chữa / dịch vụ', sale_refund: 'Hoàn tiền mua hàng', repair_refund: 'Hoàn tiền sửa chữa', buyback: 'Thu mua lại' };
const statuses: Record<string, string> = { draft: 'Nháp', confirmed: 'Đã xác nhận', completed: 'Hoàn tất', cancelled: 'Đã hủy', received: 'Tiếp nhận', diagnosing: 'Kiểm tra', quoted: 'Báo giá', approved: 'Đã duyệt', repairing: 'Đang thực hiện', waiting_parts: 'Chờ vật tư', waiting_supplier: 'Chờ nhà cung cấp', done: 'Hoàn tất', delivered: 'Đã bàn giao', returned: 'Đã trả lại', posted: 'Đã ghi sổ' };
const field = 'mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary';
const button = 'min-h-11 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
const valueLabel = (row: CustomerTransactionRow) => `${row.kind.endsWith('_refund') || row.kind === 'buyback' ? '−' : ''}${money(row.amount)}`;

export default function CustomerTransactionsPanel({ customerId, companyCode, branchId }: { customerId: string; companyCode: string; branchId?: string }) {
  if (!branchId) return <p role="status" className="text-sm text-on-surface-variant">Chọn chi nhánh để xem lịch sử giao dịch.</p>;
  return <Transactions key={`${companyCode}:${branchId}:${customerId}`} customerId={customerId} companyCode={companyCode} branchId={branchId} />;
}
function Transactions({ customerId, companyCode, branchId }: { customerId: string; companyCode: string; branchId: string }) {
  const [filters, setFilters] = useState<{ type: CustomerTransactionFilter; from: string; to: string }>({ type: 'all', from: '', to: '' });
  const [query, setQuery] = useState({ ...filters, page: 1, limit: 20 });
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; data?: CustomerTransactionsResult; error?: string } | null>(null);
  const [selected, setSelected] = useState<CustomerTransactionRow | null>(null);
  const requestKey = JSON.stringify([query, retry]);
  const loading = loaded?.key !== requestKey;
  const data = !loading ? loaded?.data : undefined;
  useEffect(() => {
    const controller = new AbortController();
    void withRequestTimeout((signal) => customerApi.transactions(customerId, { companyCode, branchId }, query, signal), 20000, 'Tải lịch sử giao dịch quá lâu. Hãy thử lại.', controller.signal)
      .then((result) => { if (!controller.signal.aborted) setLoaded({ key: requestKey, data: result }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLoaded({ key: requestKey, error: cause instanceof Error ? cause.message : 'Không tải được lịch sử giao dịch.' }); });
    return () => controller.abort();
  }, [customerId, companyCode, branchId, query, requestKey]);
  function submit(event: FormEvent) { event.preventDefault(); setSelected(null); setQuery({ ...filters, page: 1, limit: 20 }); setRetry((value) => value + 1); }
  return <section aria-label="Lịch sử giao dịch khách hàng" aria-busy={loading} className="space-y-4 text-on-surface [--color-on-surface-variant:var(--color-slate-600)]">
    <div><h2 className="text-balance text-lg font-semibold">Lịch sử giao dịch</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Mua hàng, sửa chữa và các khoản hoàn tại chi nhánh đang chọn. Mở từng giao dịch để xem chi tiết.</p></div>
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
      <label className="text-sm font-medium">Loại giao dịch<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as CustomerTransactionFilter })} className={field}><option value="all">Tất cả giao dịch</option><option value="sale">Mua hàng</option>{data?.repairsVisible !== false && <option value="repair">Sửa chữa / dịch vụ</option>}<option value="refund">Hoàn tiền</option><option value="buyback">Thu mua lại</option></select></label>
      <label className="text-sm font-medium">Từ ngày<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className={field} /></label>
      <label className="text-sm font-medium">Đến ngày<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className={field} /></label>
      <button type="submit" className={`${button} border-primary bg-primary text-on-primary`}>Xem giao dịch</button>
    </form>
    {loading && <p role="status" className="rounded-xl bg-surface-container-low p-4 text-sm">Đang tải lịch sử giao dịch…</p>}
    {!loading && loaded?.error && <div className="space-y-3 rounded-xl border border-error p-4"><p role="alert" className="text-pretty text-sm text-error">{loaded.error}</p><button type="button" className={button} onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div>}
    {data && <>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[['Giá trị đã ghi nhận', data.summary.charged], ['Đã thu', data.summary.received], ['Đã hoàn', data.summary.refunded], ['Còn phải thu', data.summary.outstanding]].map(([label, amount]) => <div key={label} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3 sm:p-4"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 break-words text-base font-semibold tabular-nums sm:text-lg">{money(Number(amount))}</dd></div>)}</dl>
      <p className="text-pretty text-xs text-on-surface-variant">Số tổng theo bộ lọc. Phiếu nháp và phiếu hủy không cộng vào giá trị bán/dịch vụ. Khoản hoàn được ghi riêng, không xóa số tiền gốc.{data.summary.buybackPaid ? ` Đã chi thu mua: ${money(data.summary.buybackPaid)}.` : ''}{!data.repairsVisible ? ' Tài khoản hiện chưa có quyền xem giao dịch sửa chữa.' : ''}</p>
      {data.items.length ? <>
        <ul className="space-y-3 md:hidden">{data.items.map((row) => <li key={row.id} className="space-y-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-on-surface-variant">{kindLabels[row.kind]}</p><p className="mt-1 break-words font-semibold">{row.code}</p></div><span className="shrink-0 font-semibold tabular-nums">{valueLabel(row)}</span></div><p className="break-words text-pretty text-sm text-on-surface-variant">{row.description}</p><p className="text-xs text-on-surface-variant">{new Date(row.occurredAt).toLocaleDateString('vi-VN')} · {statuses[row.status] || row.status}</p><button type="button" onClick={() => setSelected(row)} className={button} aria-label={`Xem ${row.code} ${kindLabels[row.kind]}`}>Xem chi tiết</button></li>)}</ul>
        <div className="hidden overflow-x-auto rounded-xl border border-outline-variant md:block"><table className="w-full min-w-2xl text-left text-sm"><caption className="sr-only">Các giao dịch của khách hàng</caption><thead className="bg-surface-container"><tr>{['Ngày', 'Loại / chứng từ', 'Nội dung', 'Giá trị', 'Trạng thái', 'Chi tiết'].map((label) => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{data.items.map((row) => <tr key={row.id} className="border-t border-outline-variant bg-surface-container-lowest"><td className="whitespace-nowrap p-3 tabular-nums">{new Date(row.occurredAt).toLocaleDateString('vi-VN')}</td><td className="p-3"><p className="font-medium">{row.code}</p><p className="mt-1 text-xs text-on-surface-variant">{kindLabels[row.kind]}</p></td><td className="max-w-xs break-words p-3 text-on-surface-variant">{row.description}</td><td className="whitespace-nowrap p-3 font-medium tabular-nums">{valueLabel(row)}</td><td className="p-3">{statuses[row.status] || row.status}</td><td className="p-3"><button type="button" onClick={() => setSelected(row)} aria-label={`Xem ${row.code} ${kindLabels[row.kind]}`} className={button}>Xem</button></td></tr>)}</tbody></table></div>
      </> : <div className="space-y-3 rounded-xl border border-dashed border-outline-variant p-6 text-center"><p className="text-pretty text-sm text-on-surface-variant">Chưa có giao dịch phù hợp với bộ lọc.</p><button type="button" className={button} onClick={() => { setFilters({ type: 'all', from: '', to: '' }); setQuery({ type: 'all', from: '', to: '', page: 1, limit: 20 }); }}>Xem tất cả</button></div>}
      {data.total > data.limit && <nav aria-label="Phân trang giao dịch" className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm tabular-nums">Trang {data.page} / {Math.ceil(data.total / data.limit)} · {data.total} giao dịch</span><div className="flex gap-2"><button type="button" disabled={query.page <= 1} className={button} onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))}>Trước</button><button type="button" disabled={query.page * query.limit >= data.total} className={button} onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}>Sau</button></div></nav>}
    </>}
    {selected && <Suspense fallback={<p role="status">Đang mở chi tiết…</p>}><DetailDialog row={selected} customerId={customerId} companyCode={companyCode} branchId={branchId} onClose={() => setSelected(null)} /></Suspense>}
  </section>;
}
