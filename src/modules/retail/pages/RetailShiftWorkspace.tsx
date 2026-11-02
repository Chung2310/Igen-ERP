import { lockCollection } from "../components/orders/collectionRequest";
import React from "react";
import { CalendarDays, ClipboardCheck, ClipboardList, Clock3, Minus, Plus, RefreshCw, Wallet, X } from "lucide-react";
import { retailShiftsApi } from "../api/retailShifts.api";
import { CurrencyInput as SharedCurrencyInput } from "../../../components/common/CurrencyInput";
import { Dropdown } from "../../../components/common/Dropdown";
import { TablePagination } from "../../../components/common/TablePagination";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailShift } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { socketService } from "../../../services/socketService";
import RetailShiftDetailDialog from "./RetailShiftDetailDialog";
import { ShiftScheduleNotice } from "../components/ShiftScheduleNotice";

const money = (value = 0) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const statuses = { open: "Đang mở", closed: "Chờ đối soát", reconciled: "Đã đối soát" };
export default function RetailShiftWorkspace() {
  const { scope, userProfile } = useRetailScope();
  const [cashiers, setCashiers] = React.useState<Array<{ id: string; name: string }>>([]);
  const [cashierId, setCashierId] = React.useState("");
  const [openingFloat, setOpeningFloat] = React.useState(0);
  const [openScheduleError, setOpenScheduleError] = React.useState<unknown>(null);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [items, setItems] = React.useState<RetailShift[]>([]);
  const [total, setTotal] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [filters, setFilters] = React.useState({ from: "", to: "", cashierId: "", page: 1 });
  const [detail, setDetail] = React.useState<RetailShift | null>(null);
  const [operation, setOperation] = React.useState<{ shift: RetailShift; type: "close" | "cash" } | null>(null);
  const [countedCash, setCountedCash] = React.useState(0);
  const [deferCount, setDeferCount] = React.useState(false);
  const [movementType, setMovementType] = React.useState<"in" | "out">("in");
  const [amount, setAmount] = React.useState(0);
  const [reversesKey, setReversesKey] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const request = React.useRef(0);
  const movementRequest = React.useRef<{ reversesKey?: string; idempotencyKey: string; type: "in" | "out"; amount: number; reason: string } | null>(null);
  const showError = React.useCallback((cause: unknown) => setError(getApiErrorMessage(cause, "Không xử lý được phiên POS.")), []);
  const refresh = React.useCallback(async () => {
    if (!scope) return;
    const id = ++request.current;
    try {
      const result = await retailShiftsApi.list(scope, { ...filters, from: filters.from || undefined, to: filters.to || undefined, cashierId: filters.cashierId || undefined, limit: pageSize });
      if (request.current === id) { setItems(result.items); setTotal(result.total); }
    } catch (cause) { if (request.current === id) showError(cause); }
  }, [scope?.companyCode, scope?.branchId, filters, pageSize, showError]);
  const refreshOptions = React.useCallback(async () => {
    if (!scope) return;
    setOptionsLoading(true);
    try {
      setCashiers(await retailShiftsApi.cashiers(scope));
    }
    catch (cause) { showError(cause); }
    finally { setOptionsLoading(false); }
  }, [scope?.companyCode, scope?.branchId, showError]);
  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => { setCashierId(""); setOperation(null); setDetail(null); void refreshOptions(); }, [refreshOptions]);
  React.useEffect(() => {
    const sync = (event: any) => { if (event?.companyCode === scope?.companyCode && event?.branchId === scope?.branchId) void refresh(); };
    const off = ["opened", "closed", "reconciled", "updated", "device-changed"].map((event) => socketService.on(`pos:session:${event}`, sync));
    off.push(socketService.onStatusChange((value) => { if (value) void refresh(); }));
    return () => off.forEach((dispose) => dispose());
  }, [scope?.companyCode, scope?.branchId, refresh]);

  const open = async (event: React.FormEvent) => {
    event.preventDefault(); if (!scope || busy || !cashierId || !Number.isSafeInteger(openingFloat) || openingFloat < 0) return; setBusy(true); setOpenScheduleError(null); setError("");
    try { await retailShiftsApi.open(scope, { cashierId, openingFloat }); setOpeningFloat(0); setCashierId(""); await refresh(); }
    catch (cause) { setOpenScheduleError(cause); } finally { setBusy(false); }
  };
  const operate = async (event: React.FormEvent) => {
    event.preventDefault(); if (!scope || !operation || busy) return; setBusy(true); setError("");
    try {
      if (operation.type === "close") await retailShiftsApi.close(scope, operation.shift._id, { countedCash: deferCount ? undefined : countedCash, varianceReason: reason || undefined });
      else {
        if (!movementRequest.current && (!Number.isSafeInteger(amount) || amount <= 0 || !reason.trim())) throw new Error("Nhập số tiền nguyên dương và lý do thu/chi.");
        const key = `retail-pos-movement:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid, operation.shift._id])}`;
        await lockCollection(key, async () => {
          const raw = localStorage.getItem(key);
          if (raw && !movementRequest.current) {
            const saved = JSON.parse(raw);
            movementRequest.current = saved; setMovementType(saved.type); setAmount(saved.amount); setReason(saved.reason); setReversesKey(saved.reversesKey || "");
            throw new Error("Đã tìm thấy giao dịch đang chờ ở tab khác. Kiểm tra rồi thử lại yêu cầu đã lưu.");
          }
          movementRequest.current ||= { idempotencyKey: crypto.randomUUID(), type: movementType, amount, reason, ...(reversesKey ? { reversesKey } : {}) };
          const body = JSON.stringify(movementRequest.current);
          if (raw && raw !== body) throw new Error("Giao dịch đã thay đổi ở tab khác. Đóng rồi mở lại để kiểm tra.");
          localStorage.setItem(key, body);
          if (localStorage.getItem(key) !== body) throw new Error("Không lưu được giao dịch két. Chưa gửi giao dịch.");
          await retailShiftsApi.moveCash(scope, operation.shift._id, movementRequest.current);
          localStorage.removeItem(key); movementRequest.current = null;
        });
      }
      setOperation(null); await refresh();
    } catch (cause) { showError(cause); } finally { setBusy(false); }
  };
  const begin = (shift: RetailShift, type: "close" | "cash") => {
    setOperation({ shift, type }); setCountedCash(0); setDeferCount(false); setReason(""); setAmount(0); setReversesKey(""); setError(""); movementRequest.current = null;
    if (type === "cash" && scope) {
      try {
        const raw = localStorage.getItem(`retail-pos-movement:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid, shift._id])}`);
        if (raw) {
          const saved = JSON.parse(raw);
          if (!saved.idempotencyKey || !["in", "out"].includes(saved.type) || !Number.isSafeInteger(saved.amount) || saved.amount <= 0 || typeof saved.reason !== "string") throw new Error("Bản lưu giao dịch két bị lỗi. Giữ bản lưu để đối chiếu.");
          movementRequest.current = saved; setMovementType(saved.type); setAmount(saved.amount); setReason(saved.reason); setReversesKey(saved.reversesKey || "");
        }
      } catch (cause) { setOperation(null); showError(cause); }
    }
  };
  const hasPendingMovement = (id: string) => {
    try { return Boolean(localStorage.getItem(`retail-pos-movement:v1:${JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, id])}`)); }
    catch { return false; }
  };
  const reconcileMovement = async (revoke: boolean) => {
    if (!scope || !operation || !movementRequest.current || busy) return;
    setBusy(true); setError("");
    try {
      const key = `retail-pos-movement:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid, operation.shift._id])}`;
      await lockCollection(key, async () => {
        const saved = movementRequest.current!;
        if (localStorage.getItem(key) !== JSON.stringify(saved)) throw new Error("Bản lưu thay đổi. Đóng và mở lại giao dịch để kiểm tra.");
        const result = await retailShiftsApi.reconcileMovement(scope, operation.shift._id, saved, revoke);
        if (result.status === "completed" || result.status === "revoked") { localStorage.removeItem(key); movementRequest.current = null; setOperation(null); await refresh(); }
        else setError(result.message);
      });
    } catch (cause) { showError(cause); } finally { setBusy(false); }
  };
  const setFilter = (key: "from" | "to" | "cashierId", value: string) => setFilters((old) => ({ ...old, [key]: value, page: 1 }));
  const reconcileInDetail = async (shiftId: string, input: { countedCash: number; varianceReason?: string }) => {
    if (!scope) throw new Error("Vui lòng chọn chi nhánh.");
    await retailShiftsApi.reconcile(scope, shiftId, input);
    await refresh();
  };
  const canSubmitOperation = operation?.type === "close"
    ? deferCount || (Number.isSafeInteger(countedCash) && countedCash >= 0)
    : Boolean(movementRequest.current) || (Number.isSafeInteger(amount) && amount > 0 && Boolean(reason.trim()));
  if (!scope) return <p>Vui lòng chọn chi nhánh.</p>;
  return <section className="mx-auto max-w-7xl space-y-5">
    <header className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><ClipboardList className="h-5 w-5" /></span>
      <div><h1 className="text-xl font-bold text-slate-900">Phiên POS</h1><p className="mt-1 text-sm text-slate-500">Quản lý phiên bán hàng của nhân viên.</p></div>
    </header>
    <form onSubmit={(event) => void open(event)} className="relative z-10 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><Wallet className="h-4 w-4" /></span>
          <div><h2 className="font-bold text-slate-900">Mở phiên cho nhân viên</h2><p className="mt-0.5 text-xs text-slate-500">Chọn nhân viên và nhập tiền nhận đầu ca.</p></div>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Select label="Nhân viên bán hàng" placeholder="Chọn nhân viên" value={cashierId} onChange={(value) => { setCashierId(value); setOpenScheduleError(null); }} options={cashiers.map((user) => ({ value: user.id, label: user.name }))} />
          <MoneyField label="Tiền nhận đầu ca" value={openingFloat} onChange={setOpeningFloat} />
        </div>
        {!optionsLoading && !error && cashiers.length === 0 && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-800">Chưa có nhân viên POS ở chi nhánh này. Trong Nhân sự, chọn vai trò “Nhân viên bán hàng POS” và gán đúng chi nhánh cho tài khoản.</p>}
        {openScheduleError && <div className="mt-4"><ShiftScheduleNotice error={openScheduleError} subject="employee" /></div>}
        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <button disabled={busy || !cashierId || !Number.isSafeInteger(openingFloat) || openingFloat < 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"><ClipboardCheck className="h-4 w-4" />Mở phiên</button>
        </div>
      </div>
    </form>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><ClipboardList className="h-4 w-4" /></span>
              <div>
                <h2 className="font-bold text-slate-900">Phiên bán hàng</h2>
                <p className="mt-0.5 text-xs text-slate-500">{total.toLocaleString("vi-VN")} phiên phù hợp</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => void refresh()} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Từ ngày" type="date" value={filters.from} onChange={(value) => setFilter("from", value)} />
          <Field label="Đến ngày" type="date" value={filters.to} onChange={(value) => setFilter("to", value)} />
          <Select label="Lọc nhân viên" value={filters.cashierId} onChange={(value) => setFilter("cashierId", value)} options={cashiers.map((user) => ({ value: user.id, label: user.name }))} />
        </div>
      </div>

      {items.length ? (
        <div className="divide-y divide-slate-100">
          {items.map((shift) => (
            <article key={shift._id} className="px-4 py-3 transition-colors hover:bg-slate-50/60 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-bold uppercase text-slate-600">{shift.cashierName?.trim()?.charAt(0) || "?"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{shift.cashierName}</h3>
                      <ShiftStatusBadge status={shift.status} />
                      {shift.closingMode === "midnight" && <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><Clock3 className="h-3 w-3" />Tự đóng 00:00</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-xs text-slate-600 lg:pl-0">
                  <span className="inline-flex items-center gap-1.5 font-medium"><CalendarDays className="h-3.5 w-3.5 text-slate-400" />{shift.businessDate}</span>
                  {shift.workShiftName && <span className="text-slate-500">{shift.workShiftName}</span>}
                </div>

                <div className="flex flex-wrap gap-2 pl-12 lg:shrink-0 lg:justify-end lg:pl-0">
                  <Action variant="primary" onClick={() => setDetail(shift)}>Chi tiết</Action>
                  {hasPendingMovement(shift._id) && <Action variant="warning" onClick={() => begin(shift, "cash")}>Kiểm tra thu / chi</Action>}
                  {shift.status === "open" && <><Action onClick={() => begin(shift, "cash")}>Thu / chi quỹ</Action><Action variant="warning" onClick={() => begin(shift, "close")}>Đóng phiên</Action></>}
                </div>
              </div>
            </article>
          ))}
        </div>      ) : (
        <div className="px-4 py-12 text-center sm:px-6">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><ClipboardList className="h-5 w-5" /></span>
          <p className="mt-3 font-semibold text-slate-700">Chưa có phiên phù hợp</p>
          <p className="mt-1 text-sm text-slate-500">Thử thay đổi ngày, nhân viên hoặc trạng thái phiên.</p>
        </div>
      )}

      <TablePagination currentPage={filters.page} totalPages={Math.ceil(total / pageSize)} pageSize={pageSize} totalItems={total} itemLabel="phiên POS" onPageChange={(page) => setFilters((old) => ({ ...old, page }))} onPageSizeChange={setPageSize} />
    </div>
    {detail && <RetailShiftDetailDialog scope={scope} shift={detail} onClose={() => setDetail(null)} onReconcile={reconcileInDetail} />}
    {operation && (
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOperation(null); }}
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-label={operation.type === "close" ? "Đóng phiên POS" : "Thu chi quỹ POS"}
          onSubmit={(event) => void operate(event)}
          className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Phiên bán hàng</p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">{operation.type === "close" ? "Đóng phiên" : "Thu / chi quỹ"}</h2>
                <p className="mt-0.5 truncate text-sm text-slate-500">{operation.shift.cashierName} <span className="text-slate-300">·</span> {operation.shift.businessDate}</p>
              </div>
            </div>
            <button type="button" aria-label="Đóng cửa sổ" disabled={busy} onClick={() => setOperation(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">Tiền trong két theo hệ thống</span>
              <strong className="shrink-0 text-base tabular-nums text-slate-900">{operation.shift.expectedCash == null ? "—" : money(operation.shift.expectedCash)}</strong>
            </div>

            {operation.type === "close" ? (
              <div className="space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={deferCount} onChange={(event) => setDeferCount(event.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-700" />
                  <span><span className="block font-semibold text-slate-800">Chỉ đóng phiên</span><span className="mt-0.5 block text-xs text-slate-500">Quản lý sẽ kiểm đếm và đối soát sau.</span></span>
                </label>
                {!deferCount && <MoneyField label="Tiền mặt thực đếm" value={countedCash} onChange={setCountedCash} />}
                {!deferCount && (
                  <label className="block text-xs font-semibold text-slate-600">
                    Lý do chênh lệch <span className="font-normal text-slate-400">(nếu có)</span>
                    <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1.5 block w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15" placeholder="Ghi chú nếu tiền thực đếm khác số trên hệ thống" />
                  </label>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <Select
                  label="Khoản thu / chi cần điều chỉnh (nếu có)"
                  placeholder="Không chọn khoản cũ"
                  value={reversesKey}
                  onChange={(value) => {
                    if (movementRequest.current) return;
                    setReversesKey(value);
                    const source = operation.shift.cashMovements?.find((movement) => movement.key === value);
                    if (source) {
                      setMovementType(source.type === "in" ? "out" : "in");
                      setAmount(source.amount);
                      setReason("Điều chỉnh: " + source.reason);
                    }
                  }}
                  options={(operation.shift.cashMovements || [])
                    .filter((movement) => movement.key && !movement.reversesKey && !operation.shift.cashMovements?.some((row) => row.reversesKey === movement.key))
                    .map((movement) => ({ value: movement.key!, label: (movement.type === "in" ? "Thu vào " : "Chi ra ") + money(movement.amount) + " · " + movement.reason }))}
                />

                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-slate-600">Loại giao dịch</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={Boolean(movementRequest.current || reversesKey)} onClick={() => setMovementType("in")} aria-pressed={movementType === "in"} className={"inline-flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 " + (movementType === "in" ? "border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><Plus className="h-4 w-4" /></span>
                      <span><span className="block text-sm font-semibold">Bổ sung tiền</span><span className="block text-[11px] text-slate-500">Tiền vào két</span></span>
                    </button>
                    <button type="button" disabled={Boolean(movementRequest.current || reversesKey)} onClick={() => setMovementType("out")} aria-pressed={movementType === "out"} className={"inline-flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 " + (movementType === "out" ? "border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-500/10" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700"><Minus className="h-4 w-4" /></span>
                      <span><span className="block text-sm font-semibold">Rút tiền</span><span className="block text-[11px] text-slate-500">Tiền ra khỏi két</span></span>
                    </button>
                  </div>
                  {reversesKey && <p className="mt-2 text-xs text-slate-500">Loại giao dịch được chọn tự động theo khoản cần điều chỉnh.</p>}
                </fieldset>

                <MoneyField label="Số tiền" value={amount} onChange={(value) => { if (!movementRequest.current && !reversesKey) setAmount(value); }} />

                <label className="block text-xs font-semibold text-slate-600">
                  Lý do
                  <textarea value={reason} onChange={(event) => { if (!movementRequest.current) setReason(event.target.value); }} rows={3} className="mt-1.5 block w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 disabled:bg-slate-50" placeholder={movementType === "in" ? "Ví dụ: Bổ sung tiền lẻ đầu ca" : "Ví dụ: Chi phí phát sinh"} />
                </label>
                {movementRequest.current && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Giao dịch đang chờ được lưu nguyên trạng để gửi lại. Hãy gửi lại hoặc kiểm tra trạng thái giao dịch.</p>}
              </div>
            )}

            {operation.type === "cash" && movementRequest.current && (
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={busy} onClick={() => void reconcileMovement(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Kiểm tra giao dịch</button>
                <button type="button" disabled={busy} onClick={() => void reconcileMovement(true)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">Hủy yêu cầu chưa ghi nhận</button>
              </div>
            )}
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
            <button type="button" disabled={busy} onClick={() => setOperation(null)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Đóng</button>
            <button type="submit" disabled={busy || !canSubmitOperation} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Đang lưu…" : operation.type === "close" ? "Xác nhận đóng phiên" : movementType === "in" ? "Xác nhận bổ sung" : "Xác nhận rút tiền"}
            </button>
          </footer>
        </form>
      </div>
    )}
  </section>;
}
function ShiftStatusBadge({ status }: { status: RetailShift["status"] }) {
  const styles: Record<RetailShift["status"], string> = {
    open: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    closed: "bg-amber-50 text-amber-700 ring-amber-600/15",
    reconciled: "bg-slate-100 text-slate-600 ring-slate-500/15",
  };
  return <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset " + styles[status]}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statuses[status]}</span>;
}
function Action({ children, onClick, variant = "default" }: { children: React.ReactNode; onClick: () => void; variant?: "default" | "primary" | "warning" | "success" }) {
  const styles = {
    default: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    primary: "border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={"inline-flex min-h-8 items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-500/20 " + styles[variant]}
    >
      {children}
    </button>
  );
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs font-semibold text-slate-600">{label}<input aria-label={label} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-900 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" /></label>;
}
function Select({ label, placeholder, value, options, onChange }: { label: string; placeholder?: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) { return <Dropdown label={label} value={value} onChange={onChange} options={options} placeholder={placeholder || "Chọn…"} variant="form" size="md" className="w-full" searchable />; }
function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="block min-w-0"><span className="block text-xs font-bold text-slate-700">{label}</span><SharedCurrencyInput aria-label={label} value={value} onChange={(next) => onChange(next)} className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" /></label>; }
