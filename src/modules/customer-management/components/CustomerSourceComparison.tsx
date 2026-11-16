import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ErpModal } from "../../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { ApiClientError } from "../../../services/apiClientError";
import { customerApi } from "../customerApi";
import type { Customer, CustomerModule, CustomerModuleRecord, CustomerPurchaseHistoryScope, CustomerSourceCandidate, CustomerSourceCandidates } from "../types";

export const moduleLabels = { students: "Học viên", healthcare: "Bệnh nhân" } satisfies Record<CustomerModule, string>;
export const fieldClass = "mt-1 block min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary";
export const buttonClass = "inline-flex min-h-10 items-center gap-2 rounded-md border border-outline-variant px-3 text-sm font-medium hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
export const choiceClass = "flex min-w-0 items-start gap-2 rounded-md border border-outline-variant p-2.5 text-sm has-checked:border-primary has-checked:bg-primary/5";

type CandidateResult = { query: string; data?: CustomerSourceCandidates; error?: string };

function displayBirthDate(value?: string, birthYear?: string) {
  return value?.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2/$1") || birthYear || "Chưa có";
}

export function SourceIdentity({ record }: { record: CustomerModuleRecord }) {
  return <span className="block min-w-0 space-y-0.5 wrap-anywhere">
    <span className="block font-medium">{record.name}{record.code && <span className="font-normal text-on-surface-variant"> · {record.code}</span>}</span>
    <span className="block text-xs tabular-nums text-on-surface-variant">{record.phone || "Chưa có số điện thoại"} · Sinh {displayBirthDate(record.dateOfBirth, record.birthYear)}</span>
  </span>;
}

function comparable(candidate: CustomerSourceCandidate) {
  if (candidate.status !== "active") return "Ngừng hoạt động";
  if (candidate.customerKind === "business") return "Hồ sơ doanh nghiệp";
  return "";
}

export function CompareSource({ module, source, companyCode, branchId, onBack, onClose, onSaved, batchSharedPhone }: CustomerPurchaseHistoryScope & {
  module: CustomerModule;
  source: CustomerModuleRecord;
  onBack: () => void;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
  batchSharedPhone?: boolean;
}) {
  const [lookup, setLookup] = useState("");
  const [base, setBase] = useState<CandidateResult>();
  const [manual, setManual] = useState<CandidateResult>();
  const [selected, setSelected] = useState<CustomerSourceCandidate>();
  const [create, setCreate] = useState(false);
  const [phone, setPhone] = useState(source.phone || "");
  const [shared, setShared] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const reasonId = useId();
  const lookupQuery = useDebouncedValue(lookup.trim(), 250);

  useEffect(() => {
    const controller = new AbortController();
    void customerApi.sourceCustomerCandidates(module, source.id, { companyCode, branchId }, undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setBase({ query: "", data }); })
      .catch(cause => { if (!controller.signal.aborted) setBase({ query: "", error: cause instanceof Error ? cause.message : "Không tải được khách hàng để đối chiếu." }); });
    return () => controller.abort();
  }, [branchId, companyCode, module, source.id]);

  useEffect(() => {
    if (lookupQuery.length < 2) return;
    const controller = new AbortController();
    void customerApi.sourceCustomerCandidates(module, source.id, { companyCode, branchId }, lookupQuery, controller.signal)
      .then(data => { if (!controller.signal.aborted) setManual({ query: lookupQuery, data }); })
      .catch(cause => { if (!controller.signal.aborted) setManual({ query: lookupQuery, error: cause instanceof Error ? cause.message : "Không tìm được khách hàng." }); });
    return () => controller.abort();
  }, [branchId, companyCode, lookupQuery, module, source.id]);

  const samePhone = base?.data?.items ?? [];
  const manualResult = lookup.trim() === lookupQuery && manual?.query === lookupQuery ? manual : undefined;
  const otherMatches = manualResult?.data?.items.filter(item => !samePhone.some(match => match.customerId === item.customerId)) ?? [];
  const target = selected && [...samePhone, ...otherMatches].find(item => item.customerId === selected.customerId);
  const needsConfirmation = samePhone.length > 0 || conflict || batchSharedPhone;
  const phoneAvailable = /\d/.test(phone);
  const canSave = !busy && (target || (create && base?.data && phoneAvailable && (!needsConfirmation || shared)));

  async function save() {
    if (!canSave || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const input = target ? { customerId: target.customerId } : { create: true as const, phone: phone.trim(), allowSharedPhone: needsConfirmation && shared };
      onSaved(await customerApi.importSourceRecord(module, source.id, { companyCode, branchId }, input));
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "CUSTOMER_PHONE_EXISTS") {
        setConflict(true);
        setShared(false);
        setLookup(phone.trim());
      }
      setError(cause instanceof Error ? cause.message : "Không lưu được liên kết.");
    } finally { submitting.current = false; setBusy(false); }
  }

  function candidateOptions(items: CustomerSourceCandidate[]) {
    return items.map(item => {
      const reason = comparable(item);
      return <label key={item.customerId} className={choiceClass}>
        <input type="radio" name="targetCustomer" checked={target?.customerId === item.customerId} disabled={busy || Boolean(reason)}
          onChange={() => { setSelected(item); setCreate(false); setShared(false); setError(""); }} className="mt-1 shrink-0 accent-primary" />
        <span className="block min-w-0 space-y-0.5 wrap-anywhere">
          <span className="block font-medium">{item.name} <span className="font-normal tabular-nums text-on-surface-variant">· {item.customerCode}</span></span>
          <span className="block text-xs tabular-nums text-on-surface-variant">{item.phone} · Sinh {displayBirthDate(item.dateOfBirth)}{reason ? " · " + reason : ""}</span>
        </span>
      </label>;
    });
  }

  return <ErpModal native title="Đối chiếu với hồ sơ Khách hàng" onClose={onClose} closeDisabled={busy} maxWidth="max-w-3xl">
    <div className="rounded-md border border-outline-variant bg-surface-container-low p-3 text-sm">
      <p className="mb-1 text-xs font-medium text-on-surface-variant">Hồ sơ {moduleLabels[module].toLowerCase()} đã chọn</p>
      <SourceIdentity record={source} />
    </div>
    {batchSharedPhone && <p className="text-pretty text-sm text-on-surface-variant">Nhiều hồ sơ trong đợt này dùng chung số. Đối chiếu từng hồ sơ trước khi xác nhận.</p>}
    <fieldset className="min-w-0 space-y-3">
      <legend className="pb-1 text-sm font-semibold">Chọn khách hàng có sẵn</legend>
      {!base ? <p role="status" className="text-sm text-on-surface-variant">Đang đối chiếu số điện thoại…</p>
        : base.error ? <p role="alert" className="text-sm text-error">{base.error}</p>
        : samePhone.length ? <div className="space-y-2">
          <p className="text-pretty text-sm text-on-surface-variant">{base.data?.truncated ? "Có hơn 50 khách cùng số. Tìm thêm theo mã khách." : samePhone.length + " khách có cùng số điện thoại."} Đối chiếu tên, mã khách và ngày sinh trước khi chọn.</p>
          <div className="max-h-44 space-y-2 overflow-y-auto">{candidateOptions(samePhone)}</div>
        </div> : <p className="text-sm text-on-surface-variant">{source.phone ? "Chưa tìm thấy khách có cùng số điện thoại." : "Hồ sơ cũ chưa có số điện thoại để đối chiếu."}</p>}
      <label className="block text-sm font-medium">Tìm thêm theo mã, tên hoặc số điện thoại
        <input type="search" className={fieldClass} disabled={busy} value={lookup}
          onChange={event => { setLookup(event.target.value); if (selected && !samePhone.some(item => item.customerId === selected.customerId)) setSelected(undefined); }} />
      </label>
      {lookup.trim().length >= 2 && (!manualResult ? <p role="status" className="text-sm text-on-surface-variant">Đang tìm khách hàng…</p>
        : manualResult.error ? <p role="alert" className="text-sm text-error">{manualResult.error}</p>
        : otherMatches.length ? <div className="max-h-44 space-y-2 overflow-y-auto">{candidateOptions(otherMatches)}</div>
        : <p role="status" className="text-sm text-on-surface-variant">Không có thêm khách hàng phù hợp.</p>)}
    </fieldset>
    <div className="space-y-2 border-t border-outline-variant pt-3">
      <label className={choiceClass}>
        <input type="radio" name="targetCustomer" checked={create} disabled={busy || !base?.data}
          onChange={() => { setCreate(true); setSelected(undefined); setError(""); }} className="mt-1 shrink-0 accent-primary" />
        <span>Tạo khách hàng mới từ hồ sơ đã chọn</span>
      </label>
      {create && <div className="space-y-2">
        {!/\d/.test(source.phone || "") && <label className="block text-sm font-medium">Số điện thoại khách mới
          <input type="tel" className={fieldClass} autoComplete="off" value={phone} disabled={busy}
            onChange={event => { setPhone(event.target.value); setShared(false); setConflict(false); setError(""); }} />
        </label>}
        {needsConfirmation && <label className="flex items-start gap-2 text-pretty text-sm">
          <input type="checkbox" checked={shared} disabled={busy} onChange={event => setShared(event.target.checked)} className="mt-0.5 shrink-0 accent-primary" />
          <span>Tôi đã đối chiếu và xác nhận đây là người khác dùng chung số.</span>
        </label>}
      </div>}
    </div>
    {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
    {!target && !create && <p id={reasonId} className="text-sm text-on-surface-variant">Chọn hồ sơ có sẵn hoặc tạo khách mới để tiếp tục.</p>}
    <div className="flex flex-wrap justify-between gap-2">
      <button type="button" className={buttonClass} disabled={busy} onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" />Về đợt chuyển</button>
      <button type="button" disabled={!canSave} aria-describedby={!target && !create ? reasonId : undefined} className={primaryCreateButtonClass} onClick={() => void save()}>
        {busy ? "Đang lưu…" : create ? "Tạo và liên kết" : "Xác nhận liên kết"}
      </button>
    </div>
  </ErpModal>;
}
