import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { customerApi } from '../customer-management/customerApi';
import { repairService } from '../../services/repairService';
import type { RepairCreatePrefill } from './RepairBoardPage';
import { cn } from '../student-management/lib/utils';

const field = 'mt-1.5 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary';
const button = 'min-h-11 rounded-lg border border-outline-variant px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
type Choice = { customerId: string; customerCode: string; name: string; phone: string };
type Pending = { idempotencyKey: string; payload: Record<string, unknown> };

export function RepairIntakeAction({ onCreated, label = 'Tạo phiếu tiếp nhận', className }: { onCreated: () => void; label?: string; className?: string }) {
  const { userProfile, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  if (!['admin', 'superadmin'].includes(userProfile?.role || '') && !hasPermission('repair:manage')) return null;
  return <><button type="button" onClick={() => setOpen(true)} className={cn(button, 'border-primary bg-primary text-on-primary', className)}>{label}</button>{open && <GeneralRepairIntakeDialog onClose={() => setOpen(false)} onCreated={() => { setOpen(false); onCreated(); }} />}</>;
}

export default function GeneralRepairIntakeDialog(props: { prefill?: RepairCreatePrefill; onClose: () => void; onCreated: () => void }) {
  const { user, userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode || '';
  const permitted = ['admin', 'superadmin'].includes(userProfile?.role || '') || hasPermission('repair:manage');
  if (!permitted || !companyCode || !activeBranchId) return <p role="alert" className="text-sm text-error">Chọn chi nhánh và tài khoản có quyền tiếp nhận sửa chữa.</p>;
  return <Intake key={`${companyCode}:${activeBranchId}`} {...props} companyCode={companyCode} storageKey={`igen.repair-intake:${companyCode}:${activeBranchId}:${user?.uid || userProfile?.email || ''}`} />;
}

function Intake({ prefill, onClose, onCreated, companyCode, storageKey }: { prefill?: RepairCreatePrefill; onClose: () => void; onCreated: () => void; companyCode: string; storageKey: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(prefill?.customerPhone || prefill?.customerName || '');
  const search = useDebouncedValue(query, 250);
  const [lookup, setLookup] = useState<{ key: string; items: Choice[]; error?: string }>({ key: '\0', items: [] });
  const [customerId, setCustomerId] = useState(prefill?.customerId || '');
  const [kind, setKind] = useState<'service' | 'warranty'>(prefill?.ticketType || (prefill?.coverage.customer.covered ? 'warranty' : 'service'));
  const [subjectType, setSubjectType] = useState(prefill?.productId ? 'product' : 'equipment');
  const [source, setSource] = useState(prefill?.intakeSource || (prefill?.serialNumber ? 'company_sale' : 'external'));
  const [name, setName] = useState(prefill?.productName || '');
  const [serial, setSerial] = useState(prefill?.serialNumber || '');
  const [condition, setCondition] = useState('');
  const [symptom, setSymptom] = useState('');
  const [reference, setReference] = useState('');
  const [endDate, setEndDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const sending = useRef(false);
  const [pending, setPending] = useState<Pending | null>(() => {
    try { const parsed = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Pending | null; return parsed?.idempotencyKey && parsed.payload && typeof parsed.payload === 'object' ? parsed : null; } catch { return null; }
  });
  const searching = lookup.key !== search;
  const items = useMemo(() => {
    const choices = [...lookup.items];
    if (prefill?.customerId && !choices.some((item) => item.customerId === prefill.customerId || item.customerCode === prefill.customerId)) choices.unshift({ customerId: prefill.customerId, customerCode: prefill.customerId, name: prefill.customerName || 'Khách hàng đã chọn', phone: prefill.customerPhone || '' });
    return choices;
  }, [lookup.items, prefill]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); trigger?.focus(); };
  }, []);
  useEffect(() => {
    let active = true;
    void customerApi.searchActive({ companyCode, q: search, limit: 10 })
      .then((result) => { if (active) { setLookup({ key: search, items: result }); setCustomerId((current) => result.find((item) => item.customerCode === current)?.customerId || current); } })
      .catch((cause: unknown) => { if (active) setLookup({ key: search, items: [], error: cause instanceof Error ? cause.message : 'Không tìm được khách hàng.' }); });
    return () => { active = false; };
  }, [companyCode, search]);

  async function send(attempt: Pending) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setCanEdit(false);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt)); setPending(attempt);
      await repairService.create({ ...attempt.payload, idempotencyKey: attempt.idempotencyKey });
      sessionStorage.removeItem(storageKey); setPending(null); onCreated();
    } catch (cause) {
      const { status, code } = cause as { status?: number; code?: string };
      setCanEdit(Boolean(status && ([400, 403, 404, 422].includes(status) || (status === 409 && code !== 'REPAIR_REQUEST_KEY_CONFLICT'))));
      setError(cause instanceof Error ? cause.message : 'Chưa xác định được kết quả tiếp nhận. Hãy thử lại yêu cầu trước.');
    } finally { sending.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || busy) return;
    const payload = { ticketType: kind, subjectType, intakeSource: source, customerId, device: { name, serialNumber: serial || undefined, productId: source === 'company_sale' ? prefill?.productId : undefined, condition, accessories: [] }, symptom,
      ...(kind === 'warranty' && source === 'external' ? { warrantyEvidence: { reference, endAt: endDate ? new Date(`${endDate}T23:59:59+07:00`).toISOString() : '', confirmed } } : {}) };
    await send({ idempotencyKey: crypto.randomUUID(), payload });
  }
  return <dialog ref={dialogRef} aria-labelledby="general-repair-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/50 [--color-on-surface-variant:var(--color-slate-600)]">
    <form onSubmit={(event) => void submit(event)} className="space-y-5 p-4 sm:p-6" aria-busy={busy}>
      <header className="flex items-start justify-between gap-3"><div><h2 id="general-repair-title" className="text-balance text-xl font-semibold">Tiếp nhận sửa chữa / bảo hành</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tiếp nhận sản phẩm, thiết bị hoặc hạng mục dịch vụ. Mã định danh là tùy chọn khi tiếp nhận từ bên ngoài.</p></div><button type="button" onClick={onClose} disabled={busy} className={button}>Đóng</button></header>
      {error && <p role="alert" className="rounded-lg border border-error p-3 text-pretty text-sm text-error">{error}</p>}
      {pending && <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container p-3"><p className="text-pretty text-sm">Yêu cầu trước đang được giữ để kiểm tra lại kết quả và tránh tạo phiếu trùng.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void send(pending)} className={button}>{busy ? 'Đang kiểm tra…' : 'Thử lại yêu cầu trước'}</button>{canEdit && <button type="button" onClick={() => { sessionStorage.removeItem(storageKey); setPending(null); setError(''); }} className={button}>Chỉnh sửa yêu cầu</button>}</div></div>}
      <fieldset disabled={busy || Boolean(pending)} className="space-y-4 disabled:opacity-70">
        <legend className="sr-only">Thông tin tiếp nhận</legend>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Loại phiếu<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={field}><option value="service">Dịch vụ sửa chữa</option><option value="warranty">Bảo hành</option></select></label><label className="text-sm">Đối tượng<select value={subjectType} onChange={(event) => { setSubjectType(event.target.value); if (event.target.value === 'service') setSource('external'); }} className={field}><option value="equipment">Thiết bị</option><option value="product">Sản phẩm</option><option value="service">Hạng mục dịch vụ</option></select></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Tìm khách hàng<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, mã hoặc số điện thoại" className={field} /></label><label className="text-sm">Khách hàng<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)} className={field}><option value="">Chọn hồ sơ khách hàng</option>{items.map((item) => <option key={item.customerId} value={item.customerId}>{item.customerCode} · {item.name} · {item.phone}</option>)}</select></label></div>
        {searching && <p role="status" className="text-sm text-on-surface-variant">Đang tìm khách hàng…</p>}
        {!searching && lookup.error && <p role="alert" className="text-sm text-error">{lookup.error}</p>}
        {!searching && !lookup.error && !items.length && <p className="text-pretty text-sm text-on-surface-variant">Chưa có hồ sơ phù hợp. Tạo hồ sơ tại mục Khách hàng rồi quay lại chọn.</p>}
        <label className="block text-sm">Nguồn tiếp nhận<select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className={field}><option value="external">Khách mang đến / dịch vụ bên ngoài</option>{subjectType !== 'service' && <option value="company_sale">Liên kết hàng đã bán trong hệ thống</option>}</select></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Tên đối tượng / hạng mục<input required maxLength={300} value={name} onChange={(event) => setName(event.target.value)} className={field} /></label><label className="text-sm">Serial / mã định danh {source === 'external' ? '(nếu có)' : '(bắt buộc)'}<input required={source === 'company_sale'} maxLength={200} value={serial} onChange={(event) => setSerial(event.target.value)} className={field} /></label></div>
        <label className="block text-sm">Tình trạng khi tiếp nhận<textarea required maxLength={2000} rows={2} value={condition} onChange={(event) => setCondition(event.target.value)} className={field} /></label>
        <label className="block text-sm">Mô tả lỗi / yêu cầu thực hiện<textarea required maxLength={5000} rows={3} value={symptom} onChange={(event) => setSymptom(event.target.value)} className={field} /></label>
        {kind === 'warranty' && source === 'external' && <section className="space-y-3 rounded-lg border border-outline-variant p-3" aria-labelledby="warranty-evidence-title"><h3 id="warranty-evidence-title" className="text-balance font-semibold">Xác minh bảo hành</h3><p className="text-pretty text-sm text-on-surface-variant">Kiểm tra hợp đồng, hóa đơn hoặc phiếu bảo hành trước khi xác nhận quyền lợi.</p><label className="block text-sm">Chứng từ / điều kiện áp dụng<input required maxLength={500} value={reference} onChange={(event) => setReference(event.target.value)} className={field} /></label><label className="block text-sm">Bảo hành đến ngày (giờ Việt Nam)<input required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={field} /></label><label className="flex items-start gap-2 text-sm"><input required type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 accent-primary" /><span>Tôi đã kiểm tra chứng từ và thời hạn bảo hành. Xác nhận này được lưu cùng người tiếp nhận.</span></label></section>}
        <footer className="flex justify-end border-t border-outline-variant pt-4"><button type="submit" disabled={busy || searching || Boolean(lookup.error)} className={cn(button, 'border-primary bg-primary text-on-primary')}>Tạo phiếu tiếp nhận</button></footer>
      </fieldset>
    </form>
  </dialog>;
}
