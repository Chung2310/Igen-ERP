import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { StyledSelect } from "../../components/common/StyledSelect";
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { repairRefundApi } from './repairRefundApi';
import { readRefundRequest, sameRefundRequest, withRefundRequestLock } from './refundRequestStorage';
import type { RepairTicket } from '../../services/repairService';
import type { RepairRefundInput, RepairRefundSummary, RepairRefundVoucher } from '../../../shared/repair-refund';

const money = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;
const field = 'mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60';
const button = 'min-h-11 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50';

export default function RepairRefundPanel({ ticket, onChanged }: { ticket: RepairTicket; onChanged: () => void }) {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const admin = ['admin', 'superadmin'].includes(userProfile?.role || '');
  const canRead = admin || hasPermission('repair:read') || hasPermission('repair:manage');
  const canManage = admin || (hasPermission('repair:manage') && hasPermission('finance-wallet:manage'));
  if (!canRead || ticket.status !== 'delivered') return null;
  if (!userProfile?.companyCode || !activeBranchId) return <p role="status">Chọn chi nhánh để xem hoàn tiền.</p>;
  return <RefundBody key={`${userProfile.companyCode}:${activeBranchId}:${userProfile.uid}:${ticket._id}`} ticket={ticket} companyCode={userProfile.companyCode} branchId={activeBranchId} userId={userProfile.uid} canManage={canManage} onChanged={onChanged} />;
}

function RefundBody({ ticket, companyCode, branchId, userId, canManage, onChanged }: { ticket: RepairTicket; companyCode: string; branchId: string; userId: string; canManage: boolean; onChanged: () => void }) {
  const scope = useMemo(() => ({ companyCode, branchId }), [companyCode, branchId]);
  const storageKey = `repair-refund:v1:${JSON.stringify([companyCode, branchId, userId, ticket._id])}`;
  const [initial] = useState(() => { try { return { pending: readRefundRequest(storageKey), error: '' }; } catch { return { pending: null, error: 'Không đọc được yêu cầu hoàn đã lưu. Giữ dữ liệu để đối soát trước khi tiếp tục.' }; } });
  const [pending, setPending] = useState(initial.pending);
  const [summary, setSummary] = useState<RepairRefundSummary | null>(null);
  const [vouchers, setVouchers] = useState<RepairRefundVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('');
  const [voucherId, setVoucherId] = useState('');
  const [laborAmount, setLaborAmount] = useState(initial.pending?.laborAmount || 0);
  const [reason, setReason] = useState(initial.pending?.reason || '');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<'post' | 'revoke' | null>(null);
  const [retry, setRetry] = useState(0);
  const active = useRef(true), inFlight = useRef(false);
  const [completed, setCompleted] = useState(false);
  const completedRef = useRef(false);
  const pendingRef = useRef(pending);
  const safeSetPending = useCallback((value: RepairRefundInput | null) => { pendingRef.current = value; setPending(value); }, []);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([repairRefundApi.summary(scope, ticket._id, controller.signal), canManage ? repairRefundApi.vouchers(scope, ticket._id, controller.signal) : Promise.resolve([])])
      .then(([next, eligible]) => { if (!controller.signal.aborted) { setSummary(next); setVouchers(eligible); setError(initial.error); setLoading(false); } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Không tải được khoản hoàn.'); setLoading(false); } });
    return () => controller.abort();
  }, [scope, ticket._id, canManage, retry, initial.error]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      try {
        const stored = readRefundRequest(storageKey);
        if (pendingRef.current && stored && !sameRefundRequest(pendingRef.current, stored)) { setError('Yêu cầu ở tab khác đã thay đổi. Giữ nguyên dữ liệu để đối soát.'); return; }
        if (stored) safeSetPending(stored);
      } catch { setError('Không đọc được yêu cầu từ tab khác. Cần đối soát trước khi tiếp tục.'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey, safeSetPending]);
  const eligibleVouchers = vouchers.filter((item) => item.amount > 0 && item.amount <= (summary?.remaining || 0));
  const voucher = eligibleVouchers.find((item) => item._id === voucherId);
  const amount = pending?.amount ?? voucher?.amount ?? 0;
  const locked = Boolean(initial.error) || busy || loading || Boolean(pending) || completed;
  async function execute(action: 'post' | 'reconcile' | 'revoke') {
    if (inFlight.current || !canManage || initial.error || completedRef.current) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await withRefundRequestLock(storageKey, async () => {
        if (!active.current) return;
        const stored = readRefundRequest(storageKey);
        if (stored && !pendingRef.current) {
          safeSetPending(stored);
          setMessage('Đã khôi phục yêu cầu đang chờ từ tab khác. Hãy đối chiếu hoặc thử lại nguyên yêu cầu này.');
          return;
        }
        const request = pendingRef.current || { amount: voucher?.amount || 0, laborAmount, reason: reason.trim(), reference: voucher?.key || '', idempotencyKey: crypto.randomUUID() };
        if (stored && pendingRef.current && !sameRefundRequest(stored, pendingRef.current)) throw new Error('Yêu cầu trong tab khác không khớp. Không ghi đè yêu cầu đã lưu.');
        if (!Number.isSafeInteger(request.amount) || request.amount <= 0 || !Number.isSafeInteger(request.laborAmount) || request.laborAmount < 0 || request.laborAmount > request.amount || !request.reason || !request.reference) throw new Error('Chọn phiếu chi và nhập phần tiền công, lý do hợp lệ.');
        localStorage.setItem(storageKey, JSON.stringify(request));
        const saved = readRefundRequest(storageKey);
        if (!saved || !sameRefundRequest(saved, request)) throw new Error('Không lưu được yêu cầu. Chưa gửi khoản hoàn.');
        safeSetPending(request);
        const result = await repairRefundApi.submit(scope, ticket._id, action, request);
        if (!['completed', 'revoked', 'not_found'].includes(result.status)) throw new Error('Chưa xác minh được kết quả. Giữ nguyên yêu cầu để đối chiếu.');
        if (result.status === 'not_found') { if (active.current) setMessage('Chưa có bằng chứng ghi nhận. Giữ nguyên yêu cầu; có thể thử lại hoặc thu hồi yêu cầu chưa ghi sổ.'); return; }
        if (result.status === 'completed' && !result.summary) throw new Error('Thiếu kết quả đối soát. Giữ nguyên yêu cầu.');
        const latest = readRefundRequest(storageKey);
        if (latest && !sameRefundRequest(latest, request)) throw new Error('Khoản hoàn đã được xử lý nhưng bản lưu đã thay đổi. Không xóa yêu cầu khác.');
        if (latest) localStorage.removeItem(storageKey);
        completedRef.current = result.status === 'completed';
        if (!active.current) return;
        setCompleted(result.status === 'completed');
        safeSetPending(null);
        if (result.summary) setSummary(result.summary);
        setMessage(result.status === 'completed' ? 'Đã ghi nhận khoản hoàn và liên kết phiếu chi. Không chi tiền thêm lần nữa.' : 'Yêu cầu đã thu hồi. Phiếu chi đã ghi sổ được giữ nguyên; có thể nhập yêu cầu mới.');
        setVoucherId(''); setLaborAmount(0); setReason('');
        if (result.status === 'completed') {
          try { onChanged(); } catch { setMessage('Đã ghi nhận khoản hoàn. Mở lại phiếu để làm mới thông tin.'); }
        }
      });
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : 'Chưa rõ kết quả. Giữ nguyên yêu cầu để đối chiếu.'); }
    finally { inFlight.current = false; if (active.current) { setBusy(false); setConfirmation(null); } }
  }
  function submit(event: FormEvent) { event.preventDefault(); if (!locked) setConfirmation('post'); }
  return <section aria-label="Hoàn tiền sửa chữa" aria-busy={busy || loading} className="mt-4 space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface sm:p-5 [--color-on-surface-variant:var(--color-slate-600)]">
    <div><h3 className="text-balance text-base font-semibold">Hoàn tiền sửa chữa</h3><p className="mt-1 text-pretty text-sm text-on-surface-variant">Ghi nhận khoản hoàn bằng phiếu chi đã duyệt trong Tài chính. Giữ nguyên báo giá và lịch sử thu tiền.</p></div>
    {loading && <p role="status">Đang tải khoản hoàn…</p>}
    {error && <p role="alert" id="repair-refund-error" className="text-pretty text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-pretty text-sm">{message}</p>}
    {!summary && !loading && <button type="button" className={button} onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Thử tải lại</button>}
    {summary && <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Đã thu', summary.paidAmount], ['Đã hoàn', summary.refundedAmount], ['Thực còn lại', summary.netCollected], ['Còn có thể hoàn', summary.remaining]].map(([label, value]) => <div key={label} className="rounded-xl bg-surface-container-low p-3"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{money(Number(value))}</dd></div>)}</dl>
      {!canManage && <p className="text-pretty text-sm text-on-surface-variant">Cần quyền xử lý sửa chữa và quản lý quỹ Tài chính để ghi nhận khoản hoàn.</p>}
      {canManage && completed && summary.remaining > 0 && <button type="button" className={button} onClick={() => { completedRef.current = false; setCompleted(false); setLoading(true); setRetry((value) => value + 1); }}>Thêm khoản hoàn khác</button>}
      {canManage && !completed && <>
        {pending ? <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-3"><p className="text-pretty text-sm">Yêu cầu đang chờ xác minh: <strong className="tabular-nums">{money(pending.amount)}</strong> · Phiếu chi {pending.reference}. Nội dung được giữ nguyên để tránh hoàn trùng.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || Boolean(initial.error)} className={button} onClick={() => void execute('post')}>Thử lại khoản hoàn</button><button type="button" disabled={busy || Boolean(initial.error)} className={button} onClick={() => void execute('reconcile')}>Đối chiếu kết quả</button><button type="button" disabled={busy || Boolean(initial.error)} className={button} onClick={() => setConfirmation('revoke')}>Thu hồi yêu cầu</button></div></div> : summary.remaining > 0 && <form onSubmit={submit} className="space-y-3">
          <p className="text-pretty text-sm text-on-surface-variant">Lập và duyệt phiếu chi với tham chiếu <strong>{ticket.ticketCode}</strong>, rồi chọn phiếu bên dưới. Ngày chi phải từ ngày hoàn tất sửa chữa trở đi.</p>
          <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">Phiếu chi đã duyệt<StyledSelect appearance="erp" required ariaLabel="Phiếu chi đã duyệt" value={voucherId} onChange={setVoucherId} options={[{ value: "", label: "Chọn phiếu chi" }, ...eligibleVouchers.map((item) => ({ value: item._id, label: `${item.key} · ${money(item.amount)} · ${item.occurredOn}` }))]} className={field} /></label>
            <div><p className="text-sm font-medium">Số tiền hoàn</p><p className="mt-2 font-semibold tabular-nums">{money(amount)}</p></div>
            <label className="text-sm font-medium">Trong đó tiền công<input type="number" min={0} step={1} max={Math.min(amount, summary.remainingLabor)} value={laborAmount} onChange={(event) => setLaborAmount(Number(event.target.value))} className={field} required /><span className="mt-1 block text-xs text-on-surface-variant">Tiền công còn lại: {money(summary.remainingLabor)}</span></label>
            <label className="text-sm font-medium sm:col-span-2">Lý do hoàn tiền<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={field} /></label>
          </fieldset>
          {!eligibleVouchers.length && <p className="text-pretty text-sm text-on-surface-variant">Chưa có phiếu chi phù hợp. Sau khi duyệt phiếu chi, bấm tải lại danh sách.</p>}
          {voucher && amount - laborAmount > summary.remainingOther && <p className="text-pretty text-sm text-error">Phần ngoài tiền công vượt số còn lại ({money(summary.remainingOther)}). Kiểm tra lại cách phân bổ tiền công.</p>}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={locked || !voucher || !reason.trim() || amount > summary.remaining || laborAmount > summary.remainingLabor || amount - laborAmount > summary.remainingOther} className={`${button} border-primary bg-primary text-on-primary`}>{busy ? 'Đang ghi nhận…' : 'Ghi nhận khoản hoàn'}</button><button type="button" disabled={busy} className={button} onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Tải lại phiếu chi</button></div>
        </form>}
      </>}
      {summary.refunds.length > 0 && <div className="space-y-2"><h4 className="font-semibold">Các khoản đã hoàn</h4><ul className="space-y-2">{summary.refunds.map((row) => <li key={row.key} className="rounded-xl border border-outline-variant p-3 text-sm"><p className="font-medium tabular-nums">{money(row.amount)} · {new Date(row.at).toLocaleDateString('vi-VN')}</p><p className="mt-1 text-pretty text-on-surface-variant">{row.reason}</p><p className="mt-1 break-words text-xs text-on-surface-variant">Phiếu chi {row.reference} · {row.byName}</p></li>)}</ul></div>}
    </>}
    <ConfirmDialog isOpen={confirmation !== null} isSubmitting={busy} title={confirmation === 'revoke' ? 'Thu hồi yêu cầu hoàn tiền?' : 'Ghi nhận khoản hoàn?'} description={confirmation === 'revoke' ? 'Yêu cầu chưa ghi nhận sẽ bị chặn trên máy chủ. Khoản hoàn và phiếu chi đã ghi sổ được giữ nguyên.' : `Liên kết phiếu chi cho khoản hoàn ${money(amount)}. Thao tác này giữ nguyên lịch sử thu và không chi tiền lần nữa.`} confirmLabel={confirmation === 'revoke' ? 'Thu hồi yêu cầu' : 'Ghi nhận hoàn tiền'} tone="warning" onClose={() => { if (!busy) setConfirmation(null); }} onConfirm={() => void execute(confirmation || 'post')} />
  </section>;
}
