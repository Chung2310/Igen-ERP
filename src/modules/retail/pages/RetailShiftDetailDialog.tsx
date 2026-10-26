import React from "react";
import { socketService } from "../../../services/socketService";
import { CalendarDays, ChevronDown, ClipboardList, Clock3, CreditCard, LoaderCircle, Package, RefreshCw, RotateCcw, UserRound, Wallet, X } from "lucide-react";
import { retailShiftsApi } from "../api/retailShifts.api";
import { CurrencyInput as SharedCurrencyInput } from "../../../components/common/CurrencyInput";
import type { RetailPaymentInput, RetailScope, RetailShift, RetailShiftOrderDetail, RetailShiftDetail } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { TablePagination } from "../../../components/common/TablePagination";

type Props = {
  scope: RetailScope;
  shift: RetailShift;
  onClose: () => void;
  onReconcile?: (shiftId: string, input: { countedCash: number; varianceReason?: string }) => Promise<void>;
};
type PaymentMethod = RetailPaymentInput["method"];

const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const methodLabels: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};
const scheduleSourceLabels = { custom: "Giờ làm riêng của nhân viên", employee: "Ca được phân công", company: "Ca mặc định công ty", legacy: "Giờ làm chung của công ty" };
const dateTime = (value?: string | Date) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
};

export default function RetailShiftDetailDialog({ scope, shift, onClose, onReconcile }: Props) {
  const [detail, setDetail] = React.useState<RetailShiftDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [afterSalesPage, setAfterSalesPage] = React.useState(1);
  const [countedCash, setCountedCash] = React.useState(shift.countedCash ?? 0);
  const [varianceReason, setVarianceReason] = React.useState(shift.varianceReason || "");
  const [reconcileBusy, setReconcileBusy] = React.useState(false);
  const [reconcileError, setReconcileError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void retailShiftsApi.detail(scope, shift._id, { page, afterSalesPage }).then((result) => {
      if (active) setDetail(result);
    }).catch((cause) => {
      if (active) setError(getApiErrorMessage(cause, "Không tải được chi tiết phiên POS."));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId, scope.terminalId, shift._id, attempt, page, afterSalesPage]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = (event: any) => {
      if (event?.companyCode !== scope.companyCode || event?.branchId !== scope.branchId || event?.sessionId !== shift._id) return;
      clearTimeout(timer); timer = setTimeout(() => setAttempt((value) => value + 1), 300);
    };
    const off = ["updated", "closed", "reconciled", "device-changed"].map((event) => socketService.on(`pos:session:${event}`, sync));
    off.push(socketService.onStatusChange((connected) => { if (connected) setAttempt((value) => value + 1); }));
    return () => { clearTimeout(timer); off.forEach((dispose) => dispose()); };
  }, [scope.companyCode, scope.branchId, shift._id]);
  const session = detail?.shift || shift;
  React.useEffect(() => {
    setCountedCash(session.countedCash ?? 0);
    setVarianceReason(session.varianceReason || "");
  }, [session._id, session.countedCash, session.varianceReason]);
  const submitReconciliation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onReconcile || reconcileBusy || !Number.isSafeInteger(countedCash) || countedCash < 0) return;
    setReconcileBusy(true);
    setReconcileError("");
    try {
      await onReconcile(shift._id, { countedCash, varianceReason: varianceReason.trim() || undefined });
      setAttempt((value) => value + 1);
    } catch (cause) {
      setReconcileError(getApiErrorMessage(cause, "Không đối soát được phiên."));
    } finally {
      setReconcileBusy(false);
    }
  };
  const orders = detail?.orders || [];
  const sessionOrders = orders.filter((order) => order.shiftId === shift._id);
  const soldOrders = sessionOrders.filter((order) => order.status !== "cancelled");
  const grossSales = session.grossSales ?? soldOrders.reduce((total, order) => total + Number(order.grandTotal || 0), 0);
  const collected = new Map<PaymentMethod, number>();
  const refunded = new Map<PaymentMethod, number>();
  for (const order of orders) {
    for (const payment of order.payments || []) {
      if (payment.shiftId === shift._id) collected.set(payment.method, (collected.get(payment.method) || 0) + Number(payment.amount || 0));
    }
    for (const refund of order.refunds || []) {
      if (refund.shiftId === shift._id) refunded.set(refund.method, (refunded.get(refund.method) || 0) + Number(refund.amount || 0));
    }
  }
  if (session.methodTotals) for (const row of session.methodTotals) { collected.set(row.method, row.collectedAmount); refunded.set(row.method, row.refundedAmount); }
  const buybacks = new Map<PaymentMethod, number>((detail?.buybackMethodTotals || []).map((row) => [row.method, row.amount]));
  const paymentMethods = [...new Set([...collected.keys(), ...refunded.keys(), ...buybacks.keys()])];
  const productMap = new Map<string, { name: string; quantity: number; sales: number }>();
  for (const order of soldOrders) {
    for (const item of order.items || []) {
      const key = `${item.productId}:${item.variantId || item.sku}`;
      const row = productMap.get(key) || { name: item.productName, quantity: 0, sales: 0 };
      row.quantity += Number(item.quantity || 0);
      row.sales += Number(item.lineTotal || 0);
      productMap.set(key, row);
    }
  }
  const products = (detail?.products || [...productMap.values()]).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "vi"));
  const cashMovements = session.cashMovements || [];
  const showCashReview = session.countedCash != null || session.varianceAmount != null || Boolean(session.approvedByName) || cashMovements.length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/70 p-0 backdrop-blur-sm animate-in fade-in duration-200 sm:px-4 sm:py-3 lg:px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="retail-shift-detail-title" className="relative flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-slate-50 shadow-2xl animate-in slide-in-from-top-8 duration-300 sm:h-[calc(90dvh-24px)] sm:min-h-[480px] sm:max-h-[880px] sm:rounded-3xl motion-reduce:animate-none">
        <button type="button" aria-label="Đóng chi tiết phiên" onClick={onClose} className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"><X className="h-5 w-5" /></button>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <header className="border-b border-slate-200 bg-white">
            <div className="px-4 py-3 pr-16 sm:px-6 sm:py-4 sm:pr-20">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan-800">Chi tiết phiên bán hàng</span><SessionStatus status={session.status} /></div>
              <div className="mt-2 flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><UserRound className="h-4 w-4" /></span>
                <div className="min-w-0"><h2 id="retail-shift-detail-title" className="truncate text-lg font-bold leading-5 text-slate-950">{session.cashierName || shift.cashierName}</h2></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5"><InfoPill icon={<CalendarDays className="h-3.5 w-3.5" />}>Ngày kinh doanh · {session.businessDate}</InfoPill><InfoPill icon={<Clock3 className="h-3.5 w-3.5" />}>Mở lúc · {dateTime(session.openedAt)}</InfoPill></div>
              {session.workShiftName && <p className="mt-2 truncate text-xs text-slate-500" title={session.workShiftName}><span className="font-semibold text-slate-600">Ca làm việc:</span> {session.workShiftName} · {session.workShiftSource ? scheduleSourceLabels[session.workShiftSource] : ""} · {dateTime(session.scheduledStartAt)}–{dateTime(session.scheduledEndAt)}</p>}
            </div>
          </header>

          <div className="mx-auto max-w-[1240px] space-y-4 p-3 sm:p-4">
          {loading && <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sm text-slate-500"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><LoaderCircle className="h-6 w-6 animate-spin" /></span><span className="font-medium">Đang tải chi tiết phiên…</span></div>}
          {!loading && error && <div role="alert" className="mx-auto flex min-h-[320px] max-w-lg flex-col items-center justify-center text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><RefreshCw className="h-5 w-5" /></span><p className="mt-4 font-semibold text-slate-900">Chưa tải được chi tiết phiên</p><p className="mt-1 text-sm text-rose-700">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"><RefreshCw className="h-4 w-4" />Thử tải lại</button></div>}
          {!loading && !error && detail && (
            <div className="space-y-4">
              {detail.legacySnapshot && <p className="text-xs text-amber-800">Phiên cũ: chi tiết đơn được dựng từ dữ liệu hiện tại.</p>}
              {session.status !== "open" && session.closingSnapshot && <p className="text-xs text-slate-500">Đã chốt lúc {dateTime(session.closingSnapshot.capturedAt)}</p>}

              <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4">
                <div className="border-b border-r border-slate-200 px-3 py-2.5 sm:border-b-0"><Summary label="Doanh thu" value={money(grossSales)} hint={(detail.soldOrderCount ?? soldOrders.length).toLocaleString("vi-VN") + " đơn"} /></div>
                <div className="border-b border-slate-200 px-3 py-2.5 sm:border-b-0 sm:border-r"><Summary label="Lợi nhuận gộp" value={detail.grossProfit == null ? "—" : money(detail.grossProfit)} hint="Trừ tiền hoàn và giá vốn" /></div>
                <div className="border-r border-slate-200 px-3 py-2.5"><Summary label="Tiền đầu ca" value={money(session.openingFloat)} /></div>
                <div className="px-3 py-2.5"><Summary label="Tổng tiền trong két" value={session.expectedCash == null ? "—" : money(session.expectedCash)} hint="Đầu ca + tiền mặt thu − hoàn ± thu chi" /></div>
              </div>

              {session.status === "closed" && onReconcile && <form onSubmit={(event) => void submitReconciliation(event)} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <SectionHeading icon={<Wallet className="h-4 w-4" />} title="Đối soát phiên" />
                  <p className="text-xs text-slate-500">Tiền dự kiến trong két: <b className="tabular-nums text-slate-800">{session.expectedCash == null ? "—" : money(session.expectedCash)}</b></p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
                  <label className="block text-xs font-semibold text-slate-600">Tiền thực tế trong két<SharedCurrencyInput aria-label="Tiền thực tế trong két" value={countedCash} onChange={(value) => setCountedCash(value)} className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" /></label>
                  <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Chênh lệch</p><p className={"mt-0.5 text-sm font-bold tabular-nums " + (session.expectedCash == null ? "text-slate-500" : countedCash - session.expectedCash === 0 ? "text-slate-900" : countedCash - session.expectedCash > 0 ? "text-emerald-700" : "text-rose-700")}>{session.expectedCash == null ? "—" : money(countedCash - session.expectedCash)}</p></div>
                  <label className="block text-xs font-semibold text-slate-600">Ghi chú (nếu có)<input aria-label="Ghi chú đối soát" value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20" /></label>
                </div>
                {reconcileError && <p role="alert" className="mt-2 text-sm text-rose-700">{reconcileError}</p>}
                <div className="mt-3 flex justify-end border-t border-slate-100 pt-3"><button type="submit" disabled={reconcileBusy || !Number.isSafeInteger(countedCash) || countedCash < 0} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{reconcileBusy && <LoaderCircle className="h-4 w-4 animate-spin" />}{reconcileBusy ? "Đang lưu…" : "Xác nhận đối soát"}</button></div>
              </form>}

              <div className="grid items-start gap-3 xl:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <SectionHeading icon={<Package className="h-4 w-4" />} title="Sản phẩm đã bán" meta={products.length.toLocaleString("vi-VN") + " mặt hàng"} />
                  <div className="mt-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_48px_108px] gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[minmax(0,1fr)_64px_140px]"><span>Sản phẩm</span><span className="text-right">SL</span><span className="text-right">Tiền hàng</span></div>
                    {products.length ? <div className="divide-y divide-slate-100 px-2">{products.map((product, index) => <div key={product.name + "-" + index} className="grid grid-cols-[minmax(0,1fr)_48px_108px] items-center gap-2 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_64px_140px]"><p className="truncate font-semibold text-slate-800" title={product.name}>{product.name}</p><span className="text-right tabular-nums text-slate-600">{product.quantity}</span><span className="text-right font-semibold tabular-nums text-slate-900">{money(product.sales)}</span></div>)}</div> : <p className="px-2 py-3 text-sm text-slate-500">Chưa có sản phẩm bán.</p>}
                  </div>
                </section>

                <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <SectionHeading icon={<CreditCard className="h-4 w-4" />} title="Thanh toán" meta={paymentMethods.length.toLocaleString("vi-VN") + " phương thức"} />
                  {paymentMethods.length ? <div className="mt-2 divide-y divide-slate-100">{paymentMethods.map((method) => <div key={method} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(100px,0.8fr)_2fr] sm:items-center"><p className="text-sm font-semibold text-slate-800">{methodLabels[method]}</p><div className="grid grid-cols-3 gap-2"><AmountCell label="Đã thu" value={money(collected.get(method) || 0)} /><AmountCell label="Đã hoàn" value={money(refunded.get(method) || 0)} /><AmountCell label="Thu mua" value={money(buybacks.get(method) || 0)} /></div></div>)}</div> : <p className="mt-2 py-2 text-sm text-slate-500">Chưa có giao dịch thanh toán.</p>}
                </section>
              </div>

              {orders.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="border-b border-slate-200 pb-2"><SectionHeading icon={<ClipboardList className="h-4 w-4" />} title="Đơn hàng" meta={(detail.total ?? orders.length).toLocaleString("vi-VN") + " đơn"} /></div>
                <div className="mt-1 divide-y divide-slate-200">{orders.map((order) => <OrderRow key={order._id} order={order} shiftId={shift._id} />)}</div>
                <TablePagination currentPage={page} totalPages={Math.ceil((detail.total || 0) / 20)} pageSize={20} pageSizeOptions={[20]} totalItems={detail.total || 0} itemLabel="đơn" onPageChange={setPage} onPageSizeChange={() => undefined} />
              </section>}

              {(detail.afterSalesTotal || 0) > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="border-b border-slate-200 pb-2"><SectionHeading icon={<RotateCcw className="h-4 w-4" />} title="Trả hàng / thu mua" meta={(detail.afterSalesTotal || 0).toLocaleString("vi-VN") + " phiếu"} /></div>
                <div className="mt-2 divide-y divide-slate-200">
                  {(detail.afterSales || []).map((receipt) => <details key={receipt._id} className="group py-2">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 [&::-webkit-details-marker]:hidden"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{receipt.type === "return" ? "Trả hàng" : "Thu mua"}</p><p className="mt-0.5 text-xs text-slate-500">{dateTime(receipt.createdAt)} · {receipt.customerName || "Khách lẻ"}</p></div><div className="flex items-center gap-2"><div className="text-right"><p className="text-sm font-semibold tabular-nums text-slate-900">{money(receipt.totalAmount)}</p><p className="text-xs text-slate-500">{methodLabels[receipt.paymentMethod]}</p></div><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" /></div></summary>
                    <div className="border-t border-slate-100 pt-2">{receipt.reason && <p className="mb-2 text-xs text-slate-500">Lý do: {receipt.reason}</p>}{receipt.items.map((item, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><p className="min-w-0 font-medium text-slate-800">{item.productName} · SL {item.quantity}</p><p className="text-sm tabular-nums text-slate-700">{money(item.lineAmount)}</p></div>)}</div>
                  </details>)}
                </div>
                <TablePagination currentPage={afterSalesPage} totalPages={Math.ceil((detail.afterSalesTotal || 0) / 20)} pageSize={20} pageSizeOptions={[20]} totalItems={detail.afterSalesTotal || 0} itemLabel="phiếu" onPageChange={setAfterSalesPage} onPageSizeChange={() => undefined} />
              </section>}

              {showCashReview && <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="border-b border-slate-200 pb-2"><SectionHeading icon={<Wallet className="h-4 w-4" />} title="Kiểm đếm tiền" /></div>
                <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-4">
                  {session.countedCash != null && <Summary label="Tiền thực đếm" value={money(session.countedCash)} />}
                  {session.varianceAmount != null && <Summary label="Chênh lệch" value={money(session.varianceAmount)} />}
                  {session.approvedByName && <Summary label="Người duyệt" value={session.approvedByName} />}
                </div>
                {session.varianceReason && <p className="mt-2 text-xs text-amber-800">Lý do: {session.varianceReason}</p>}
                {cashMovements.length > 0 && <div className="mt-2 divide-y divide-slate-100">{cashMovements.map((movement, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><p className="text-slate-600">{movement.type === "in" ? "Thu vào" : "Chi ra"} · {movement.reason}<span className="ml-2 text-xs text-slate-400">{dateTime(movement.at)}</span></p><p className={"font-semibold tabular-nums " + (movement.type === "in" ? "text-emerald-700" : "text-rose-700")}>{movement.type === "in" ? "+" : "−"}{money(movement.amount)}</p></div>)}</div>}
              </section>}

            </div>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}
function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0">
    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-0.5 truncate text-base font-bold tabular-nums text-slate-950 sm:text-lg" title={value}>{value}</p>
    {hint && <p className="mt-0.5 truncate text-[11px] text-slate-500" title={hint}>{hint}</p>}
  </div>;
}

function SectionHeading({ icon, title, meta }: { icon: React.ReactNode; title: string; meta?: string }) {
  return <div className="flex min-w-0 items-center gap-2">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cyan-50 text-cyan-700">{icon}</span>
    <h3 className="text-sm font-bold text-slate-900">{title}</h3>{meta && <span className="text-xs text-slate-500">· {meta}</span>}
  </div>;
}

function InfoPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">{icon}{children}</span>;
}

function SessionStatus({ status }: { status: RetailShift["status"] }) {
  const styles: Record<RetailShift["status"], string> = { open: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", closed: "bg-amber-50 text-amber-700 ring-amber-600/15", reconciled: "bg-slate-100 text-slate-600 ring-slate-500/15" };
  const labels: Record<RetailShift["status"], string> = { open: "Đang mở", closed: "Chờ đối soát", reconciled: "Đã đối soát" };
  return <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset " + styles[status]}><span className="h-1.5 w-1.5 rounded-full bg-current" />{labels[status]}</span>;
}

function AmountCell({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-medium text-slate-500">{label}</p><p className="truncate text-xs font-semibold tabular-nums text-slate-800 sm:text-sm">{value}</p></div>;
}
function OrderRow({ order, shiftId }: { order: RetailShiftOrderDetail; shiftId: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const soldInSession = order.shiftId === shiftId;
  const payments = (order.payments || []).filter((payment) => payment.shiftId === shiftId);
  const refunds = (order.refunds || []).filter((refund) => refund.shiftId === shiftId);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunded = refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const methods = [...new Set([...payments.map((payment) => payment.method), ...refunds.map((refund) => refund.method)])].map((method) => methodLabels[method]).join(", ");
  const status = order.status === "cancelled" ? "Đã hủy" : order.paymentStatus === "paid" ? "Đã thanh toán" : order.paymentStatus === "partial" ? "Thanh toán một phần" : order.paymentStatus === "refunded" ? "Đã hoàn tiền" : "Chưa thanh toán";
  const statusTone = order.status === "cancelled" ? "bg-rose-50 text-rose-700" : order.paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : order.paymentStatus === "refunded" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700";
  return <article className="border-b border-slate-200 px-2 last:border-b-0">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="w-full py-2.5 text-left transition hover:bg-slate-50/70">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-900">Đơn hàng</span><span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + statusTone}>{status}</span></div><p className="mt-0.5 text-xs text-slate-500">{dateTime(order.createdAt)}{methods ? " · " + methods : ""}</p></div>
        <ChevronDown className={"mt-1 h-4 w-4 shrink-0 text-slate-400 transition " + (expanded ? "rotate-180" : "")} />
      </div>
      <div className="mt-2 grid grid-cols-2 divide-x divide-slate-200 rounded-lg bg-slate-50 py-2 sm:grid-cols-4">
        <OrderValue label="Khách hàng" value={order.customerName || order.customerSnapshot?.name || "Khách lẻ"} />
        <OrderValue label="Trong phiên" value={soldInSession ? "Bán hàng" : "Thu / hoàn tiền"} />
        <OrderValue label="Doanh số" value={soldInSession ? money(order.status === "cancelled" ? 0 : Number(order.grandTotal || 0)) : "—"} strong />
        <OrderValue label="Thu / hoàn" value={(paid ? "+" + money(paid) : "—") + (refunded > 0 ? " / −" + money(refunded) : "")} strong />
      </div>
    </button>
    {expanded && <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 px-2 py-3 sm:px-3">
      <div><p className="mb-1 text-xs font-semibold text-slate-600">Sản phẩm trong đơn</p><div className="divide-y divide-slate-100">
        {order.items.map((item, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><div className="min-w-0"><p className="font-medium text-slate-800">{item.productName}</p><p className="text-xs text-slate-500">SL {item.quantity} · Đơn giá {money(item.unitPrice)} · Giảm {money(item.discountAmount)}</p></div><p className="whitespace-nowrap font-semibold tabular-nums text-slate-900">{money(item.lineTotal)}</p></div>)}
      </div></div>
      {(order.payments || []).length > 0 && <div><p className="mb-1 text-xs font-semibold text-slate-600">Lịch sử thu tiền</p><div className="divide-y divide-slate-100">{(order.payments || []).map((payment, index) => <div key={"p" + index} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="text-slate-600">{methodLabels[payment.method]} · {dateTime(payment.paidAt)} · {payment.receivedByName || "—"}</span><b className="whitespace-nowrap text-emerald-700">{money(payment.amount)}</b></div>)}</div></div>}
      {(order.refunds || []).length > 0 && <div><p className="mb-1 text-xs font-semibold text-slate-600">Lịch sử hoàn tiền</p><div className="divide-y divide-slate-100">{(order.refunds || []).map((refund, index) => <div key={"r" + index} className="flex flex-wrap justify-between gap-2 py-2 text-xs"><span className="text-slate-600">{methodLabels[refund.method]} · {dateTime(refund.refundedAt)} · {refund.refundedByName}{refund.reason ? " · " + refund.reason : ""}</span><b className="whitespace-nowrap text-rose-700">{money(refund.amount)}</b></div>)}</div></div>}
      {order.note && <p className="text-sm text-slate-600"><b>Ghi chú:</b> {order.note}</p>}
      {order.installment && <p className="text-sm text-slate-600"><b>Trả góp:</b> {order.installment.partner} · {order.installment.months} tháng · Trả trước {order.installment.prepayPercent}% · Đối tác tài trợ {money(order.installment.financedAmount || 0)}</p>}
    </div>}
  </article>;
}

function OrderValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="min-w-0 px-2 first:pl-0"><p className="text-[10px] font-medium text-slate-500">{label}</p><p className={"truncate text-xs sm:text-sm " + (strong ? "font-semibold tabular-nums text-slate-900" : "text-slate-700")} title={value}>{value}</p></div>;
}
