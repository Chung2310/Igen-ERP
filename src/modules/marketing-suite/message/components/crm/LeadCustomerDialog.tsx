import { useEffect, useRef, useState } from "react";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { customerApi } from "../../../../customer-management/customerApi";
import { ApiClientError } from "../../../../../services/apiClientError";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";

type Candidate = Awaited<ReturnType<typeof customerApi.searchActive>>[number];
const inputClass = "mt-1 block min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus-visible:border-primary";

export function LeadCustomerDialog({ lead, companyCode, onClose, onSaved }: {
  lead: ExtendedLeadCard;
  companyCode: string;
  onClose: () => void;
  onSaved: (customerId: string) => void;
}) {
  const [name, setName] = useState(lead.customerName || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [checkedQuery, setCheckedQuery] = useState("");
  const [confirmPhone, setConfirmPhone] = useState("");
  const [searchText, setSearchText] = useState<string>();
  const defaultQuery = phone.trim() || email.trim() || name.trim();
  const query = searchText?.trim() ?? defaultQuery;
  const selected = checkedQuery === query ? candidates.find(candidate => candidate.customerId === selectedId) : undefined;

  useEffect(() => {
    setCandidates([]);
    setSelectedId("");
    setCheckedQuery("");
    setLookupError("");
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void customerApi.searchActive({ companyCode, q: query, limit: 20 }, controller.signal).then(result => {
        if (!controller.signal.aborted) {
          setCandidates(result);
          setCheckedQuery(query);
        }
      }).catch(cause => {
        if (!controller.signal.aborted) setLookupError(cause instanceof Error ? cause.message : "Không tìm được khách hàng.");
      });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [companyCode, query]);

  async function save(customerId?: string) {
    if (submitting.current || (!customerId && (!name.trim() || !phone.trim()))) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const linked = await crmService.saveLeadCustomer(lead.id, customerId ? { customerId } : {
        create: true, name: name.trim(), phone: phone.trim(), email: email.trim(),
        allowSharedPhone: Boolean(confirmPhone && confirmPhone === phone.trim()),
      });
      onSaved(linked.customerId);
    } catch (cause) {
      setConfirmPhone(cause instanceof ApiClientError && cause.code === "CUSTOMER_PHONE_EXISTS" ? phone.trim() : "");
      setError(cause instanceof Error ? cause.message : "Không lưu được Lead vào Khách hàng.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <ErpModal native title="Lưu Lead vào Khách hàng" onClose={onClose} closeDisabled={busy}>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(selected?.customerId); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Tên khách hàng<input className={inputClass} value={name} disabled={busy} onChange={event => setName(event.target.value)} required={!selected} /></label>
        <label className="text-sm">Số điện thoại<input className={inputClass} type="tel" value={phone} disabled={busy} onChange={event => { setPhone(event.target.value); setConfirmPhone(""); }} required={!selected} /></label>
        <label className="text-sm sm:col-span-2">Email<input className={inputClass} type="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      </div>
      <section aria-label="Khách hàng có sẵn" className="space-y-2">
        <label className="block text-sm font-medium">Tìm hồ sơ có sẵn
          <input className={inputClass} type="search" value={searchText ?? defaultQuery} disabled={busy} onChange={event => setSearchText(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="Mã khách hàng, tên hoặc số điện thoại" />
        </label>
        {query.length < 2 ? null : lookupError ? <p role="alert" className="text-sm text-error">{lookupError}</p>
          : checkedQuery !== query ? <p role="status" className="text-sm text-on-surface-variant">Đang tìm khách hàng…</p>
          : candidates.length === 0 ? <p className="text-sm text-on-surface-variant">Chưa tìm thấy hồ sơ phù hợp.</p>
          : <fieldset disabled={busy} className="min-w-0 space-y-2">
              <legend className="text-sm text-on-surface-variant">Đối chiếu tên và mã khách trước khi chọn hồ sơ.</legend>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {candidates.map(candidate => <label key={candidate.customerId} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-container has-checked:border-primary has-checked:bg-primary/5">
                  <input type="radio" name="leadCustomer" checked={selected?.customerId === candidate.customerId} onChange={() => { setSelectedId(candidate.customerId); setError(""); setConfirmPhone(""); }} className="shrink-0 accent-primary" />
                  <span className="min-w-0 wrap-break-word"><span className="block font-medium">{candidate.name}</span><span className="text-xs tabular-nums text-on-surface-variant">{candidate.customerCode} · {candidate.phone}</span></span>
                </label>)}
              </div>
              {selected && <button type="button" onClick={() => { setSelectedId(""); setError(""); }} className="min-h-9 rounded-md px-2 text-sm text-on-surface underline focus-visible:outline-2 focus-visible:outline-primary">Bỏ chọn hồ sơ</button>}
            </fieldset>}
      </section>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="min-h-10 rounded-md border border-outline-variant px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" disabled={busy} onClick={onClose}>Hủy</button>
        <button type="submit" formNoValidate={Boolean(selected)} className={primaryCreateButtonClass} disabled={busy || (!selected && (!phone.trim() || !name.trim()))}>
          {busy ? "Đang lưu…" : selected ? "Liên kết hồ sơ đã chọn" : confirmPhone ? "Xác nhận tạo khách riêng" : "Tạo hồ sơ Khách hàng"}
        </button>
      </div>
    </form>
  </ErpModal>;
}
