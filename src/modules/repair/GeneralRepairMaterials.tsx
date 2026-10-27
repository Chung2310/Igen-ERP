import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { inventoryReceivingService, type InventoryBalance } from '../../services/inventoryReceivingService';
import { repairService, type RepairTicket } from '../../services/repairService';
import { cn } from '../student-management/lib/utils';
import { wholeVndCharge } from '../../../shared/repair-money';

const field = 'mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary';
const action = 'min-h-11 rounded-lg border border-outline-variant px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
type Pending = { idempotencyKey: string; payload: Record<string, unknown> };

export default function GeneralRepairMaterials({ ticket, onIssued }: { ticket: RepairTicket; onIssued: () => void }) {
  const { user, userProfile } = useAuth();
  const storageKey = `igen.repair-materials:${ticket._id}:${user?.uid || userProfile?.email || ''}`;
  const [inventory, setInventory] = useState<{ items: InventoryBalance[]; warehouses?: Record<string, string>; error?: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [balanceId, setBalanceId] = useState('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cost, setCost] = useState(0);
  const [price, setPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const sending = useRef(false);
  const [pending, setPending] = useState<Pending | null>(() => { try { const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Pending | null; return value?.idempotencyKey && value.payload ? value : null; } catch { return null; } });
  useEffect(() => {
    let active = true;
    void Promise.all([inventoryReceivingService.listBalances(), inventoryReceivingService.listWarehouses()]).then(([items, warehouses]) => { if (active) setInventory({ items: items.filter((item) => item.variantId && item.trackingMode === 'quantity' && item.quantity > item.reservedQuantity), warehouses: Object.fromEntries(warehouses.map((warehouse) => [warehouse._id, warehouse.name])) }); })
      .catch((cause: unknown) => { if (active) setInventory({ items: [], error: cause instanceof Error ? cause.message : 'Không tải được vật tư trong kho.' }); });
    return () => { active = false; };
  }, []);
  const selected = inventory?.items.find((item) => item._id === balanceId);
  async function send(attempt: Pending) {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError(''); setCanEdit(false);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(attempt)); setPending(attempt);
      await repairService.issuePart(ticket._id, { ...attempt.payload, idempotencyKey: attempt.idempotencyKey });
      sessionStorage.removeItem(storageKey); setPending(null); setQuantity(1); setBalanceId(''); onIssued();
      void inventoryReceivingService.listBalances().then((items) => setInventory((current) => ({ ...current, items: items.filter((item) => item.variantId && item.trackingMode === 'quantity' && item.quantity > item.reservedQuantity) }))).catch(() => setError('Đã ghi nhận vật tư; chưa làm mới được danh sách tồn. Hãy mở lại phiếu để xem tồn mới.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa rõ kết quả xuất vật tư. Hãy thử lại yêu cầu trước.');
      const { status, code } = cause as { status?: number; code?: string };
      setCanEdit(Boolean(status && ([400, 403, 404, 422].includes(status) || (status === 409 && code !== 'REPAIR_REQUEST_KEY_CONFLICT' && code !== 'REPAIR_MOVEMENT_UNRECONCILED'))));
    } finally { sending.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || pending || (!manual && !selected)) return;
    if (ticket.coverage.costBearer === 'customer' && wholeVndCharge(quantity * price) === undefined) { setError('Tổng tiền vật tư cần là số nguyên VND. Điều chỉnh đơn giá hoặc số lượng trước khi ghi nhận.'); return; }
    const payload = { manual, productId: manual ? 'manual' : selected!.productId, variantId: manual ? undefined : selected!.variantId, warehouseId: manual ? undefined : selected!.warehouseId, sku: manual ? sku.trim() || 'MATERIAL' : selected!.sku, productName: manual ? name.trim() : selected!.productName || selected!.sku, quantity, unitPrice: price, unitCost: manual ? cost : 0 };
    await send({ idempotencyKey: crypto.randomUUID(), payload });
  }
  return <section className="mt-4 space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-on-surface [--color-on-surface-variant:var(--color-slate-600)]" aria-label="Xuất vật tư sửa chữa">
    <h3 className="text-balance font-semibold">Vật tư và chi phí sử dụng</h3><p className="text-pretty text-sm text-on-surface-variant">Vật tư từ kho lấy giá vốn đã ghi nhận. Hàng theo serial hoặc lô cần quy trình xuất riêng.</p><p className="text-pretty text-sm text-on-surface-variant">Diện chi phí theo phiếu: {ticket.coverage.costBearer === 'supplier' ? 'Nhà cung cấp bảo hành' : ticket.coverage.costBearer === 'shop' ? 'Doanh nghiệp bảo hành' : 'Khách hàng thanh toán'}.</p>
    {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
    {pending && <div className="space-y-2"><p className="text-pretty text-sm">Đang giữ yêu cầu trước để tránh xuất trùng vật tư.</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void send(pending)} className={action}>Thử lại yêu cầu xuất trước</button>{canEdit && <button type="button" onClick={() => { sessionStorage.removeItem(storageKey); setPending(null); setError(''); }} className={action}>Chỉnh sửa yêu cầu</button>}</div></div>}
    <form onSubmit={(event) => void submit(event)} aria-busy={busy}><fieldset disabled={busy || Boolean(pending)} className="space-y-3 disabled:opacity-70"><legend className="sr-only">Nội dung vật tư</legend>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} className="mt-1 size-4 accent-primary" /><span>Vật tư bên ngoài / nhập tay, không trừ kho doanh nghiệp</span></label>
      {manual ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Tên vật tư / hạng mục<input required maxLength={300} value={name} onChange={(event) => setName(event.target.value)} className={field} /></label><label className="text-sm">Mã vật tư (nếu có)<input value={sku} onChange={(event) => setSku(event.target.value)} className={field} /></label></div> : <><label className="block text-sm">Vật tư khả dụng trong kho<select required value={balanceId} onChange={(event) => setBalanceId(event.target.value)} className={field}><option value="">Chọn SKU và kho</option>{inventory?.items.map((item) => <option key={item._id} value={item._id}>{item.productName || item.sku} · {item.sku} · Còn {item.quantity - item.reservedQuantity} · {inventory?.warehouses?.[item.warehouseId] || 'Kho đang chọn'}</option>)}</select></label>{!inventory && <p role="status" className="text-sm">Đang tải vật tư…</p>}{inventory?.error && <p role="alert" className="text-sm text-error">{inventory.error}</p>}</>}
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Số lượng<input required type="number" min={0.000001} step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className={cn(field, 'tabular-nums')} /></label>{manual && <label className="text-sm">Giá vốn<input required type="number" min={0} value={cost} onChange={(event) => setCost(Number(event.target.value))} className={field} /></label>}<label className="text-sm">Đơn giá thu khách<input required type="number" min={0} value={price} onChange={(event) => setPrice(Number(event.target.value))} className={field} /></label></div>
      <button type="submit" disabled={busy || (!manual && !selected)} className={cn(action, 'border-primary bg-primary text-on-primary')}>{manual ? 'Ghi nhận vật tư bên ngoài' : 'Xuất vật tư từ kho'}</button>
    </fieldset></form>
  </section>;
}
