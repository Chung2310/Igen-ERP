import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Link2 } from "lucide-react";
import { ErpModal } from "../../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { customerApi } from "../customerApi";
import { customerDetailHref } from "../navigation";
import type { Customer, CustomerModule, CustomerModuleRecord, CustomerPurchaseHistoryScope, CustomerSourceBatchRow } from "../types";
import { buttonClass, choiceClass, CompareSource, fieldClass, moduleLabels, SourceIdentity } from "./CustomerSourceComparison";

type Scope = CustomerPurchaseHistoryScope & { module: CustomerModule };
type QueueResult = { key: string; items: CustomerModuleRecord[]; hasMore: boolean; error?: string };

const statusLabels: Record<CustomerSourceBatchRow["status"], string> = {
  ready: "Sẵn sàng tạo khách hàng",
  "shared-customer-phone": "Trùng số với khách hàng có sẵn",
  "shared-batch-phone": "Trùng số trong đợt chuyển",
  "missing-phone": "Thiếu số điện thoại",
  linked: "Đã liên kết",
  unavailable: "Hồ sơ không còn trong chi nhánh",
  transferred: "Đã chuyển",
  failed: "Chuyển chưa thành công",
};

function needsReview(row: CustomerSourceBatchRow) {
  return row.status === "shared-customer-phone" || row.status === "shared-batch-phone" || row.status === "missing-phone";
}

function messageOf(cause: unknown) {
  return cause instanceof Error ? cause.message : "Không thực hiện được. Vui lòng thử lại.";
}

type TransferActionProps = Scope & { canConfigure?: boolean; settingsOnly?: boolean; initialRecords?: CustomerModuleRecord[] };

export function CustomerSourceTransferAction(props: TransferActionProps) {
  return <TransferAction key={JSON.stringify([props.module, props.companyCode, props.branchId])} {...props} />;
}

function TransferAction({ module, companyCode, branchId, canConfigure, settingsOnly, initialRecords }: TransferActionProps) {
  const [hidden, setHidden] = useState<boolean>();
  const [open, setOpen] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void customerApi.sourceTransferSetting(module, { companyCode, branchId }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setHidden(result.hidden); })
      .catch(cause => { if (!controller.signal.aborted) { setError(messageOf(cause)); setHidden(false); } });
    return () => controller.abort();
  }, [module, companyCode, branchId]);

  async function changeVisibility(value: boolean) {
    setConfiguring(true);
    setError("");
    try {
      const result = await customerApi.setSourceTransferHidden(module, { companyCode, branchId }, value);
      setHidden(result.hidden);
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus());
    } catch (cause) { setError(messageOf(cause)); }
    finally { setConfiguring(false); }
  }

  if (hidden === undefined || (hidden && !settingsOnly)) return null;
  return <>
    <button type="button" ref={trigger} className={buttonClass} aria-haspopup={settingsOnly ? undefined : "dialog"} disabled={configuring}
      onClick={() => { if (settingsOnly) void changeVisibility(!hidden); else setOpen(true); }}>
      {settingsOnly ? hidden ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
      {settingsOnly ? (hidden ? "Hiện nút chuyển ở " : "Ẩn nút chuyển ở ") + moduleLabels[module] : "Chuyển hồ sơ sang Khách hàng"}
    </button>
    {error && !open && <span role="alert" className="text-xs text-error">{error}</span>}
    {open && <CustomerSourceBatchDialog module={module} companyCode={companyCode} branchId={branchId} initialRecords={initialRecords}
      onClose={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }}
      onHide={canConfigure ? () => void changeVisibility(true) : undefined} hiding={configuring} hideError={error} />}
  </>;
}

function CustomerSourceBatchDialog({ module, companyCode, branchId, onClose, onHide, hiding, hideError, initialRecords = [] }: Scope & {
  onClose: () => void; onHide?: () => void; hiding: boolean; hideError: string;
  initialRecords?: CustomerModuleRecord[];
}) {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 250);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([q, page, revision]);
  const [queue, setQueue] = useState<QueueResult>();
  const [selected, setSelected] = useState<CustomerModuleRecord[]>(() => initialRecords.slice(0, 50));
  const [rows, setRows] = useState<CustomerSourceBatchRow[]>();
  const [compare, setCompare] = useState<CustomerSourceBatchRow>();
  const [resolved, setResolved] = useState<Record<string, Customer>>({});
  const [busy, setBusy] = useState(false);
  const [ranTransfer, setRanTransfer] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const scope = { companyCode, branchId };

  useEffect(() => {
    if (rows) return;
    const controller = new AbortController();
    void customerApi.sourceQueue(module, { companyCode, branchId }, q, page, controller.signal).then(result => {
      if (!controller.signal.aborted) setQueue({ key: requestKey, ...result });
    }).catch(cause => {
      if (!controller.signal.aborted) setQueue({ key: requestKey, items: [], hasMore: false, error: messageOf(cause) });
    });
    return () => controller.abort();
  }, [module, companyCode, branchId, q, page, requestKey, rows]);

  const visible = queue?.key === requestKey && query.trim() === q ? queue : undefined;
  const selectedIds = new Set(selected.map(record => record.id));
  const ready = rows?.filter(row => row.status === "ready" || row.status === "failed") ?? [];
  const pending = rows?.filter(needsReview) ?? [];
  const completed = rows?.filter(row => row.status === "transferred" || row.status === "linked") ?? [];
  const unavailable = rows?.filter(row => row.status === "unavailable") ?? [];
  const comparing = compare && selected.find(item => item.id === compare.sourceId);

  function selectItems(items: CustomerModuleRecord[], checked: boolean) {
    const ids = new Set(items.map(item => item.id));
    setSelected(previous => checked
      ? [...previous, ...items.filter(item => !previous.some(record => record.id === item.id))].slice(0, 50)
      : previous.filter(item => !ids.has(item.id)));
  }

  async function submit(transfer = false) {
    if (submitting.current || !selected.length) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const refs = selected.map(record => ({ module, sourceId: record.id }));
      const result = transfer ? await customerApi.sourceBatchTransfer(scope, refs, ready.map(({ module, sourceId }) => ({ module, sourceId }))) : await customerApi.sourceBatchPreview(scope, refs);
      setRows(previous => result.map(row => previous?.find(old => old.sourceId === row.sourceId && old.status === "transferred") ?? row));
      if (transfer) setRanTransfer(true);
    } catch (cause) { setError(messageOf(cause)); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (compare && comparing) return <CompareSource key={compare.sourceId} module={module} source={comparing} {...scope}
    batchSharedPhone={compare.status === "shared-batch-phone"}
    onBack={() => setCompare(undefined)} onClose={() => setCompare(undefined)}
    onSaved={customer => {
      setResolved(previous => ({ ...previous, [compare.sourceId]: customer }));
      setRows(previous => previous?.map(row => row.sourceId === compare.sourceId ? { ...row, status: "transferred" } : row));
      setCompare(undefined);
    }} />;

  function showRows(items: CustomerSourceBatchRow[], review = false) {
    return <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
      {items.map(row => {
        const record = selected.find(item => item.id === row.sourceId);
        const customer = resolved[row.sourceId];
        return <li key={row.sourceId} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
          <div className="min-w-0">
            {record && <SourceIdentity record={record} />}
            <p className="mt-1 text-pretty text-xs text-on-surface-variant">{row.message || statusLabels[row.status]}</p>
          </div>
          {review && <button type="button" className={buttonClass} disabled={busy} aria-label={["Đối chiếu", record?.name, record?.code].filter(Boolean).join(" ")}
            onClick={() => setCompare(row)}>Đối chiếu</button>}
          {customer && <a className={buttonClass} href={customerDetailHref(customer._id, "module-links")}>Mở {customer.customerCode}</a>}
        </li>;
      })}
    </ul>;
  }

  return <ErpModal native title={rows ? "Xem trước và chuyển hồ sơ" : "Chuyển hồ sơ " + moduleLabels[module].toLowerCase() + " sang Khách hàng"}
    onClose={onClose} closeDisabled={busy || hiding} maxWidth="max-w-3xl">
    {rows ? <>
      <p role="status" className="text-pretty text-sm text-on-surface-variant">
        {completed.length} đã chuyển · {ready.length} chưa chuyển · {pending.length} cần đối chiếu{unavailable.length ? " · " + unavailable.length + " không còn khả dụng" : ""}
      </p>
      {ready.length > 0 && <section aria-label="Sẵn sàng chuyển" className="space-y-2">
        <h4 className="text-balance text-sm font-semibold">Hồ sơ chuyển hàng loạt</h4>
        {showRows(ready)}
      </section>}
      {pending.length > 0 && <section aria-label="Cần đối chiếu" className="space-y-2">
        <h4 className="text-balance text-sm font-semibold">Cần đối chiếu từng hồ sơ</h4>
        {showRows(pending, true)}
      </section>}
      {completed.length > 0 && <section aria-label="Đã chuyển" className="space-y-2">
        <h4 className="text-balance text-sm font-semibold">Đã chuyển hoặc đã liên kết</h4>
        {showRows(completed)}
      </section>}
      {unavailable.length > 0 && showRows(unavailable)}
    </> : <>
      <label className="block text-sm font-medium">Tìm hồ sơ chưa chuyển
        <input type="search" value={query} disabled={busy || hiding} onChange={event => { setQuery(event.target.value); setPage(1); }}
          className={fieldClass} placeholder="Tên, mã hồ sơ hoặc số điện thoại" />
      </label>
      {initialRecords.length > 50 && <p className="text-pretty text-sm text-on-surface-variant">Đã chọn trước 50 hồ sơ đầu tiên từ danh sách. Có thể chuyển phần còn lại ở đợt sau.</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
        <p role="status" className="tabular-nums">Đã chọn {selected.length}/50 hồ sơ</p>
        {selected.length > 0 && <button type="button" disabled={busy || hiding} className="min-h-9 rounded-md px-2 underline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={() => setSelected([])}>Bỏ chọn tất cả</button>}
      </div>
      {!visible ? <p role="status" className="text-sm text-on-surface-variant">Đang tải hồ sơ…</p>
        : visible.error ? <p role="alert" className="text-sm text-error">{visible.error}</p>
        : !visible.items.length ? <p className="text-pretty text-sm text-on-surface-variant">Trang này không có hồ sơ chưa chuyển. Thử đổi từ khóa hoặc xem trang tiếp theo.</p>
        : <fieldset disabled={busy || hiding} className="min-w-0 space-y-2">
          <legend className="pb-1 text-sm font-semibold">Hồ sơ chưa chuyển</legend>
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={visible.items.every(item => selectedIds.has(item.id))}
              disabled={selected.length >= 50 && !visible.items.every(item => selectedIds.has(item.id))}
              onChange={event => selectItems(visible.items, event.target.checked)} /> Chọn trên trang này
          </label>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {visible.items.map(item => <label key={item.id} className={choiceClass}>
              <input type="checkbox" className="mt-1 shrink-0 accent-primary" checked={selectedIds.has(item.id)}
                disabled={selected.length >= 50 && !selectedIds.has(item.id)} onChange={event => selectItems([item], event.target.checked)} />
              <SourceIdentity record={item} />
            </label>)}
          </div>
        </fieldset>}
      {(page > 1 || visible?.hasMore) && <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className={buttonClass} disabled={busy || hiding || page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="size-4" aria-hidden="true" />Trang trước
        </button>
        <span className="tabular-nums">Trang {page}</span>
        <button type="button" className={buttonClass} disabled={busy || hiding || !visible?.hasMore} onClick={() => setPage(page + 1)}>
          Trang sau<ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>}
    </>}
    {(error || hideError) && <p role="alert" className="text-pretty text-sm text-error">{error || hideError}</p>}
    <div className="flex flex-wrap justify-between gap-2 border-t border-outline-variant pt-3">
      {rows ? <button type="button" className={buttonClass} disabled={busy}
        onClick={() => {
          if (ranTransfer || completed.length) { setSelected([]); setRevision(value => value + 1); setPage(1); }
          setRows(undefined); setResolved({}); setRanTransfer(false); setError("");
        }}>{ranTransfer || completed.length ? "Chọn đợt khác" : "Sửa danh sách đã chọn"}</button>
        : onHide ? <button type="button" className={buttonClass} disabled={busy || hiding} title="Có thể bật lại trong Cài đặt khách hàng" onClick={onHide}>
          <EyeOff className="size-4" aria-hidden="true" />{hiding ? "Đang ẩn…" : "Ẩn nút chuyển"}
        </button> : <button type="button" className={buttonClass} disabled={busy} onClick={onClose}>Đóng</button>}
      {rows ? ready.length > 0 && <button type="button" className={primaryCreateButtonClass} disabled={busy}
        onClick={() => void submit(true)}>{busy ? "Đang chuyển…" : "Chuyển " + ready.length + " hồ sơ"}</button>
        : <button type="button" className={primaryCreateButtonClass} disabled={busy || hiding || !selected.length}
          onClick={() => void submit()}>{busy ? "Đang đối chiếu…" : "Xem trước đợt chuyển"}</button>}
    </div>
  </ErpModal>;
}
