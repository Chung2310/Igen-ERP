import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useBranch } from "../../context/BranchContext";
import { apiFetch } from "../../modules/shared/lib/apiFetch";
import { inventoryReceivingService, type InventoryBalance, type Warehouse } from "../../services/inventoryReceivingService";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { cn } from "../../modules/student-management/lib/utils";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Building2, CheckCircle2, Clock3, FileText, Loader2, Package, Plus, RefreshCw, RotateCcw, Search, Trash2, Truck, X } from "lucide-react";
import { StyledSelect } from "../common/StyledSelect";
import { Dropdown } from "../common/Dropdown";
import { TablePagination } from "../common/TablePagination";

type TransferItem = { variantId: string; quantity: number; serialNumbers: string };
type TransferBranch = { _id: string; code: string; name: string };
type Transfer = { _id: string; code: string; status: "in_transit" | "received" | "cancelled" | "reversed"; fromBranchId: string; fromWarehouseId: string; toBranchId: string; toWarehouseId: string; items: Array<{ sku: string; quantity: number; serialUnitIds: string[] }>; reason: string; createdAt: string };
const field = "min-h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const actionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const primaryActionClass = cn(actionClass, "border-primary bg-primary text-on-primary hover:bg-primary/90");
const statusText: Record<Transfer["status"], string> = { in_transit: "Đang chuyển", received: "Đã nhận", cancelled: "Đã hủy", reversed: "Đã đảo" };

export function InventoryTransfersSection() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  if (!userProfile?.companyCode || !activeBranchId) return <p role="status" className="text-sm text-on-surface-variant">Chọn doanh nghiệp và chi nhánh để điều chuyển kho.</p>;
  return <TransferWorkspace key={`${userProfile.companyCode}:${activeBranchId}`} />;
}

function TransferWorkspace() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  const companyCode = userProfile?.companyCode || "";
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || hasPermission("inventory:manage");
  const scope = useMemo(() => ({ companyCode, branchId: activeBranchId }), [companyCode, activeBranchId]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<TransferBranch[]>([]);
  const [balanceVersion, setBalanceVersion] = useState(0);
  const [balanceResult, setBalanceResult] = useState<{ warehouseId: string; items: InventoryBalance[] }>({ warehouseId: '', items: [] });
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const balances = balanceResult.warehouseId === fromWarehouseId ? balanceResult.items : [];
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<TransferItem[]>([{ variantId: "", quantity: 1, serialNumbers: "" }]);
  const [pending, setPending] = useState<{ id: string; action: "cancel" | "reverse" } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Transfer["status"] | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const requestAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  const load = useCallback((signal?: AbortSignal) =>
    Promise.all([
        apiFetch<{ data: TransferBranch[] }>("/inventory/transfers/branches", { params: scope, signal }),
        apiFetch<{ data: Warehouse[] }>("/inventory/transfers/warehouses", { params: scope, signal }),
        apiFetch<{ data: Transfer[] }>("/inventory/transfers", { params: scope, signal }),
      ]).then(([branchResponse, warehouseResponse, transferResponse]) => {
      if (signal?.aborted) return;
      setBranches(branchResponse.data); setWarehouses(warehouseResponse.data); setTransfers(transferResponse.data);
      setBalanceVersion((current) => current + 1);
      setFromWarehouseId((current) => warehouseResponse.data.some((warehouse) => warehouse._id === current && warehouse.branchId === activeBranchId)
        ? current : warehouseResponse.data.find((warehouse) => warehouse.branchId === activeBranchId)?._id || "");
    }).catch((cause: unknown) => { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Không tải được phiếu điều chuyển."); })
      .finally(() => { if (!signal?.aborted) setLoading(false); }), [activeBranchId, scope]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    if (!createOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); trigger?.focus(); };
  }, [createOpen]);
  useEffect(() => {
    if (createOpen && error) formErrorRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [createOpen, error]);
  useEffect(() => {
    if (!fromWarehouseId) return;
    let active = true;
    void inventoryReceivingService.listBalances(fromWarehouseId).then((value) => { if (active) setBalanceResult({ warehouseId: fromWarehouseId, items: value.filter((balance) => balance.variantId && balance.quantity > balance.reservedQuantity) }); })
      .catch(() => { if (active) setBalanceResult({ warehouseId: fromWarehouseId, items: [] }); });
    return () => { active = false; };
  }, [fromWarehouseId, balanceVersion]);
  const sourceWarehouses = warehouses.filter((warehouse) => warehouse.branchId === activeBranchId);
  const destinationBranches = branches.filter((branch) => branch._id !== activeBranchId || sourceWarehouses.some((warehouse) => warehouse._id !== fromWarehouseId));
  const destinationWarehouses = warehouses.filter((warehouse) => warehouse.branchId === toBranchId && warehouse._id !== fromWarehouseId);
  const warehouseLabel = (id: string) => { const warehouse = warehouses.find((item) => item._id === id); const branch = branches.find((item) => item._id === warehouse?.branchId); return warehouse ? `${warehouse.name} · ${branch?.name || warehouse.branchId}` : id; };
  const branchLabel = (id: string) => branches.find((branch) => branch._id === id)?.name || id;
  const filteredTransfers = transfers.filter((transfer) => (!status || transfer.status === status) && [transfer.code, branchLabel(transfer.fromBranchId), branchLabel(transfer.toBranchId), transfer.reason, ...transfer.items.map((item) => item.sku)].join(" ").toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleTransfers = filteredTransfers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const lineTrackingMode = (item: TransferItem) => balances.find((balance) => balance.variantId === item.variantId)?.trackingMode;
  const tracksUnits = (item: TransferItem) => ["serial", "unit_barcode"].includes(lineTrackingMode(item) || "");
  const updateLine = (index: number, patch: Partial<TransferItem>) => setItems((current) => current.map((item, position) => position === index ? { ...item, ...patch, ...(patch.variantId !== undefined ? { serialNumbers: "" } : {}) } : item));
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!toBranchId || !fromWarehouseId) throw new Error("Vui lòng chọn kho gửi và chi nhánh nhận.");
      if (!destinationBranches.some((branch) => branch._id === toBranchId)) throw new Error("Chi nhánh nhận không hợp lệ.");
      if (toWarehouseId && !destinationWarehouses.some((warehouse) => warehouse._id === toWarehouseId)) throw new Error("Kho nhận không hợp lệ.");
      if (toBranchId === activeBranchId && !toWarehouseId) throw new Error("Vui lòng chọn kho nhận khác kho gửi.");
      if (items.some((item) => !item.variantId || !balances.some((balance) => balance.variantId === item.variantId))) throw new Error("Vui lòng chọn SKU còn hàng cho từng dòng điều chuyển.");
      const payload = { fromWarehouseId, ...(toWarehouseId ? { toWarehouseId } : {}), toBranchId, reason, items: items.map((item) => ({
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
    } catch (cause) { setConfirmOpen(false); setError(cause instanceof Error ? cause.message : "Không xử lý được phiếu."); }
    finally { setBusy(false); }
  }
  return (
    <section className="space-y-5 text-on-surface [--color-on-surface-variant:var(--color-slate-600)]" aria-labelledby="transfer-title">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ArrowLeftRight className="size-5" aria-hidden="true" /></span>
          <div><h2 id="transfer-title" className="text-balance text-xl font-semibold">Điều chuyển kho</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Chuyển hàng giữa các chi nhánh, theo dõi đến khi nhận hàng.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || loading} onClick={() => { setError(""); setLoading(true); void load(); }} className={actionClass}><RefreshCw className="size-4" aria-hidden="true" />Làm mới</button>
          {canManage && <button type="button" disabled={busy || loading || !sourceWarehouses.length} onClick={() => { setError(""); setCreateOpen(true); }} className={primaryActionClass}><Plus className="size-4" aria-hidden="true" />Tạo phiếu điều chuyển</button>}
        </div>
      </header>
      {error && !createOpen && <p role="alert" className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-pretty text-sm text-error">{error}</p>}
      {message && <p role="status" className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-pretty text-sm"><CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />{message}</p>}
      {!loading && canManage && !sourceWarehouses.length && <p role="status" className="text-pretty text-sm text-on-surface-variant">Chi nhánh này chưa có kho gửi. Cần nhập hàng trước khi tạo phiếu điều chuyển.</p>}
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant p-4 sm:px-5">
          <h3 className="flex items-center gap-2 text-balance font-semibold"><FileText className="size-4 text-primary" aria-hidden="true" />Phiếu điều chuyển<span className="rounded-lg bg-surface px-2 py-0.5 text-xs tabular-nums text-on-surface-variant">{transfers.length}</span></h3>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-on-surface-variant" aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} aria-label="Tìm phiếu điều chuyển" placeholder="Mã phiếu, chi nhánh, SKU..." className={cn(field, "min-h-10 pl-9")} /></div>
            <div className="w-40 shrink-0"><StyledSelect appearance="erp" ariaLabel="Lọc trạng thái điều chuyển" value={status} onChange={(value) => { setStatus(value as typeof status); setPage(1); }} options={[{ value: "", label: "Tất cả trạng thái" }, ...Object.entries(statusText).map(([value, label]) => ({ value, label }))]} /></div>
          </div>
        </div>
        {loading ? <div role="status" className="space-y-4 p-5"><span className="sr-only">Đang tải phiếu...</span>{[0, 1, 2].map((item) => <div key={item} className="h-20 rounded-xl bg-surface" />)}</div> : visibleTransfers.length ? (
          <ul className="divide-y divide-outline-variant">
            {visibleTransfers.map((transfer) => {
              const incoming = transfer.toBranchId === activeBranchId && transfer.fromBranchId !== activeBranchId;
              const StatusIcon = transfer.status === "in_transit" ? Truck : transfer.status === "received" ? CheckCircle2 : transfer.status === "reversed" ? RotateCcw : X;
              return <li key={transfer._id} className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="min-w-0 break-all text-sm">{transfer.code}</strong>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", transfer.status === "cancelled" ? "bg-error/5 text-error" : transfer.status === "reversed" ? "bg-surface text-on-surface-variant" : "bg-primary/10 text-primary")}><StatusIcon className="size-3.5" aria-hidden="true" />{statusText[transfer.status]}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">{incoming ? <ArrowDownLeft className="size-3.5" aria-hidden="true" /> : <ArrowUpRight className="size-3.5" aria-hidden="true" />}{transfer.fromBranchId === transfer.toBranchId ? "Nội bộ" : incoming ? "Chuyển đến" : "Chuyển đi"}</span>
                    <time dateTime={transfer.createdAt} className="text-xs tabular-nums text-on-surface-variant">{new Date(transfer.createdAt).toLocaleDateString("vi-VN")}</time>
                  </div>
                  <div className="grid min-w-0 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <div className="min-w-0"><p className="truncate text-sm font-medium" title={branchLabel(transfer.fromBranchId)}>{branchLabel(transfer.fromBranchId)}</p><p className="mt-0.5 truncate text-xs text-on-surface-variant" title={warehouseLabel(transfer.fromWarehouseId)}>{warehouses.find((warehouse) => warehouse._id === transfer.fromWarehouseId)?.name || transfer.fromWarehouseId}</p></div>
                    <ArrowRight className="mt-1 hidden size-4 text-on-surface-variant sm:block" aria-hidden="true" />
                    <div className="min-w-0"><p className="truncate text-sm font-medium" title={branchLabel(transfer.toBranchId)}>{branchLabel(transfer.toBranchId)}</p><p className="mt-0.5 truncate text-xs text-on-surface-variant" title={warehouseLabel(transfer.toWarehouseId)}>{warehouses.find((warehouse) => warehouse._id === transfer.toWarehouseId)?.name || transfer.toWarehouseId}</p></div>
                  </div>
                  <p className="flex min-w-0 items-start gap-2 rounded-lg bg-surface px-3 py-2 text-sm"><Package className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /><span className="min-w-0 break-words tabular-nums [overflow-wrap:anywhere]">{transfer.items.map((item) => item.sku + " × " + item.quantity.toLocaleString("vi-VN")).join(" · ")}</span></p>
                  {transfer.reason && <p className="text-pretty text-xs text-on-surface-variant [overflow-wrap:anywhere]">{transfer.reason}</p>}
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                  {canManage && transfer.status === "in_transit" && transfer.toBranchId === activeBranchId && <button type="button" disabled={busy} onClick={() => void receive(transfer._id)} className={primaryActionClass}><CheckCircle2 className="size-4" aria-hidden="true" />Xác nhận nhận</button>}
                  {canManage && transfer.status === "in_transit" && transfer.fromBranchId === activeBranchId && <button type="button" disabled={busy} onClick={() => { setPending({ id: transfer._id, action: "cancel" }); setConfirmOpen(false); setActionReason(""); }} className={actionClass}>Hủy phiếu</button>}
                  {canManage && transfer.status === "received" && transfer.toBranchId === activeBranchId && <button type="button" disabled={busy} onClick={() => { setPending({ id: transfer._id, action: "reverse" }); setConfirmOpen(false); setActionReason(""); }} className={actionClass}><RotateCcw className="size-4" aria-hidden="true" />Đảo phiếu</button>}
                </div>
              </li>;
            })}
          </ul>
        ) : <div className="flex flex-col items-center px-5 py-12 text-center"><span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-surface text-primary"><ArrowLeftRight className="size-6" aria-hidden="true" /></span><h4 className="text-balance text-sm font-semibold">{transfers.length ? "Không tìm thấy phiếu phù hợp" : "Chưa có phiếu điều chuyển"}</h4><p className="mt-1 max-w-sm text-pretty text-sm text-on-surface-variant">{transfers.length ? "Thử đổi từ khóa hoặc trạng thái." : canManage ? "Chọn Tạo phiếu điều chuyển để bắt đầu." : "Phiếu chuyển đến và chuyển đi sẽ hiển thị tại đây."}</p>{(query || status) && <button type="button" onClick={() => { setQuery(""); setStatus(""); setPage(1); }} className={cn(actionClass, "mt-4")}>Xóa bộ lọc</button>}</div>}
        {!loading && <TablePagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} totalItems={filteredTransfers.length} onPageChange={setPage} onPageSizeChange={setPageSize} itemLabel="phiếu" className="bg-surface text-on-surface-variant" />}
      </div>

      {canManage && createOpen && <dialog ref={dialogRef} aria-labelledby="create-transfer-title" onCancel={(event) => { event.preventDefault(); if (!busy) setCreateOpen(false); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/50 open:flex open:flex-col">
        <form onSubmit={(event) => void create(event)} aria-describedby={error ? "transfer-form-error" : undefined} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ArrowLeftRight className="size-5" aria-hidden="true" /></span><div><h3 id="create-transfer-title" className="text-balance text-lg font-semibold">Tạo phiếu điều chuyển</h3><p className="mt-0.5 text-pretty text-xs text-on-surface-variant">Chi nhánh nhận xác nhận khi hàng đến.</p></div></div>
            <button type="button" onClick={() => setCreateOpen(false)} disabled={busy} aria-label="Đóng phiếu điều chuyển" className={cn(actionClass, "size-10 shrink-0 px-0")}><X className="size-4" aria-hidden="true" /></button>
          </header>
          <div role="region" aria-label="Nội dung phiếu điều chuyển" tabIndex={0} className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-primary sm:p-6">
            {error && <p ref={formErrorRef} id="transfer-form-error" role="alert" className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-pretty text-sm text-error">{error}</p>}
            <div className="grid gap-3 md:grid-cols-2">
              <section className="min-w-0 space-y-4 rounded-xl border border-outline-variant bg-surface/50 p-4" aria-labelledby="transfer-source-title">
                <h4 id="transfer-source-title" className="flex items-center gap-2 text-balance text-sm font-semibold"><ArrowUpRight className="size-4 text-primary" aria-hidden="true" />Nơi gửi</h4>
                <div className="flex items-center gap-2 text-sm"><Building2 className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /><span className="truncate" title={branchLabel(activeBranchId)}>{branchLabel(activeBranchId)}</span></div>
                <div className="space-y-1.5"><p className="text-xs font-medium text-on-surface-variant">Kho gửi</p><StyledSelect appearance="erp" ariaLabel="Kho gửi" value={fromWarehouseId} disabled={busy} onChange={(next) => { setFromWarehouseId(next); setItems([{ variantId: "", quantity: 1, serialNumbers: "" }]); setToWarehouseId((current) => current === next ? "" : current); }} options={[{ value: "", label: "Chọn kho gửi" }, ...sourceWarehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))]} className="h-11" /></div>
              </section>
              <section className="min-w-0 space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4" aria-labelledby="transfer-destination-title">
                <h4 id="transfer-destination-title" className="flex items-center gap-2 text-balance text-sm font-semibold"><ArrowDownLeft className="size-4 text-primary" aria-hidden="true" />Nơi nhận</h4>
                <div className="space-y-1.5"><p className="text-xs font-medium text-on-surface-variant">Chi nhánh nhận <span aria-hidden="true" className="text-error">*</span></p><StyledSelect appearance="erp" ariaLabel="Chi nhánh nhận" value={toBranchId} disabled={busy} onChange={(value) => { setToBranchId(value); setToWarehouseId(""); }} options={[{ value: "", label: "Chọn chi nhánh nhận" }, ...destinationBranches.map((branch) => ({ value: branch._id, label: branch.name + (branch._id === activeBranchId ? " (nội bộ)" : "") }))]} className="h-11" /></div>
                {toBranchId && <div className="space-y-1.5"><p className="text-xs font-medium text-on-surface-variant">Kho nhận</p><StyledSelect appearance="erp" ariaLabel="Kho nhận" describedBy="transfer-destination-help" value={toWarehouseId} disabled={busy} onChange={setToWarehouseId} options={[{ value: "", label: toBranchId === activeBranchId ? "Chọn kho nhận" : "Kho mặc định của chi nhánh" }, ...destinationWarehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))]} className="h-11" /><p id="transfer-destination-help" className="text-pretty text-xs text-on-surface-variant">{destinationWarehouses.length === 0 ? "Chi nhánh chưa có kho. Hệ thống sẽ tạo kho mặc định khi lập phiếu." : toBranchId === activeBranchId ? "Chọn kho khác kho gửi để điều chuyển nội bộ." : "Để mặc định hoặc chọn kho cụ thể."}</p></div>}
              </section>
            </div>
            <section className="space-y-3" aria-labelledby="transfer-items-title">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 id="transfer-items-title" className="flex items-center gap-2 text-balance text-sm font-semibold"><Package className="size-4 text-primary" aria-hidden="true" />Hàng điều chuyển<span className="rounded-lg bg-surface px-2 py-0.5 text-xs tabular-nums text-on-surface-variant">{items.length} dòng</span></h4><button type="button" disabled={busy} onClick={() => setItems((current) => [...current, { variantId: "", quantity: 1, serialNumbers: "" }])} className={actionClass}><Plus className="size-4" aria-hidden="true" />Thêm dòng hàng</button></div>
              {items.map((item, index) => <div key={index} className="space-y-3 rounded-xl border border-outline-variant p-3 sm:p-4">
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end">
                  <div className="min-w-0 space-y-1.5"><p className="text-xs font-medium text-on-surface-variant">SKU</p><Dropdown aria-label={items.length === 1 ? "SKU" : "SKU dòng " + (index + 1)} value={item.variantId} onChange={(value) => updateLine(index, { variantId: value })} disabled={busy || !fromWarehouseId} searchable searchPlaceholder="Tìm SKU..." placeholder="Chọn SKU còn hàng" variant="form" options={balances.map((balance) => ({ value: balance.variantId!, label: balance.sku, sublabel: "Còn " + (balance.quantity - balance.reservedQuantity).toLocaleString("vi-VN") }))} triggerClassName="min-h-11 border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface" menuClassName="border-outline-variant bg-surface-container-lowest text-on-surface" /></div>
                  <label className="block space-y-1.5 text-xs font-medium text-on-surface-variant"><span>Số lượng</span><input required disabled={busy} type="number" min={tracksUnits(item) ? 1 : 0.000001} step={tracksUnits(item) ? 1 : "any"} value={item.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className={cn(field, "tabular-nums")} /></label>
                  <button type="button" disabled={busy || items.length === 1} onClick={() => setItems((current) => current.filter((_, position) => position !== index))} aria-label={items.length === 1 ? "Xóa dòng" : "Xóa dòng " + (index + 1)} className={cn(actionClass, "min-h-11 text-on-surface-variant")}><Trash2 className="size-4" aria-hidden="true" /><span className="sm:sr-only">Xóa dòng</span></button>
                </div>
                {tracksUnits(item) && <label className="block space-y-1.5 text-xs font-medium text-on-surface-variant"><span>{lineTrackingMode(item) === "serial" ? "Số sê-ri của hàng chuyển" : "Mã đơn vị của hàng chuyển"}</span><textarea required disabled={busy} rows={3} value={item.serialNumbers} onChange={(event) => updateLine(index, { serialNumbers: event.target.value })} placeholder="Mỗi mã một dòng" className={field} /></label>}
              </div>)}
            </section>
            <label className="block space-y-1.5 text-xs font-medium text-on-surface-variant"><span>Lý do điều chuyển</span><input required disabled={busy} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Bổ sung hàng cho chi nhánh" className={field} /></label>
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline-variant bg-surface/50 px-4 py-4 sm:px-6">
            <p className="flex items-center gap-1.5 text-xs text-on-surface-variant"><Clock3 className="size-3.5" aria-hidden="true" />Chờ xác nhận từ nơi nhận</p>
            <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => setCreateOpen(false)} className={actionClass}>Hủy</button><button type="submit" disabled={busy || loading} className={primaryActionClass}>{busy ? <Loader2 className="size-4" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}{busy ? "Đang tạo..." : "Tạo phiếu"}</button></div>
          </footer>
        </form>
      </dialog>}
      <ConfirmDialog isOpen={confirmOpen} title={pending?.action === "cancel" ? "Hủy phiếu điều chuyển" : "Đảo phiếu điều chuyển"} description={"Lý do: " + actionReason.trim()} confirmLabel="Xác nhận" isSubmitting={busy} onClose={() => setConfirmOpen(false)} onConfirm={() => void confirmAction()} />
      {pending && <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"><label className="block space-y-1.5 text-sm"><span>Lý do {pending.action === "cancel" ? "hủy" : "đảo"} phiếu</span><input autoFocus required maxLength={300} value={actionReason} onChange={(event) => setActionReason(event.target.value)} className={field} /></label><div className="mt-3 flex gap-2"><button type="button" disabled={!actionReason.trim() || busy} onClick={() => setConfirmOpen(true)} className={primaryActionClass}>Tiếp tục</button><button type="button" disabled={busy} onClick={() => setPending(null)} className={actionClass}>Bỏ qua</button></div></div>}
    </section>
  );
}
