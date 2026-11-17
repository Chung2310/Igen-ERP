import { useEffect, useId, useState, type FormEvent } from "react";
import { formatTelecomInvoiceValue, type LeadContractPhoto } from "../../../../../../shared/marketing-suite/telecom-invoice";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { crmService } from "../../services/crmService";

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const linkClass = "w-fit rounded text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary";
const fieldClass = "min-h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary";

export function LeadContractPhotos({ leadId, onOpenSource, onSaved }: {
  leadId?: string;
  onOpenSource: (photo: LeadContractPhoto) => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<{ items: LeadContractPhoto[]; before?: string }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void crmService.getLeadContractPhotos(leadId, undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được danh sách ảnh.");
    });
    return () => controller.abort();
  }, [leadId, attempt]);

  async function loadMore() {
    if (!data?.before || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await crmService.getLeadContractPhotos(leadId, data.before);
      setData({ items: [...data.items, ...next.items], before: next.before });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách ảnh.");
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label={leadId ? "Ảnh hợp đồng đã ghi nhận" : "Ảnh chờ kiểm tra"} aria-busy={busy || (!data && !error)} className="space-y-3">
    {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
    {!data && !error && <p role="status" className="text-pretty text-sm text-on-surface-variant">Đang tải danh sách ảnh…</p>}
    {!data && error && <button type="button" className={linkClass} onClick={() => { setError(""); setAttempt(n => n + 1); }}>Tải lại danh sách</button>}
    {notice && <p role="status" className="text-pretty text-sm text-on-surface-variant">{notice}</p>}
    {data?.items.length === 0 && <p className="text-pretty text-sm text-on-surface-variant">{leadId ? "Chưa có ảnh hợp đồng." : "Hiện không có ảnh chờ kiểm tra."}</p>}
    {Boolean(data?.items.length) && <ul className="space-y-2">
      {data?.items.map(photo => <li key={photo.id} className="space-y-2 rounded-md border border-outline-variant px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="break-all text-sm font-semibold">{photo.contractCode || "Ảnh chưa có mã hợp đồng"}</span>
          <time dateTime={photo.receivedAt} className="text-xs tabular-nums text-on-surface-variant">{dateTime.format(new Date(photo.receivedAt))}</time>
        </div>
        <p className="text-pretty text-sm text-on-surface-variant">{photo.provider} · {photo.platform === "zalo" ? "Zalo OA" : "Facebook Page"}</p>
        {photo.issue && <p className="text-pretty text-sm">{photo.issue}</p>}
        <button type="button" className={linkClass} onClick={() => onOpenSource(photo)}>Mở hội thoại gốc</button>
        {leadId ? <dl className="grid gap-y-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          {photo.fields.filter(field => field.key !== photo.contractFieldKey && photo.values[field.key]).map(field =>
            <div key={field.key} className="sm:contents">
              <dt className="text-on-surface-variant">{field.label}</dt>
              <dd className="wrap-anywhere tabular-nums">{formatTelecomInvoiceValue(field.key, photo.values[field.key], field.type)}</dd>
            </div>)}
        </dl> : <ContractPhotoReview photo={photo} onSaved={() => {
          setData(current => current && { ...current, items: current.items.filter(item => item.id !== photo.id) });
          setNotice("Đã ghi ảnh vào Lead.");
          onSaved?.();
        }} />}
      </li>)}
    </ul>}
    {data?.before && <button type="button" className={linkClass} disabled={busy} onClick={() => void loadMore()}>{busy ? "Đang tải…" : "Xem thêm ảnh"}</button>}
  </section>;
}

function ContractPhotoReview({ photo, onSaved }: { photo: LeadContractPhoto; onSaved: () => void }) {
  const [values, setValues] = useState(photo.values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await crmService.confirmLeadContractPhoto(photo.id, values);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể ghi ảnh vào Lead.");
    } finally {
      setBusy(false);
    }
  }
  return <details className="pt-1">
    <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">Kiểm tra và ghi vào Lead</summary>
    <form className="mt-2 space-y-2" onSubmit={save} aria-busy={busy}>
      <div className="grid gap-2 sm:grid-cols-2">
        {photo.fields.map(field => <label key={field.key} className="min-w-0 space-y-1 text-sm">
          <span>{field.label}</span>
          <input className={fieldClass} value={values[field.key] ?? ""} disabled={busy}
            required={field.key === photo.contractFieldKey} maxLength={3000}
            aria-describedby={error ? errorId : undefined}
            onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} />
        </label>)}
      </div>
      {error && <p id={errorId} role="alert" className="text-pretty text-sm text-error">{error}</p>}
      <button type="submit" className={primaryCreateButtonClass} disabled={busy}>{busy ? "Đang ghi…" : "Ghi vào Lead"}</button>
    </form>
  </details>;
}
