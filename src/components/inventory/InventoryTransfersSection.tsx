import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { apiFetch } from "../../modules/shared/lib/apiFetch";
import { inventoryReceivingService, type InventoryBalance, type Warehouse } from "../../services/inventoryReceivingService";
import { ConfirmDialog } from "../common/ConfirmDialog";

type TransferItem = { variantId: string; quantity: number; serialNumbers: string };
type Transfer = { _id: string; code: string; status: "in_transit" | "received" | "cancelled" | "reversed"; fromBranchId: string; fromWarehouseId: string; toBranchId: string; toWarehouseId: string; items: Array<{ sku: string; quantity: number; serialUnitIds: string[] }>; reason: string; createdAt: string };
type Difference = { sku: string; balanceQuantity: number; ledgerQuantity: number; ledgerDifference: number; serialCount?: number; serialDifference: number | null };
type Reconciliation = { checkedAt: string; checkedProducts: number; differenceCount: number; differences: Difference[] };
const field = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
const actionClass = "min-h-10 rounded-lg border border-outline px-3 text-sm text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const statusText: Record<Transfer["status"], string> = { in_transit: "Đang chuyển", received: "Đã nhận", cancelled: "Đã hủy", reversed: "Đã đảo" };

export function InventoryTransfersSection() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId, branches } = useBranch();
  const companyCode = userProfile?.companyCode || "";
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("inventory:manage");
  const scope = useMemo(() => ({ companyCode, branchId: activeBranchId }), [companyCode, activeBranchId]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ variantId: "", quantity: 1, serialNumbers: "" }]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [pending, setPending] = useState<{ id: string; action: "cancel" | "reverse" } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  async function load() {
    if (!companyCode || !activeBranchId) return;
    setLoading(true); setError("");
    try {
      const [warehouseResponse, transferResponse] = await Promise.all([
        apiFetch<{ data: Warehouse[] }>("/inventory/transfers/warehouses", { params: scope }),
        apiFetch<{ data: Transfer[] }>("/inventory/transfers", { params: scope }),
      ]);
      setWarehouses(warehouseResponse.data); setTransfers(transferResponse.data);
      setFromWarehouseId((current) => warehouseResponse.data.some((warehouse) => warehouse._id === current && warehouse.branchId === activeBranchId)
        ? current : warehouseResponse.data.find((warehouse) => warehouse.branchId === activeBranchId)?._id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được phiếu điều chuyển."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [companyCode, activeBranchId, canManage]);
  useEffect(() => {
    if (!createOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); trigger?.focus(); };
  }, [createOpen]);
  useEffect(() => {
    if (!fromWarehouseId) { setBalances([]); return; }
    let active = true;
    void inventoryReceivingService.listBalances(fromWarehouseId).then((value) => { if (active) setBalances(value.filter((balance) => balance.variantId && balance.quantity > balance.reservedQuantity)); })
      .catch(() => { if (active) setBalances([]); });
    return () => { active = false; };
  }, [fromWarehouseId]);
  const sourceWarehouses = warehouses.filter((warehouse) => warehouse.branchId === activeBranchId);
  const destinationWarehouses = warehouses.filter((warehouse) => warehouse._id !== fromWarehouseId);
  const warehouseLabel = (id: string) => { const warehouse = warehouses.find((item) => item._id === id); const branch = branches.find((item) => item._id === warehouse?.branchId); return warehouse ? `${warehouse.name} · ${branch?.name || warehouse.branchId}` : id; };
  const lineTrackingMode = (item: TransferItem) => balances.find((balance) => balance.variantId === item.variantId)?.trackingMode;
  const tracksUnits = (item: TransferItem) => ["serial", "unit_barcode"].includes(lineTrackingMode(item) || "");
  const updateLine = (index: number, patch: Partial<TransferItem>) => setItems((current) => current.map((item, position) => position === index ? { ...item, ...patch, ...(patch.variantId !== undefined ? { serialNumbers: "" } : {}) } : item));
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!toWarehouseId || !fromWarehouseId) throw new Error("Vui lòng chọn kho gửi và kho nhận.");
      const destination = warehouses.find((warehouse) => warehouse._id === toWarehouseId);
      if (!destination) throw new Error("Kho nhận không hợp lệ.");
      const payload = { fromWarehouseId, toWarehouseId, toBranchId: destination.branchId, reason, items: items.map((item) => ({
        variantId: item.variantId, quantity: item.quantity, serialNumbers: tracksUnits(item) ? item.serialNumbers.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean) : [],
      })) };
      const fingerprint = JSON.stringify({ scope, payload });
      const key = requestAttempt.current?.fingerprint === fingerprint ? requestAttempt.current.key : crypto.randomUUID();
      requestAttempt.current = { fingerprint, key };
      await apiFetch("/inventory/transfers", { method: "POST", params: scope, body: JSON.stringify({ ...payload, idempotencyKey: key }) });
      requestAttempt.current = null;
      setReason(""); setItems([{ variantId: "", quantity: 1, serialNumbers: "" }]); setMessage("Đã tạo phiếu điều chuyển. Kho nhận cần xác nhận."); setCreateOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tạo được phiếu điều chuyển."); }
    finally { setBusy(false); }
  }
  async function receive(id: string) {
    setBusy(true); setError(""); setMessage("");
    try { await apiFetch(`/inventory/transfers/${id}/receive`, { method: "POST", params: scope }); setMessage("Đã xác nhận nhận hàng."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không nhận được phiếu."); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!pending || !actionReason.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await apiFetch(`/inventory/transfers/${pending.id}/${pending.action}`, { method: "POST", params: scope, body: JSON.stringify({ reason: actionReason.trim() }) });
      setMessage(pending.action === "cancel" ? "Đã hủy phiếu điều chuyển." : "Đã đảo phiếu điều chuyển.");
      setPending(null); setConfirmOpen(false); setActionReason(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xử lý được phiếu."); }
    finally { setBusy(false); }
  }
  async function checkReconciliation() {
    if (!fromWarehouseId) return;
    setError("");
    try { const response = await apiFetch<{ data: Reconciliation }>("/inventory/transfers/reconciliation", { params: { ...scope, warehouseId: fromWarehouseId } }); setReconciliation(response.data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không đối soát được kho."); }
  }
  return <section className="space-y-6 text-on-surface" aria-labelledby="transfer-title">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="transfer-title" className="text-balance text-xl font-semibold">Điều chuyển và đối soát kho</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Chuyển hàng giữa các kho và xác nhận nhận hàng.</p></div>{canManage && <button type="button" onClick={() => { setError(""); setCreateOpen(true); }} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary">Tạo phiếu điều chuyển</button>}</header>
    {error && <p role="alert" className="rounded-lg border border-error p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {canManage && createOpen && <dialog ref={dialogRef} aria-labelledby="create-transfer-title" onCancel={(event) => { event.preventDefault(); if (!busy) setCreateOpen(false); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/50">
    <form onSubmit={(event) => void create(event)} className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h3 id="create-transfer-title" className="text-balance text-lg font-semibold">Tạo phiếu điều chuyển</h3><button type="button" onClick={() => setCreateOpen(false)} disabled={busy} aria-label="Đóng phiếu điều chuyển" className={actionClass}>Đóng</button></div>
      {error && <p role="alert" className="rounded-lg border border-error p-3 text-pretty text-sm text-error">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Kho gửi<select required value={fromWarehouseId} onChange={(event) => setFromWarehouseId(event.target.value)} className={field}><option value="">Chọn kho gửi</option>{sourceWarehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouse.name}</option>)}</select></label>
        <label className="text-sm">Kho nhận<select required value={toWarehouseId} onChange={(event) => setToWarehouseId(event.target.value)} className={field}><option value="">Chọn kho nhận</option>{destinationWarehouses.map((warehouse) => <option key={warehouse._id} value={warehouse._id}>{warehouseLabel(warehouse._id)}</option>)}</select></label></div>
      <div className="space-y-3">{items.map((item, index) => <div key={index} className={`grid gap-3 rounded-lg border border-outline-variant p-3 sm:items-end ${tracksUnits(item) ? "sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_7rem_auto]"}`}>
        <label className="text-sm">SKU<select required value={item.variantId} onChange={(event) => updateLine(index, { variantId: event.target.value })} className={field}><option value="">Chọn SKU</option>{balances.map((balance) => <option key={balance._id} value={balance.variantId}>{balance.sku} · Còn {balance.quantity - balance.reservedQuantity}</option>)}</select></label>
        <label className="text-sm">Số lượng<input required type="number" min={1} step={1} value={item.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className={field} /></label>
        {tracksUnits(item) && <label className="text-sm">{lineTrackingMode(item) === "serial" ? "Số sê-ri của hàng chuyển" : "Mã đơn vị của hàng chuyển"}<textarea required rows={2} value={item.serialNumbers} onChange={(event) => updateLine(index, { serialNumbers: event.target.value })} placeholder="Mỗi mã một dòng" className={field} /></label>}
        <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, position) => position !== index))} className={actionClass}>Xóa dòng</button>
      </div>)}</div>
      <button type="button" onClick={() => setItems((current) => [...current, { variantId: "", quantity: 1, serialNumbers: "" }])} className={actionClass}>Thêm dòng hàng</button>
      <label className="block text-sm">Lý do điều chuyển<input required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={field} /></label>
      <button type="submit" disabled={busy || loading} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Tạo phiếu</button>
    </form></dialog>}
    <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6"><h3 className="text-balance text-lg font-semibold">Phiếu điều chuyển</h3>
      {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải phiếu...</p>}
      <ul className="space-y-2">{transfers.map((transfer) => <li key={transfer._id} className="rounded-lg border border-outline-variant p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{transfer.code}</strong> · {statusText[transfer.status]}<p className="text-pretty text-on-surface-variant">{warehouseLabel(transfer.fromWarehouseId)} → {warehouseLabel(transfer.toWarehouseId)} · {transfer.items.map((item) => `${item.sku} × ${item.quantity}`).join(", ")}</p></div><div className="flex flex-wrap gap-2">
        {canManage && transfer.status === "in_transit" && transfer.toBranchId === activeBranchId && <button type="button" disabled={busy} onClick={() => void receive(transfer._id)} className={actionClass}>Xác nhận nhận</button>}
        {canManage && transfer.status === "in_transit" && transfer.fromBranchId === activeBranchId && <button type="button" disabled={busy} onClick={() => { setPending({ id: transfer._id, action: "cancel" }); setConfirmOpen(false); setActionReason(""); }} className={actionClass}>Hủy phiếu</button>}
        {canManage && transfer.status === "received" && transfer.toBranchId === activeBranchId && <button type="button" disabled={busy} onClick={() => { setPending({ id: transfer._id, action: "reverse" }); setConfirmOpen(false); setActionReason(""); }} className={actionClass}>Đảo phiếu</button>}
      </div></div></li>)}</ul>
      {!loading && !transfers.length && <p className="text-pretty text-sm text-on-surface-variant">{canManage ? "Chưa có phiếu. Chọn Tạo phiếu điều chuyển để bắt đầu." : "Chưa có phiếu điều chuyển trong chi nhánh này."}</p>}
    </div>
    {canManage && <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6"><h3 className="text-balance text-lg font-semibold">Đối soát kho gửi</h3><button type="button" disabled={!fromWarehouseId} onClick={() => void checkReconciliation()} className={actionClass}>Kiểm tra tồn và sổ kho</button>
      {reconciliation && <><p className="text-sm">Đã kiểm {reconciliation.checkedProducts} SKU · {reconciliation.differenceCount} chênh lệch.</p><ul className="space-y-1">{reconciliation.differences.map((difference) => <li key={difference.sku} className="rounded-lg border border-outline-variant p-2 text-sm">{difference.sku} · Tồn {difference.balanceQuantity} · Sổ {difference.ledgerQuantity}{difference.serialCount !== undefined ? ` · Số đơn vị ${difference.serialCount}` : ""}</li>)}</ul>{!reconciliation.differences.length && <p className="text-sm text-on-surface-variant">Chưa phát hiện chênh lệch.</p>}</>}
    </div>}
    <ConfirmDialog isOpen={confirmOpen} title={pending?.action === "cancel" ? "Hủy phiếu điều chuyển" : "Đảo phiếu điều chuyển"} description={`Lý do: ${actionReason.trim()}`} confirmLabel="Xác nhận" isSubmitting={busy} onClose={() => setConfirmOpen(false)} onConfirm={() => void confirmAction()} />
    {pending && <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><label className="block text-sm">Lý do {pending.action === "cancel" ? "hủy" : "đảo"} phiếu<input autoFocus required maxLength={300} value={actionReason} onChange={(event) => setActionReason(event.target.value)} className={field} /></label><div className="mt-3 flex gap-2"><button type="button" disabled={!actionReason.trim()} onClick={() => setConfirmOpen(true)} className={actionClass}>Tiếp tục</button><button type="button" onClick={() => setPending(null)} className={actionClass}>Bỏ qua</button></div></div>}
  </section>;
}
