import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, History, PackageCheck, RefreshCw } from 'lucide-react';
import { Pagination } from '../../../../components/common/Pagination';
import { getAiSubscriptionHistory, formatAiPlanPrice, type AiSubscriptionHistory as HistoryData } from '../../../../services/aiSubscriptionService';

const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AiSubscriptionHistory({ enabled, refreshKey }: { enabled: boolean; refreshKey: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const requestKey = JSON.stringify([refreshKey, page, retry]);
  const [result, setResult] = useState<{ key: string; data?: HistoryData; error?: string } | null>(null);
  const loading = !enabled || result?.key !== requestKey;
  const data = result?.key === requestKey ? result.data : undefined;
  const error = result?.key === requestKey ? result.error : '';
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getAiSubscriptionHistory(page, controller.signal).then(data => { if (!controller.signal.aborted) setResult({ key: requestKey, data }); })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key: requestKey, error: cause instanceof Error ? cause.message : 'Không thể tải lịch sử giao dịch.' }); });
    return () => controller.abort();
  }, [enabled, requestKey, page]);

  return <section className="ai-subscription-panel overflow-hidden" aria-labelledby="ai_history_title" aria-busy={loading}>
    <header className="border-b border-outline-variant px-4 py-4 sm:px-5"><h2 ref={heading} tabIndex={-1} id="ai_history_title" className="flex items-center gap-2 text-balance text-base font-semibold focus-visible:outline-2 focus-visible:outline-primary"><History className="size-4 text-primary" aria-hidden="true" />Lịch sử giao dịch</h2></header>
    {loading ? <div role="status" className="space-y-3 p-4"><p className="sr-only">Đang tải lịch sử giao dịch…</p>{[0, 1, 2].map(row => <div key={row} aria-hidden="true" className="ai-subscription-skeleton h-12 rounded-lg" />)}</div> : error ? <div role="alert" className="flex items-start gap-3 p-5 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" /><div><p className="text-pretty text-error">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="ai-subscription-back mt-1"><RefreshCw className="size-4" aria-hidden="true" />Tải lại lịch sử</button></div></div> : !data?.items.length ? <div className="px-5 py-10 text-center"><History className="mx-auto size-7 text-on-surface-variant" aria-hidden="true" /><h3 className="mt-3 text-balance text-sm font-semibold">Chưa có giao dịch gói AI</h3><p className="mt-2 text-pretty text-sm text-on-surface-variant">Lịch sử sẽ xuất hiện sau khi doanh nghiệp được cấp gói.</p></div> : <>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[700px] text-left text-sm">
        <caption className="sr-only">Lịch sử mua, nâng cấp và hết hạn gói AI</caption>
        <thead className="bg-surface text-xs text-on-surface-variant"><tr><th scope="col" className="whitespace-nowrap px-5 py-3 font-medium">Thời gian</th><th scope="col" className="px-4 py-3 font-medium">Giao dịch</th><th scope="col" className="px-4 py-3 font-medium">Gói dịch vụ</th><th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-medium">Lượt AI</th><th scope="col" className="whitespace-nowrap px-5 py-3 text-right font-medium">Giá gói</th></tr></thead>
        <tbody className="divide-y divide-outline-variant">{data.items.map(item => <tr key={item.id} className="hover:bg-surface">
          <td className="whitespace-nowrap px-5 py-3 text-xs tabular-nums text-on-surface-variant"><time dateTime={item.occurredAt}>{date(item.occurredAt)}</time></td>
          <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium">{item.type === 'purchase' ? <PackageCheck className="size-4 text-primary" aria-hidden="true" /> : <CalendarClock className="size-4 text-on-surface-variant" aria-hidden="true" />}{item.type === 'purchase' ? 'Mua / nâng cấp gói' : 'Hết hạn gói'}</span></td>
          <td className="max-w-64 break-words px-4 py-3 font-medium">{item.planName}</td>
          <td className="px-4 py-3 text-right tabular-nums">{item.aiUnits == null ? '—' : '+' + item.aiUnits.toLocaleString('vi-VN')}</td>
          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">{item.type === 'expired' ? '—' : item.priceVnd == null ? 'Chưa ghi nhận' : formatAiPlanPrice(item.priceVnd)}</td>
        </tr>)}</tbody>
      </table></div>
      <ul aria-label="Giao dịch gói AI" className="divide-y divide-outline-variant lg:hidden">{data.items.map(item => <li key={item.id} className="space-y-2 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3"><p className="flex min-w-0 items-center gap-1.5 text-xs font-medium">{item.type === 'purchase' ? <PackageCheck className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <CalendarClock className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />}{item.type === 'purchase' ? 'Mua / nâng cấp gói' : 'Hết hạn gói'}</p><time dateTime={item.occurredAt} className="shrink-0 text-xs tabular-nums text-on-surface-variant">{date(item.occurredAt)}</time></div>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.planName}</p>{item.aiUnits != null && <p className="mt-1 text-xs tabular-nums text-on-surface-variant">+{item.aiUnits.toLocaleString('vi-VN')} lượt AI</p>}</div>{item.type === 'purchase' && <p className="shrink-0 text-right text-sm font-semibold tabular-nums">{item.priceVnd == null ? 'Chưa ghi nhận giá' : formatAiPlanPrice(item.priceVnd)}</p>}</div>
      </li>)}</ul>
      <div className="border-t border-outline-variant px-3 py-2"><Pagination key={data.page} currentPage={data.page} totalPages={data.totalPages} onPageChange={value => { setPage(value); heading.current?.focus(); }} /></div>
    </>}
  </section>;
}
