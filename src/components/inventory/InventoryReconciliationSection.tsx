import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ClipboardCheck, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { cn } from '../../modules/student-management/lib/utils';
import { inventoryReconciliationService, type AuditWarehouse, type InventoryAuditResult, type ReconciliationScope } from '../../services/inventoryReconciliationService';

const field = 'min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant px-4 text-sm font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';

function AuditWorkspace({ scope }: { scope: ReconciliationScope }) {
  const [warehouses, setWarehouses] = useState<AuditWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [baseline, setBaseline] = useState<unknown>();
  const [baselineName, setBaselineName] = useState('');
  const [readingBaseline, setReadingBaseline] = useState(false);
  const baselineRead = useRef(0);
  const baselineInput = useRef<HTMLInputElement>(null);
  const [ledgerComplete, setLedgerComplete] = useState(false);
  const [result, setResult] = useState<InventoryAuditResult | null>(null);
  const [severity, setSeverity] = useState('all');
  const runController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void inventoryReconciliationService.warehouses(scope, controller.signal)
      .then(setWarehouses)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách kho.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); runController.current?.abort(); baselineRead.current = 0; };
  }, [scope]);

  async function run(event: FormEvent) {
    event.preventDefault();
    if (running || readingBaseline) return;
    runController.current?.abort();
    const controller = new AbortController();
    runController.current = controller;
    setRunning(true); setError(''); setResult(null);
    try {
      const report = await inventoryReconciliationService.run(scope, { warehouseId: warehouseId || undefined, baseline, ledgerComplete }, controller.signal);
      if (!controller.signal.aborted) { setResult(report); setSeverity('all'); }
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Đối soát chưa hoàn tất. Hãy thử lại theo từng kho.'); }
    finally { if (!controller.signal.aborted) setRunning(false); }
  }

  async function readBaseline(file?: File) {
    const readId = ++baselineRead.current;
    setError(''); setBaseline(undefined); setBaselineName(''); setResult(null);
    setReadingBaseline(Boolean(file));
    if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error('Tệp tồn đầu kỳ tối đa 512 KB. Hãy chia theo từng kho nếu dữ liệu lớn hơn.');
      const parsed: unknown = JSON.parse(await file.text());
      if (readId !== baselineRead.current) return;
      setBaseline(parsed); setBaselineName(file.name); setLedgerComplete(false);
    } catch (cause) { if (readId === baselineRead.current) setError(cause instanceof Error ? cause.message : 'Không đọc được tệp JSON tồn đầu kỳ.'); }
    finally { if (readId === baselineRead.current) setReadingBaseline(false); }
  }

  function download() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `doi-soat-kho-${scope.companyCode}-${result.checkedAt.slice(0, 10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const rows = result?.findings.filter((finding) => severity === 'all' || finding.severity === severity) || [];
  const warehouseName = (id?: string) => warehouses.find((warehouse) => warehouse._id === id)?.name || id || '—';
  const summary = result?.summary;

  return <section className="space-y-5 text-on-surface [--color-on-surface-variant:var(--color-slate-600)]" aria-labelledby="inventory-audit-title">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="inventory-audit-title" className="flex items-center gap-2 text-balance text-xl font-semibold"><ClipboardCheck className="size-5 text-primary" aria-hidden="true" />Đối soát tồn kho</h2><p className="mt-1 max-w-3xl text-pretty text-sm text-on-surface-variant">Kiểm tra số lượng, giá trị tồn, chứng từ và các đơn vị hàng được theo dõi riêng tại cùng một thời điểm. Báo cáo dùng chung cho các loại hàng hóa.</p></div>
      {result && <button type="button" onClick={download} className={button}><Download className="size-4" aria-hidden="true" />Tải báo cáo</button>}
    </header>
    <form onSubmit={(event) => void run(event)} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-busy={running}>
      <label className="block max-w-xl text-sm font-medium">Phạm vi kiểm tra<select className={cn(field, 'mt-1.5')} value={warehouseId} disabled={loading || running} onChange={(event) => { setWarehouseId(event.target.value); setResult(null); }}><option value="">Tất cả kho trong chi nhánh</option>{warehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}{warehouse.kind === 'transit' ? ' · Đang vận chuyển' : ''}</option>)}</select></label>
      <p className="text-pretty text-sm text-on-surface-variant">Khi chưa có tồn đầu kỳ đã xác nhận, báo cáo sẽ ghi “Cần kiểm tra” thay vì tự coi tồn đầu kỳ bằng 0. Hàng theo số lượng không bắt buộc Serial/IMEI.</p>
      <details className="rounded-lg border border-outline-variant p-3"><summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">Dữ liệu đối chiếu đầu kỳ</summary><div className="mt-3 space-y-3">
        <label className="block text-sm">Tệp tồn đầu kỳ đã xác nhận (JSON)<input ref={baselineInput} type="file" accept="application/json,.json" disabled={running} onChange={(event) => void readBaseline(event.target.files?.[0])} className={cn(field, 'mt-1.5')} /></label>
        {readingBaseline && <p role="status" className="text-sm text-on-surface-variant">Đang đọc dữ liệu tồn đầu kỳ…</p>}
        {baselineName && <div className="flex flex-wrap items-center gap-3 text-sm"><span>{baselineName}</span><button type="button" disabled={running} onClick={() => { baselineRead.current++; setReadingBaseline(false); setBaseline(undefined); setBaselineName(''); setResult(null); if (baselineInput.current) baselineInput.current.value = ''; }} className={button}>Bỏ tệp</button></div>}
        <label className="flex items-start gap-2 text-pretty text-sm"><input type="checkbox" checked={ledgerComplete} disabled={running || readingBaseline || Boolean(baseline)} onChange={(event) => { setLedgerComplete(event.target.checked); setResult(null); }} className="mt-1 size-4 accent-primary" /><span>Tôi đã xác nhận sổ kho có đầy đủ lịch sử, bao gồm tồn đầu kỳ. Dùng sổ kho làm nguồn đối chiếu.</span></label>
        <p className="text-pretty text-sm text-on-surface-variant">Tệp gồm schemaVersion: 1, companyCode, asOf (UTC) và balances. Mỗi dòng cần branchId, warehouseId, productId, variantId nếu có, sku, quantity và value. Không lấy số tồn hiện tại để tự tạo tồn đầu kỳ.</p>
      </div></details>
      {error && <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{error}</p>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={running || loading || readingBaseline} className={cn(button, 'border-primary bg-primary text-on-primary')}><RefreshCw className="size-4" aria-hidden="true" />{running ? 'Đang đối soát…' : 'Chạy đối soát'}</button><p className="text-pretty text-sm text-on-surface-variant">Chỉ đọc dữ liệu. Không tự điều chỉnh tồn hoặc ghi chứng từ.</p></div>
      {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải phạm vi kho…</p>}
      {running && <p role="status" className="text-pretty text-sm text-on-surface-variant">Đang đối chiếu dữ liệu. Nếu phạm vi lớn, hãy kiểm tra từng kho.</p>}
    </form>
    {summary && result && <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-labelledby="audit-results-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="audit-results-title" className="text-balance text-lg font-semibold">{summary.status === 'clean' ? 'Chưa phát hiện chênh lệch trong phạm vi đã kiểm tra' : summary.status === 'issues' ? 'Có chênh lệch cần xử lý' : 'Có dữ liệu cần kiểm tra thêm'}</h3><p className="mt-1 text-sm text-on-surface-variant">{summary.scope.warehouseId ? warehouseName(summary.scope.warehouseId) : 'Tất cả kho trong chi nhánh'} · {new Date(result.checkedAt).toLocaleString('vi-VN')}</p></div><span className="rounded-full bg-surface-container px-3 py-1 text-sm">{summary.complete ? 'Đã hoàn tất' : 'Chưa hoàn tất'}</span></div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ label: 'Bản ghi đã kiểm tra', value: Object.values(summary.examined).reduce((total, count) => total + count, 0) }, { label: 'Lỗi / chênh lệch', value: summary.errors }, { label: 'Cần kiểm tra', value: summary.reviews }].map((item) => <div key={item.label} className="rounded-lg border border-outline-variant p-3"><dt className="text-sm text-on-surface-variant">{item.label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{item.value.toLocaleString('vi-VN')}</dd></div>)}</dl>
      <label className="block max-w-xs text-sm">Lọc kết quả<select className={cn(field, 'mt-1')} value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">Tất cả</option><option value="error">Lỗi / chênh lệch</option><option value="review">Cần kiểm tra</option></select></label>
      {result.truncated && <p className="text-pretty text-sm text-on-surface-variant">Hiển thị tối đa 500 phát hiện đầu tiên. Các số tổng bao gồm toàn bộ phạm vi đã chạy; chọn từng kho để xem chi tiết còn lại.</p>}
      {rows.length ? <div className="overflow-x-auto rounded-lg border border-outline-variant"><table className="w-full min-w-2xl text-left text-sm"><caption className="sr-only">Các chênh lệch và dữ liệu cần kiểm tra</caption><thead className="bg-surface-container"><tr>{['Mức độ', 'SKU / chứng từ', 'Kho', 'Nội dung'].map((label) => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map((finding, index) => <tr key={`${finding.code}-${finding.documentId}-${index}`} className="border-t border-outline-variant align-top"><td className="p-3">{finding.severity === 'error' ? 'Lỗi / chênh lệch' : 'Cần kiểm tra'}</td><td className="max-w-48 break-all p-3 font-mono text-xs">{finding.sku || finding.documentId || '—'}</td><td className="max-w-48 break-words p-3">{warehouseName(finding.warehouseId)}</td><td className="max-w-xl p-3"><p className="text-pretty">{finding.message}</p>{finding.details && <details className="mt-2"><summary className="cursor-pointer text-on-surface-variant">Số liệu đối chiếu</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-surface p-2 text-xs tabular-nums">{JSON.stringify(finding.details, null, 2)}</pre></details>}</td></tr>)}</tbody></table></div> : <p className="text-pretty text-sm text-on-surface-variant">{summary.findings ? 'Không có phát hiện thuộc bộ lọc đang chọn.' : 'Không có phát hiện trong phạm vi đã kiểm tra.'}</p>}
    </section>}
    {!result && !running && <div className="rounded-xl border border-dashed border-outline-variant p-6 text-center"><p className="text-pretty text-sm text-on-surface-variant">Chọn phạm vi kho rồi chạy đối soát để xem kết quả.</p></div>}
  </section>;
}

export function InventoryReconciliationSection() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode || '';
  const canRead = ['admin', 'superadmin'].includes(userProfile?.role || '') || hasPermission('inventory:read') || hasPermission('inventory:manage');
  if (!canRead) return <p role="alert" className="text-sm text-on-surface-variant">Bạn chưa có quyền xem đối soát kho.</p>;
  if (!companyCode || !activeBranchId) return <p role="status" className="text-sm text-on-surface-variant">Chọn doanh nghiệp và chi nhánh để đối soát tồn kho.</p>;
  return <ScopedAudit key={`${companyCode}:${activeBranchId}`} companyCode={companyCode} branchId={activeBranchId} />;
}

function ScopedAudit({ companyCode, branchId }: ReconciliationScope) {
  const [scope] = useState(() => ({ companyCode, branchId }));
  return <AuditWorkspace scope={scope} />;
}
