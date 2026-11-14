import { useEffect, useRef, useState } from "react";
import { healthcareHref } from "../../healthcare/navigation";
import { tabToPath } from "../../../seo/seo-config";
import { customerApi } from "../customerApi";
import type { CustomerModule, CustomerModuleRecord } from "../types";
import { ErpModal } from "../../../components/common/ErpModal";

const labels: Record<CustomerModule, string> = { students: "Đào tạo", healthcare: "Y tế" };
const action = "inline-flex min-h-10 items-center rounded-md border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container focus-visible:outline-1 focus-visible:outline-primary";

export default function CustomerModuleLinksPanel({ customerId, companyCode, branchId, canManage }: {
  customerId: string;
  companyCode: string;
  branchId: string;
  canManage: boolean;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof customerApi.moduleLinks>>>();
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<CustomerModule>();
  const opener = useRef<HTMLElement | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const [unlink, setUnlink] = useState<{ module: CustomerModule; id: string; name: string }>();
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void customerApi.moduleLinks(customerId, { companyCode, branchId }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ liên kết."); });
    return () => controller.abort();
  }, [customerId, companyCode, branchId, version]);

  function restoreFocus() {
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus();
      else region.current?.focus();
    });
  }

  async function removeLink() {
    if (!unlink || unlinkBusy) return;
    setUnlinkBusy(true);
    setUnlinkError("");
    try {
      await customerApi.unlinkModuleRecord(customerId, unlink.module, unlink.id, { companyCode, branchId });
      setUnlink(undefined);
      restoreFocus();
      setVersion(value => value + 1);
    } catch (cause) {
      setUnlinkError(cause instanceof Error ? cause.message : "Không gỡ được liên kết.");
    } finally { setUnlinkBusy(false); }
  }

  if (error) return <p role="alert" className="text-sm text-error">{error}</p>;
  if (!data) return <p role="status" className="text-sm text-on-surface-variant">Đang tải hồ sơ liên kết…</p>;
  if (!data.modules.length) return <p className="text-sm text-on-surface-variant">Chưa có phân hệ để hiển thị.</p>;

  return <div ref={region} tabIndex={-1} className="space-y-4">
    {data.modules.map(module => {
      const records = data.links.filter(link => link.module === module);
      return <section key={module} aria-label={labels[module]} className="space-y-2 rounded-md border border-outline-variant p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 data-typography="section-title" className="font-semibold">{labels[module]}</h3>
          {canManage && data.manageable.includes(module) && <button type="button" className={action} onClick={event => { opener.current = event.currentTarget; setEditor(module); }}>Liên kết hồ sơ {labels[module]}</button>}
        </div>
        {records.length ? <ul className="divide-y divide-outline-variant">
          {records.map(record => <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{record.name}{record.code ? ` · ${record.code}` : ""}</p>
              {record.status?.length ? <p className="text-sm text-on-surface-variant">{record.status.join(" · ")}</p> : null}
              {typeof record.paidAmount === "number" && <p className="text-sm text-on-surface-variant">Đã thu {record.paidAmount.toLocaleString("vi-VN")} ₫</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <a className={action} aria-label={`Mở hồ sơ ${labels[module]} của ${record.name}`} href={module === "healthcare"
                ? healthcareHref({ tab: "patients", patientId: record.id }, branchId)
                : `${tabToPath("QUẢN LÝ HỌC VIÊN")}?sub=hoc-vien&studentId=${encodeURIComponent(record.id)}&branch=${encodeURIComponent(branchId)}`}>
                Mở hồ sơ
              </a>
              {canManage && record.canUnlink && <button type="button" className={action} onClick={event => { opener.current = event.currentTarget; setUnlinkError(""); setUnlink(record); }}>Gỡ liên kết</button>}
            </div>
          </li>)}
        </ul> : <p className="text-sm text-on-surface-variant">Chưa có hồ sơ liên kết.</p>}
      </section>;
    })}
    {unlink && <ErpModal native title="Gỡ liên kết hồ sơ" onClose={() => { setUnlink(undefined); restoreFocus(); }} closeDisabled={unlinkBusy}>
      <p className="text-sm">Gỡ liên kết với hồ sơ {labels[unlink.module]} của {unlink.name}? Hồ sơ nghiệp vụ và lịch sử vẫn lưu ở phân hệ.</p>
      {unlinkError && <p role="alert" className="text-sm text-error">{unlinkError}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={action} disabled={unlinkBusy} onClick={() => { setUnlink(undefined); restoreFocus(); }}>Hủy</button>
        <button type="button" className={action} disabled={unlinkBusy} onClick={() => void removeLink()}>{unlinkBusy ? "Đang gỡ…" : "Xác nhận gỡ liên kết"}</button>
      </div>
    </ErpModal>}
    {editor && <LinkDialog key={editor} module={editor} customerId={customerId} companyCode={companyCode} branchId={branchId}
      onClose={() => { setEditor(undefined); restoreFocus(); }} onLinked={() => { setEditor(undefined); restoreFocus(); setVersion(value => value + 1); }} />}
  </div>;
}

function LinkDialog({ module, customerId, companyCode, branchId, onClose, onLinked }: {
  module: CustomerModule;
  customerId: string;
  companyCode: string;
  branchId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<CustomerModuleRecord[]>([]);
  const [selected, setSelected] = useState<CustomerModuleRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    setBusy(true); setError(""); setSelected(undefined);
    try {
      setItems(await customerApi.moduleLinkCandidates(customerId, module, { companyCode, branchId, q: query.trim() }));
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tìm được hồ sơ.");
    } finally { setBusy(false); }
  }

  async function link() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      await customerApi.linkModuleRecord(customerId, module, selected.id, { companyCode, branchId });
      onLinked();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không liên kết được hồ sơ.");
    } finally { setBusy(false); }
  }

  return <ErpModal native title={`Liên kết hồ sơ ${labels[module]}`} onClose={onClose} closeDisabled={busy}>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void search(); }}>
      <label className="min-w-0 grow text-sm">Tên, số điện thoại hoặc mã hồ sơ
        <input className="mt-1 block min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 outline-none focus-visible:border-primary"
          value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setSelected(undefined); setItems([]); setSearched(false); }} />
      </label>
      <button type="submit" className={action} disabled={busy || query.trim().length < 2}>Tìm hồ sơ</button>
    </form>
    {items.length > 0 && <fieldset className="max-h-72 space-y-2 overflow-y-auto">
      <legend className="mb-2 text-sm font-medium">Chọn đúng hồ sơ của khách</legend>
      {items.map(item => <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-md border border-outline-variant px-3 text-sm">
        <input type="radio" name="sourceRecord" checked={selected?.id === item.id} disabled={busy} onChange={() => setSelected(item)} className="accent-primary" />
        <span>{item.name}{item.code ? ` · ${item.code}` : ""}{item.phone ? ` · ${item.phone}` : ""}{item.dateOfBirth ? ` · ${item.dateOfBirth.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1")}` : ""}</span>
      </label>)}
    </fieldset>}
    {searched && items.length === 0 && <p className="text-sm text-on-surface-variant">Không tìm thấy hồ sơ.</p>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <div className="flex justify-end">
      <button type="button" disabled={!selected || busy} className={action} onClick={() => void link()}>Xác nhận liên kết</button>
    </div>
  </ErpModal>;
}
