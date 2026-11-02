import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { apiFetch } from '../../modules/shared/lib/apiFetch';
import type { StockLog } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function StockLogReversalControl({ log }: { log: StockLog }) {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode || '';
  const canManage = ['admin', 'superadmin'].includes(userProfile?.role || '') || hasPermission('inventory:manage');
  const record = log as StockLog & { refType?: string; refId?: string; reversalId?: string; reversalOf?: string };
  if (!canManage || !companyCode || !activeBranchId || record.refType || record.refId || record.reversalOf || log.type !== 'xuất' || !['nội bộ', 'hủy'].includes(log.purpose || '') || !['Thành công', 'Hoàn thành'].includes(log.status)) return null;
  return <ReversalForm key={`${companyCode}:${activeBranchId}:${log.id}`} id={log.id} companyCode={companyCode} branchId={activeBranchId} reversed={Boolean(record.reversalId)} />;
}

function ReversalForm({ id, companyCode, branchId, reversed }: { id: string; companyCode: string; branchId: string; reversed: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(reversed);
  const [error, setError] = useState('');
  const action = 'min-h-10 rounded-lg border border-outline-variant px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
  async function reverse() {
    if (busy || !reason.trim()) return;
    setBusy(true); setError('');
    try {
      await apiFetch(`/inventory/stock-logs/${encodeURIComponent(id)}/reverse`, { method: 'POST', params: { companyCode, branchId }, body: JSON.stringify({ reason: reason.trim() }) });
      setDone(true); setOpen(false); setConfirm(false);
    } catch (cause) { setConfirm(false); setError(cause instanceof Error ? cause.message : 'Không thể đảo phiếu. Kiểm tra dữ liệu gốc và thử lại.'); }
    finally { setBusy(false); }
  }
  if (done || reversed) return <span role="status" className="text-sm text-on-surface-variant">Đã đảo phiếu</span>;
  return <div className="space-y-2 [--color-on-surface-variant:var(--color-slate-600)]">
    {!open ? <button type="button" className={action} onClick={() => setOpen(true)}>Đảo phiếu</button> : <div className="w-full space-y-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 sm:max-w-sm">
      <label className="block text-sm">Lý do đảo phiếu<input autoFocus required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>
      <p className="text-pretty text-sm text-on-surface-variant">Hoàn nguyên phiếu xuất nội bộ/hủy hàng khi chứng từ, giá vốn và đơn vị hàng còn khớp. Phiếu gốc vẫn được lưu.</p>
      {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!reason.trim() || busy} className={action} onClick={() => setConfirm(true)}>Tiếp tục</button><button type="button" disabled={busy} className={action} onClick={() => setOpen(false)}>Bỏ qua</button></div>
    </div>}
    <ConfirmDialog isOpen={confirm} title="Đảo phiếu xuất kho" description={`Lập chứng từ hoàn tồn từ phiếu gốc. Lý do: ${reason.trim()}`} confirmLabel="Xác nhận đảo phiếu" isSubmitting={busy} onClose={() => setConfirm(false)} onConfirm={reverse} />
  </div>;
}
