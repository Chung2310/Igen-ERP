import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { customerApi } from '../customerApi';
import { withRequestTimeout } from '../../../utils/requestTimeout';
import type { CustomerTransactionDetail, CustomerTransactionRow } from '../../../../shared/customer-transactions';

const money = (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`;
const when = (date?: string) => date ? new Date(date).toLocaleString('vi-VN') : '—';
const method: Record<string, string> = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ', ewallet: 'Ví điện tử' };
export default function CustomerTransactionDetailDialog({ customerId, companyCode, branchId, row, onClose }: { customerId: string; companyCode: string; branchId: string; row: CustomerTransactionRow; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<CustomerTransactionDetail | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); trigger?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void withRequestTimeout((signal) => customerApi.transactionDetail(customerId, { companyCode, branchId }, row, signal), 20000, 'Tải giao dịch quá lâu. Hãy thử lại.', controller.signal)
      .then((value) => { if (!controller.signal.aborted) { setDetail(value); setError(''); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được chi tiết giao dịch.'); });
    return () => controller.abort();
  }, [customerId, companyCode, branchId, row, retry]);
  return createPortal(<dialog ref={dialogRef} aria-labelledby="customer-transaction-title" onCancel={onClose} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-black/40 [--color-on-surface-variant:var(--color-slate-600)]">
    <header className="flex items-start justify-between gap-3 border-b border-outline-variant p-4 sm:p-5"><div><h2 id="customer-transaction-title" className="break-words text-balance text-lg font-semibold">Chi tiết {row.code}</h2><p className="mt-1 text-sm text-on-surface-variant tabular-nums">{when(row.occurredAt)}</p></div><button type="button" aria-label="Đóng chi tiết giao dịch" onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><X className="size-5" aria-hidden="true" /></button></header>
    <div className="space-y-5 p-4 sm:p-5">
      {error && <div className="space-y-3"><p role="alert" className="text-pretty text-sm text-error">{error}</p><button type="button" onClick={() => { setError(''); setRetry((value) => value + 1); }} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button></div>}
      {!detail && !error && <p role="status" className="text-sm">Đang tải chi tiết giao dịch…</p>}
      {detail && <>
        <dl className="grid gap-3 sm:grid-cols-3">{[['Giá trị', detail.item.amount], ['Đã thu trên phiếu gốc', detail.item.paidAmount], ['Còn phải thu', detail.item.dueAmount]].map(([label, value]) => <div key={label} className="rounded-xl bg-surface-container-low p-3"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{money(Number(value))}</dd></div>)}</dl>
        {detail.device && <section><h3 className="text-balance font-semibold">Đối tượng tiếp nhận</h3><p className="mt-2 text-pretty text-sm">{detail.device.name}{detail.device.serialNumber ? ` · ${detail.device.serialNumber}` : ''}</p>{detail.device.symptom && <p className="mt-1 text-pretty text-sm text-on-surface-variant">Yêu cầu: {detail.device.symptom}</p>}{detail.device.diagnosis && <p className="mt-1 text-pretty text-sm text-on-surface-variant">Kết quả kiểm tra: {detail.device.diagnosis}</p>}</section>}
        {detail.lines.length > 0 && <section className="space-y-2"><h3 className="text-balance font-semibold">Hạng mục giao dịch</h3><ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">{detail.lines.map((line, index) => <li key={index} className="flex flex-col justify-between gap-2 p-3 text-sm sm:flex-row"><div className="min-w-0"><p className="break-words font-medium">{line.name}</p><p className="mt-1 text-on-surface-variant tabular-nums">{line.quantity} × {money(line.unitPrice)}{line.sku ? ` · ${line.sku}` : ''}</p>{line.serials?.length ? <p className="mt-1 break-words text-xs text-on-surface-variant">{line.serials.join(', ')}</p> : null}</div><span className="shrink-0 font-semibold tabular-nums">{money(line.total)}</span></li>)}</ul></section>}
        {!!detail.adjustments?.length && <dl className="space-y-2 text-sm">{detail.adjustments.map((item) => <div key={item.label} className="flex justify-between gap-3"><dt className="text-on-surface-variant">{item.label}</dt><dd className="font-medium tabular-nums">{money(item.amount)}</dd></div>)}</dl>}
        {detail.payments.length > 0 && <section><h3 className="text-balance font-semibold">Lịch sử thu tiền</h3><ul className="mt-2 space-y-2 text-sm">{detail.payments.map((payment, index) => <li key={index} className="rounded-xl bg-surface-container-low p-3"><p className="font-medium tabular-nums">{money(payment.amount)} · {when(payment.at)}</p><p className="mt-1 break-words text-on-surface-variant">{method[payment.method || ''] || payment.method || ''}{payment.reference ? ` · ${payment.reference}` : ''}</p></li>)}</ul></section>}
        {detail.refunds.length > 0 && <section><h3 className="text-balance font-semibold">Lịch sử hoàn tiền</h3><ul className="mt-2 space-y-2 text-sm">{detail.refunds.map((refund, index) => <li key={index} className="rounded-xl bg-surface-container-low p-3"><p className="font-medium tabular-nums">{money(refund.amount)} · {when(refund.at)}</p><p className="mt-1 break-words text-pretty text-on-surface-variant">{refund.reason}{refund.reference ? ` · ${refund.reference}` : ''}</p></li>)}</ul></section>}
        {detail.financeVoucherCode && <p className="break-words text-sm">Phiếu chi liên kết: <strong>{detail.financeVoucherCode}</strong></p>}
        {detail.note && <p className="whitespace-pre-wrap break-words text-pretty text-sm text-on-surface-variant">{detail.note}</p>}
      </>}
    </div>
  </dialog>, document.body);
}
