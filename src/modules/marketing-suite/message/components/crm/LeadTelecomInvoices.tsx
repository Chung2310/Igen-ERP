import { useEffect, useId, useState } from "react";
import { DEFAULT_TELECOM_INVOICE_FIELDS, TELECOM_INVOICE_FIELDS, formatTelecomInvoiceValue, type ConfirmedTelecomInvoice } from "../../../../../../shared/marketing-suite/telecom-invoice";
import { crmService } from "../../services/crmService";

const linkClass = "w-fit rounded text-sm font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary";
const dateFormat = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

export function LeadTelecomInvoices({ leadId, subscriberCode, onOpenSource }: {
  leadId: string;
  subscriberCode: string;
  onOpenSource: (invoice: ConfirmedTelecomInvoice) => void;
}) {
  const title = useId();
  const [result, setResult] = useState<{ items: ConfirmedTelecomInvoice[]; before?: string }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void crmService.getLeadTelecomInvoices(leadId, undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult(data);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được hóa đơn.");
    });
    return () => controller.abort();
  }, [leadId, attempt]);

  async function loadMore() {
    if (!result?.before || loadingMore) return;
    setError("");
    setLoadingMore(true);
    try {
      const data = await crmService.getLeadTelecomInvoices(leadId, result.before);
      setResult({ items: [...result.items, ...data.items], before: data.before });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được hóa đơn.");
    } finally {
      setLoadingMore(false);
    }
  }

  return <section aria-labelledby={title} aria-busy={loadingMore || (!result && !error)} className="space-y-2">
    <h4 id={title} className="text-balance text-sm font-semibold">Hóa đơn nhà mạng</h4>
    <p className="text-sm tabular-nums text-on-surface-variant">Mã thuê bao {subscriberCode}</p>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {!result && (error
      ? <button type="button" className={linkClass} onClick={() => { setError(""); setAttempt(value => value + 1); }}>Tải lại hóa đơn</button>
      : <p role="status" className="text-sm text-on-surface-variant">Đang tải hóa đơn…</p>)}
    {result?.items.length === 0 && <p className="text-sm text-on-surface-variant">Chưa có hóa đơn được ghi nhận.</p>}
    {result && result.items.length > 0 && <ul className="space-y-2">
      {result.items.map(invoice => {
        const invoiceNumber = invoice.invoiceNumber ?? invoice.values.invoiceNumber;
        const fields = invoice.leadFields ?? DEFAULT_TELECOM_INVOICE_FIELDS.filter(key => key !== "subscriberCode" && key !== "invoiceNumber")
          .map(key => ({ key, label: TELECOM_INVOICE_FIELDS[key], type: undefined }));
        return <li key={invoice.id} className="space-y-2 rounded-lg border border-outline-variant p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <span className="break-all font-medium">{invoiceNumber ? `Hóa đơn ${invoiceNumber}` : "Hóa đơn đã ghi nhận"}</span>
          <time dateTime={invoice.confirmedAt} className="tabular-nums text-on-surface-variant">{dateFormat.format(new Date(invoice.confirmedAt))}</time>
        </div>
        <dl className="grid gap-y-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          {fields.map(field => {
            const value = invoice.values[field.key];
            if (!value || field.key === invoice.subscriberFieldKey) return null;
            return <div key={field.key} className="sm:contents">
              <dt className="text-on-surface-variant">{field.label}</dt>
              <dd className="break-words tabular-nums">{formatTelecomInvoiceValue(field.key, value, field.type)}</dd>
            </div>;
          })}
        </dl>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {invoice.imageUrl && <a href={invoice.imageUrl} target="_blank" rel="noopener noreferrer" className={linkClass}
            aria-label={invoiceNumber ? `Xem ảnh gốc của hóa đơn ${invoiceNumber}` : "Xem ảnh gốc của hóa đơn"}>Xem ảnh gốc</a>}
          <button type="button" className={linkClass} onClick={() => onOpenSource(invoice)}
            aria-label={invoiceNumber ? `Mở hội thoại gốc của hóa đơn ${invoiceNumber}` : "Mở hội thoại gốc của hóa đơn"}>
            Mở hội thoại gốc
          </button>
        </div>
      </li>; })}
    </ul>}
    {result?.before && <button type="button" className={`${linkClass} disabled:opacity-60`} disabled={loadingMore} onClick={() => void loadMore()}>Xem thêm hóa đơn</button>}
  </section>;
}
