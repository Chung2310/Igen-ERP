import CashSessionPicker from "../components/orders/CashSessionPicker";
import React from "react";
import {
  AlertCircle,
  Ban,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  ListOrdered,
  Loader2,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingBasket,
  User,
  Wallet,
  X,
} from "lucide-react";
import { AfterSaleBadge, AfterSaleHistory } from "../components/orders/AfterSaleHistory";
import { readCancellation, saveCancellation, clearCancellation, lockCancellation, sameCancellation, type PendingCancellation } from "../components/orders/cancellationRequest";
import PendingCancellations from "../components/orders/PendingCancellations";
import CollectionDialog from "../components/orders/CollectionDialog";
import { retailOrdersApi } from "../api/retailOrders.api";
import { useRetailScope } from "../hooks/useRetailScope";
import { useAfterSaleRequest } from "../hooks/useAfterSaleRequest";
import type { RetailAfterSaleInput, RetailAfterSaleType, RetailOrder, RetailPaymentInput } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";
import { ApiClientError } from "../../../services/apiClientError";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailOrdersPageV2() {
  const { scope, userProfile } = useRetailScope();
  const manager =
    userProfile?.role === "admin" ||
    userProfile?.role === "superadmin" ||
    userProfile?.permissions?.some((p) => p === "*" || p === "retail:manage");

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [orders, setOrders] = React.useState<RetailOrder[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<RetailOrder | null>(null);
  const [collecting, setCollecting] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const data = await retailOrdersApi.list(scope, { q, status: status || undefined });
      setOrders(data.items);
      setError("");
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không tải được đơn hàng.");
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [scope?.companyCode, scope?.branchId, q, status]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  if (!scope) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <Building2 className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-base font-medium">Vui lòng chọn chi nhánh để xem danh sách đơn hàng.</p>
      </div>
    );
  }

  const detail = async (id: string) => {
    try {
      const order = await retailOrdersApi.detail(scope, id);
      setSelected(order);
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không tải được chi tiết đơn hàng.");
      setError(msg);
      toast.error(msg);
    }
  };

  const openCollection = () => {
    if (!selected?.customerId) {
      setError("Vui lòng chọn khách hàng trước khi thanh toán.");
      toast.error("Vui lòng chọn khách hàng trước khi thanh toán.");
      return;
    }
    setError("");
    setCollecting(true);
  };

  const collected = (updated: RetailOrder) => {
      setSelected(updated);
      setCollecting(false);
      toast.success("Đã ghi nhận thanh toán công nợ thành công.");
      void refresh();
  };

  const cancelled = (updated: RetailOrder) => {
    if (!selected) return;
    const wasDraft = selected.status === "draft";
      if (wasDraft) {
        setSelected(null);
      } else {
        setSelected(updated);
      }
      setCancelling(false);
      toast.success("Đã hủy đơn hàng thành công.");
      void refresh();
  };

  // KPI Computations
  const totalGrand = orders.reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
  const completedCount = orders.filter((o) => o.status === "completed").length;
  const pendingCount = orders.filter((o) => o.status === "confirmed" || Number(o.dueAmount || 0) > 0).length;

  return (
    <section className="space-y-3.5">
      {/* Header Card */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-xs">
            <ListOrdered className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Đơn hàng
            </h1>
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 border border-cyan-200/60">
              {orders.length} đơn
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-600 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </header>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng đơn hàng</span>
            <ShoppingBag className="h-3.5 w-3.5 text-cyan-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-slate-900">{orders.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng doanh số</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-emerald-700">{money(totalGrand)}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Đã hoàn tất</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-blue-700">{completedCount}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Chờ xử lý / Nợ</span>
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm đơn hàng"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/10"
            placeholder="Tìm mã đơn, khách hàng, số điện thoại..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="w-full sm:w-52">
          <select
            aria-label="Trạng thái đơn"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10 cursor-pointer"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="confirmed">Còn xử lý</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Inline Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs sm:text-sm font-medium text-red-700 shadow-2xs flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-red-400 hover:text-red-600 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Orders Data Table */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">Không tìm thấy đơn hàng</h3>
          <p className="mt-1 text-xs text-slate-500">
            Không có đơn hàng nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.
          </p>
          {(q || status) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("");
              }}
              className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold select-none">
                <tr>
                  <th className="px-4 py-3">Mã đơn hàng</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Ngày bán</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Thanh toán</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {orders.map((order) => {
                  const isCompleted = order.status === "completed";
                  const isCancelled = order.status === "cancelled";
                  const isConfirmed = order.status === "confirmed";

                  return (
                    <tr
                      key={order._id}
                      onClick={() => void detail(order._id)}
                      className="hover:bg-cyan-50/40 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-cyan-700 transition">
                          {order.orderCode || "Đơn hàng"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {order.customerName || "Khách lẻ"}
                        </div>
                        {order.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {order.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {order.businessDate ? `Ngày ${order.businessDate}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {order.items && order.items.length > 0 ? (
                          <p
                            className="text-slate-500 max-w-[200px] truncate"
                            title={order.items.map((i) => `${i.sku} × ${i.quantity}`).join("; ")}
                          >
                            {order.items.map((i) => `${i.sku} × ${i.quantity}`).join("; ")}
                          </p>
                        ) : (
                          <span className="text-slate-400 italic">Trống</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-cyan-700">
                          {money(order.grandTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isCancelled
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isConfirmed
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                          {isCancelled && <Ban className="h-3 w-3" />}
                          {isConfirmed && <Clock className="h-3 w-3" />}
                          {order.status === "completed"
                            ? "Hoàn tất"
                            : order.status === "cancelled"
                              ? "Đã hủy"
                              : order.status === "confirmed"
                                ? "Còn xử lý"
                                : "Chờ xử lý"}
                        </span>
                        <AfterSaleBadge order={order} />
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {order.paymentStatus ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              order.paymentStatus === "paid"
                                ? "bg-cyan-50 text-cyan-700"
                                : order.paymentStatus === "partial"
                                  ? "bg-amber-50 text-amber-700"
                                  : order.paymentStatus === "refunded"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {order.paymentStatus === "paid"
                              ? "Đã thanh toán"
                              : order.paymentStatus === "partial"
                                ? "Thanh toán một phần"
                                : order.paymentStatus === "refunded"
                                  ? "Đã hoàn tiền"
                                  : "Chưa thanh toán"}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          aria-label="Xem chi tiết"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            void detail(order._id);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xem</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PendingCancellations key={JSON.stringify([scope.companyCode, scope.branchId, userProfile?.uid])} onResolved={() => void refresh()} />
      {/* Order Detail Modal */}
      {selected && (
        <OrderDialog
          order={selected}
          manager={Boolean(manager)}
          onClose={() => setSelected(null)}
          onCollect={openCollection}
          onCancel={() => setCancelling(true)}
          onRefreshDetail={() => { void detail(selected._id); void refresh(); }}
        />
      )}

      {/* Payment / Debt Collection Dialog */}
      {collecting && selected && (
        <CollectionDialog
          order={selected}
          close={() => setCollecting(false)}
          done={collected}
        />
      )}

      {/* Cancel Order Dialog */}
      {cancelling && selected && (
        <CancelDialog
          order={selected}
          onClose={() => setCancelling(false)}
          done={cancelled}
        />
      )}
    </section>
  );
}

function OrderDialog({
  order,
  manager,
  onClose,
  onCollect,
  onCancel,
  onRefreshDetail,
}: {
  order: RetailOrder;
  manager: boolean;
  onClose: () => void;
  onCollect: () => void;
  onCancel: () => void;
  onRefreshDetail: () => void;
}) {
  const [mode, setMode] = React.useState<RetailAfterSaleType>();
  const hasAfterSales = (order.afterSaleSummary?.processedQuantity || 0) > 0;
  const hasRemaining = !order.afterSaleSummary || order.afterSaleSummary.processedQuantity < order.afterSaleSummary.totalQuantity;
  const canCancel = !hasAfterSales && order.status !== "cancelled" && (order.status !== "completed" || manager);
  const isCompleted = order.status === "completed";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl border border-slate-100">
        {/* Header */}
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {order.orderCode || "Đơn hàng"}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${order.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : order.status === "cancelled"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
              >
                {order.status === "completed"
                  ? "Hoàn tất"
                  : order.status === "cancelled"
                    ? "Đã hủy"
                    : "Còn xử lý"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{order.customerName || "Khách lẻ"}</span>
              {order.customerPhone && <span> · SĐT: {order.customerPhone}</span>}
              {order.createdByName && <span> · Thu ngân: {order.createdByName}</span>}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Items */}
        <div className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Danh mục sản phẩm
          </h3>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white px-4">
            {order.items.map((i, idx) => (
              <div key={`${i.sku}-${idx}`} className="flex items-center justify-between py-3 text-sm">
                <div className="space-y-0.5">
                  <span className="font-medium text-slate-800">
                    {i.productName} × {i.quantity}
                  </span>
                  <p className="font-mono text-xs text-slate-400">
                    SKU: {i.sku}
                    {i.serialNumbers && i.serialNumbers.length > 0 && ` · S/N: ${i.serialNumbers.join(", ")}`}
                  </p>
                </div>
                <b className="font-mono font-bold text-slate-900">{money(i.lineTotal)}</b>
              </div>
            ))}
          </div>
        </div>

        {order.note && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">Ghi chú: {order.note}</p>}
        {order.installment && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">Trả góp {order.installment.partner} · {order.installment.months} tháng · Trả trước {order.installment.prepayPercent}% · Đối tác tài trợ {money(order.installment.financedAmount || 0)}</p>}
        <AfterSaleHistory order={order} />

        {/* Financial Metrics */}
        <div className={`mt-5 grid gap-3 ${Number(order.pendingTransferAmount || 0) > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          <Metric label="Tổng cộng" value={order.grandTotal} />
          <Metric label="Đã thu" value={order.paidAmount} />
          {Number(order.pendingTransferAmount || 0) > 0 && <Metric label="Chờ chuyển khoản" value={Number(order.pendingTransferAmount)} />}
          <Metric label={order.installment ? "Chờ đối tác thanh toán" : "Còn nợ"} value={Math.max(0, order.dueAmount - Number(order.pendingTransferAmount || 0))} />
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-100">
          {((order.status === "confirmed" && order.dueAmount > Number(order.pendingTransferAmount || 0)) || order.status === "completed" || order.status === "cancelled") && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 active:scale-95"
              onClick={onCollect}
            >
              <Banknote className="h-4 w-4" />
              {order.status === "confirmed" && order.dueAmount > Number(order.pendingTransferAmount || 0) ? "Thu công nợ" : "Kiểm tra khoản thu đang chờ"}
            </button>
          )}

          {isCompleted && (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-700 shadow-sm transition hover:bg-orange-100 active:scale-95"
                onClick={() => setMode("return")}
              >
                <RotateCcw className="h-4 w-4" />
                {hasRemaining ? "Trả hàng" : "Kiểm tra yêu cầu trả hàng"}
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-100 active:scale-95"
                onClick={() => setMode("buyback")}
              >
                <ShoppingBasket className="h-4 w-4" />
                {hasRemaining ? "Thu mua lại" : "Kiểm tra yêu cầu thu mua lại"}
              </button>
            </>
          )}

          {(canCancel || order.status === "cancelled") && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 shadow-sm transition hover:bg-red-100 active:scale-95 ml-auto"
              onClick={onCancel}
            >
              <Ban className="h-4 w-4" />
              {order.status === "cancelled" ? "Kiểm tra yêu cầu hủy đang chờ" : "Hủy/hoàn tiền"}
            </button>
          )}
        </div>

        {/* After-Sales Modal */}
        {mode && (
          <AfterSalesForm
            order={order}
            type={mode}
            close={() => setMode(undefined)}
            done={() => {
              setMode(undefined);
              onRefreshDetail();
            }}
          />
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold text-slate-900">{money(value)}</p>
    </div>
  );
}

export function AfterSalesForm({
  order,
  type,
  close,
  done,
}: {
  order: RetailOrder;
  type: RetailAfterSaleType;
  close: () => void;
  done: () => void;
}) {
  const { scope, userProfile } = useRetailScope();
  const request = useAfterSaleRequest(scope, userProfile?.uid || "", order._id);
  const { pending, busy } = request;
  const [cashSessionId, setCashSessionId] = React.useState(pending?.cashSessionId || "");
  const [reason, setReason] = React.useState(pending?.reason || "");
  const [method, setMethod] = React.useState<RetailAfterSaleInput["paymentMethod"]>(pending?.paymentMethod || "cash");
  const blocked = request.scopeChanged || Boolean(request.storageError) || Boolean(pending && pending.type !== type);

  const [rows, setRows] = React.useState(() =>
    order.items.map((i, index) => ({
      selected: Boolean(pending?.items.some((item) => item.orderLineIndex === index)),
      quantity: pending?.items.find((item) => item.orderLineIndex === index)?.quantity || 1,
      unitAmount: pending?.items.find((item) => item.orderLineIndex === index)?.unitAmount ?? Math.round(i.lineTotal / i.quantity),
      condition: pending?.items.find((item) => item.orderLineIndex === index)?.condition || "good" as RetailAfterSaleInput["items"][number]["condition"],
      serialNumbers: pending?.items.find((item) => item.orderLineIndex === index)?.serialNumbers || [] as string[],
      internalBarcodes: pending?.items.find((item) => item.orderLineIndex === index)?.internalBarcodes || [] as string[],
    }))
  );

  React.useEffect(() => {
    if (!pending) return;
    setReason(pending.reason); setMethod(pending.paymentMethod);
    setRows(current => current.map((row, index) => {
      const item = pending.items.find(item => item.orderLineIndex === index);
      return item ? { ...row, ...item, selected: true, unitAmount: item.unitAmount ?? row.unitAmount, serialNumbers: item.serialNumbers || [], internalBarcodes: item.internalBarcodes || [] } : { ...row, selected: false };
    }));
  }, [pending]);
  const exhausted = Boolean(order.afterSaleSummary && order.afterSaleSummary.processedQuantity >= order.afterSaleSummary.totalQuantity);

  const update = (n: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((a) => a.map((r, i) => (i === n ? { ...r, ...patch } : r)));

  const items = rows.flatMap((r, i) =>
    r.selected
      ? [
        {
          orderLineIndex: i,
          quantity: r.quantity,
          unitAmount: r.unitAmount,
          condition: r.condition,
          serialNumbers: r.serialNumbers,
          internalBarcodes: r.internalBarcodes,
        },
      ]
      : []
  );

  const refundRatio =
    order.subtotal > 0
      ? Math.min(order.subtotal, Math.max(0, order.grandTotal - (order.shippingFee || 0))) / order.subtotal
      : 0;

  const total = items.reduce(
    (s, r) =>
      s +
      (type === "return"
        ? Math.floor((order.items[r.orderLineIndex].lineTotal / order.items[r.orderLineIndex].quantity) * refundRatio)
        : r.unitAmount) *
      r.quantity,
    0
  );

  const reconcileAfterSale = async (revoke = false) => {
    try {
      const result = await request.reconcile(revoke);
      if (!result) return;
      if ("revoked" in result) { toast.success("Đã thu hồi yêu cầu chưa ghi nhận."); close(); return; }
      toast.success("Đã xác minh chứng từ " + result.code); done();
    } catch (cause) { toast.error(getApiErrorMessage(cause, "Không đối chiếu được yêu cầu hậu mãi.")); }
  };
  const submit = async () => {
    if (!scope || blocked || (!pending && exhausted)) return;
    try {
      if (!pending && method === "cash" && !cashSessionId) throw new Error("Chọn phiên/két để chi tiền mặt.");
      const d = await request.send({
        ...(cashSessionId ? { cashSessionId } : {}),
        expectedVersion: order.version,
        type,
        orderId: order._id,
        items,
        paymentMethod: method,
        reason: reason.trim(),
      });
      if (!d) return;
      toast.success(`Đã tạo chứng từ ${d.code}`);
      done();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không tạo được chứng từ sau bán hàng."));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl text-white ${type === "return" ? "bg-orange-500" : "bg-cyan-600"}`}>
              {type === "return" ? <RotateCcw className="h-5 w-5" /> : <ShoppingBasket className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {type === "return" ? "Trả hàng / Hoàn tiền" : "Thu mua máy cũ từ khách"}
              </h3>
              <p className="text-xs text-slate-500">Đơn hàng: {order.orderCode}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {(pending || blocked) && <p role="alert" className="mt-4 text-sm text-amber-700">
          {request.storageError || (request.scopeChanged
            ? "Chi nhánh hoặc tài khoản đã thay đổi. Vui lòng mở lại đơn hàng."
            : pending?.type !== type && pending
              ? "Đơn này có yêu cầu đang chờ thuộc nghiệp vụ khác. Vui lòng mở lại đúng thao tác để kiểm tra kết quả."
              : "Yêu cầu đã được lưu. Nếu chưa nhận được kết quả, hãy thử lại yêu cầu cũ; nội dung được giữ nguyên để tránh chi tiền và nhập kho trùng.")}
        </p>}
        {request.candidates.length > 1 && <div><p>Có hai bản lưu khác nhau. Chọn từng yêu cầu để đối chiếu hoặc thu hồi.</p>{request.candidates.map((row, index) => <button key={index} disabled={busy || request.scopeChanged} onClick={() => request.selectCandidate(index)}>Yêu cầu {index + 1}: {row.type === "return" ? "Trả hàng" : "Thu mua"}</button>)}</div>}
        {pending && <button disabled={busy || request.scopeChanged || Boolean(request.storageError)} onClick={() => void reconcileAfterSale(true)}>Thu hồi yêu cầu hậu mãi chưa ghi nhận</button>}
        {pending && <button disabled={busy || request.scopeChanged || Boolean(request.storageError)} onClick={() => void reconcileAfterSale()}>Đối chiếu yêu cầu hậu mãi</button>}
        {exhausted && !pending && <p>Toàn bộ hàng đã được xử lý. Không có yêu cầu cũ để thử lại trên trình duyệt này.</p>}
        {pending && <div className="mt-3 text-sm"><p>Yêu cầu đã lưu: {pending.reason} · {pending.paymentMethod}{pending.paymentReference ? " · " + pending.paymentReference : ""}</p>{pending.items.map((item, index) => <p key={index}>Dòng {item.orderLineIndex + 1} · {item.quantity} sản phẩm · {item.condition}{item.unitAmount !== undefined ? " · " + money(item.unitAmount) + "/sản phẩm" : ""}{item.note ? " · " + item.note : ""}</p>)}</div>}
        <CashSessionPicker scope={scope} value={pending?.cashSessionId || cashSessionId} onChange={setCashSessionId} disabled={busy || Boolean(pending) || blocked || exhausted} />
        <fieldset disabled={busy || Boolean(pending) || blocked || exhausted}>
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-slate-400">Chọn mặt hàng áp dụng:</p>
          {order.items.map((item, i) => {
            const r = rows[i];
            const codes =
              item.trackingMode === "serial"
                ? item.serialNumbers
                : item.trackingMode === "unit_barcode"
                  ? item.internalBarcodes
                  : undefined;
            const processed = (order.afterSales || []).flatMap((doc) => doc.items).filter((line) => line.orderLineIndex === i);
            const remaining = Math.max(0, item.quantity - processed.reduce((sum, line) => sum + line.quantity, 0));
            const usedSerials = new Set(processed.flatMap((line) => [...(line.serialNumbers || []), ...(line.internalBarcodes || [])]).map((value) => value.trim().toUpperCase()));
            const key = item.trackingMode === "serial" ? "serialNumbers" : "internalBarcodes";

            return (
              <div
                key={i}
                className={`rounded-2xl border p-4 transition ${r.selected ? "border-cyan-400 bg-cyan-50/20" : "border-slate-200 bg-white"
                  }`}
              >
                <label className="flex items-center gap-2.5 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500"
                    checked={r.selected}
                    disabled={remaining === 0}
                    onChange={(e) => update(i, { selected: e.target.checked })}
                  />
                  <span>
                    {item.productName} <span className="text-xs text-slate-500">(Còn {remaining}/{item.quantity})</span> <span className="font-mono text-xs font-normal text-slate-500">({item.sku})</span>
                  </span>
                </label>

                {r.selected && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-semibold text-slate-600">
                      Số lượng
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                        type="number"
                        min={1}
                        max={remaining}
                        disabled={Boolean(codes?.length)}
                        value={r.quantity}
                        onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                      />
                    </label>

                    {type === "buyback" && (
                      <label className="text-xs font-semibold text-slate-600">
                        Định giá thu mua / đơn vị
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono"
                          type="number"
                          min={0}
                          value={r.unitAmount}
                          onChange={(e) => update(i, { unitAmount: Number(e.target.value) })}
                        />
                      </label>
                    )}

                    {codes?.length ? (
                      <div className="sm:col-span-2 space-y-1.5">
                        <span className="text-xs font-semibold text-slate-600">Chọn số Serial / IMEI trả:</span>
                        <div className="flex flex-wrap gap-2">
                          {codes.filter((code) => !usedSerials.has(code.trim().toUpperCase())).map((code) => {
                            const values = r[key];
                            const checked = values.includes(code);
                            return (
                              <label
                                key={code}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono cursor-pointer transition ${checked
                                    ? "border-cyan-500 bg-cyan-50 text-cyan-700 font-bold"
                                    : "border-slate-200 bg-white text-slate-600"
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...values, code]
                                      : values.filter((v) => v !== code);
                                    update(i, { [key]: next, quantity: Math.max(1, next.length) });
                                  }}
                                />
                                {code}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment Method and Reason */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Phương thức chi tiền
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm bg-white"
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
            >
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
              <option value="ewallet">Ví điện tử</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-600">
            Lý do thực hiện (bắt buộc)
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
              placeholder="Nhập lý do đổi trả/thu mua..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>

        </fieldset>
        {/* Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-400 uppercase font-semibold">Tổng số tiền chi hoàn:</span>
            <p className="font-mono text-xl font-bold text-slate-900">{money(total)}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy || blocked || request.candidates.length > 1 || (!pending && (exhausted || !items.length || !reason.trim()))}
              className="rounded-xl bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-40"
              onClick={() => void submit()}
            >
              {busy ? "Đang xử lý..." : pending ? "Thử lại yêu cầu cũ" : "Xác nhận"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CancelDialog({
  order,
  onClose,
  done,
}: {
  order: RetailOrder;
  onClose: () => void;
  done: (order: RetailOrder) => void;
}) {
  const { scope, userProfile } = useRetailScope();
  const identity = JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid, order._id]);
  const origin = React.useRef(identity), current = React.useRef(identity), mounted = React.useRef(true);
  current.current = identity;
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const storageKey = `retail-cancellation-pending:v1:${identity}`;

  const [initial] = React.useState(() => {
    try {
      return { pending: readCancellation(storageKey), error: "" };
    } catch { return { pending: null, error: "Không đọc được yêu cầu hủy đang chờ hoặc có bản lưu xung đột. Đóng cửa sổ và kiểm tra danh sách yêu cầu hủy đang chờ." }; }
  });
  const [pending, setPending] = React.useState(initial.pending);
  const [cashSessionId, setCashSessionId] = React.useState(initial.pending?.cashSessionId || "");
  const pendingRef = React.useRef(initial.pending), inFlight = React.useRef(false), completed = React.useRef(false);
  const [error, setError] = React.useState(initial.error);
  const blocked = origin.current !== identity || Boolean(initial.error) || !scope || !userProfile?.uid;
  const remaining = Math.max(0, order.paidAmount - (order.refundedAmount || 0));
  const refundRequired = pending ? pending.refunds.length > 0 : remaining > 0;
  const [reason, setReason] = React.useState(initial.pending?.reason || "");
  const [method, setMethod] = React.useState<RetailPaymentInput["method"]>(initial.pending?.refunds[0]?.method || "cash");
  const [submitting, setSubmitting] = React.useState(false);

  const reconcile = async (revoke = false) => {
    if (blocked || inFlight.current || completed.current || !scope || !pendingRef.current) return;
    const active = () => mounted.current && current.current === identity;
    inFlight.current = true; setSubmitting(true); setError("");
    try {
      await lockCancellation(storageKey, async () => {
        if (!active()) return;
        const request = readCancellation(storageKey);
        if (!request || !pendingRef.current || !sameCancellation(request, pendingRef.current)) throw new Error("Bản lưu đã thay đổi. Mở lại yêu cầu để kiểm tra.");
        saveCancellation(storageKey, request);
        const result = revoke ? await retailOrdersApi.revokeCancellation(scope, order._id, request) : await retailOrdersApi.reconcileCancellation(scope, order._id, request);
        if (result.status === "completed") {
          if (!result.order || result.order._id !== order._id) throw new Error("Kết quả không khớp đơn. Giữ yêu cầu cũ.");
          clearCancellation(storageKey, request); completed.current = true;
          if (active()) done(result.order);
        } else if (result.status === "revoked") {
          clearCancellation(storageKey, request); completed.current = true;
          if (active()) onClose();
        } else if (active()) setError(result.message);
      });
    } catch (cause) { if (active()) setError(getApiErrorMessage(cause, "Không đối chiếu được. Giữ yêu cầu cũ.")); }
    finally { inFlight.current = false; if (active()) setSubmitting(false); }
  };

  const canCreate = ["draft", "confirmed", "completed"].includes(order.status);
  const handleCancel = async () => {
    if (!reason.trim() || inFlight.current || completed.current || blocked || !scope) return;
    const active = () => mounted.current && current.current === identity;
    inFlight.current = true;
    setError("");
    setSubmitting(true);
    try {
      await lockCancellation(storageKey, async () => {
        if (!active()) return;
        const saved = readCancellation(storageKey);
        if (pendingRef.current && (!saved || !sameCancellation(saved, pendingRef.current))) throw new Error("Bản lưu đã thay đổi. Đóng và mở lại đơn để kiểm tra.");
        if (saved && !pendingRef.current) {
          pendingRef.current = saved;
          setPending(saved);
          setReason(saved.reason);
          setMethod(saved.refunds[0]?.method || "cash");
          setError("Đã tìm thấy yêu cầu hủy ở tab khác. Kiểm tra và thử lại đúng yêu cầu cũ.");
          return;
        }
        if (!saved && !canCreate) throw new Error("Đơn không còn đủ điều kiện tạo yêu cầu hủy mới.");
        const retry = Boolean(saved);
        if (!saved && remaining > 0 && method === "cash" && !cashSessionId) throw new Error("Chọn phiên/két để hoàn tiền mặt.");
        const request: PendingCancellation = saved || { ...(cashSessionId ? { cashSessionId } : {}), reason: reason.trim(), refunds: remaining ? [{ method, amount: remaining }] : [], idempotencyKey: crypto.randomUUID(), expectedVersion: order.version };
        saveCancellation(storageKey, request);
        pendingRef.current = request;
        setPending(request);
        try {
          const updated = await retailOrdersApi.cancel(scope, order._id, request);
          completed.current = true;
          clearCancellation(storageKey, request);
          if (active()) done(updated);
        } catch (cause) {
          if (!retry && cause instanceof ApiClientError && cause.status === 400 && cause.code === "CANCELLATION_INVALID") {
            clearCancellation(storageKey, request);
            pendingRef.current = null;
            if (active()) setPending(null);
          }
          throw cause;
        }
      });
    } catch (cause) {
      if (active()) setError(getApiErrorMessage(cause, "Chưa rõ kết quả hủy. Hãy thử lại yêu cầu cũ."));
    } finally { inFlight.current = false; if (active()) setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-rose-600">
            <Ban className="h-5 w-5" />
            <h2 className="text-lg font-bold text-slate-900">
              Hủy đơn{refundRequired ? " và hoàn tiền" : ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Lý do hủy (bắt buộc):</label>
          <textarea
            aria-label="Lý do hủy"
            disabled={Boolean(pending) || blocked || submitting || !canCreate}
            className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/10"
            rows={3}
            placeholder="Nhập lý do hủy đơn hàng..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {refundRequired && <CashSessionPicker scope={scope} value={pending?.cashSessionId || cashSessionId} onChange={setCashSessionId} disabled={submitting || Boolean(pending) || blocked} />}
        {refundRequired && (
          <div>
            <label className="text-xs font-semibold text-slate-600">Phương thức hoàn tiền:</label>
            <select
              aria-label="Phương thức hoàn tiền"
              disabled={Boolean(pending) || blocked || submitting || !canCreate}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
            >
              <option value="cash">Tiền mặt</option>
              <option value="card">Thẻ</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="ewallet">Ví điện tử</option>
            </select>
          </div>
        )}

        <button
          type="button"
          disabled={!reason.trim() || submitting || blocked || completed.current || (!pending && !canCreate)}
          className="w-full rounded-xl bg-red-600 py-3 font-bold text-white shadow-md shadow-red-500/20 transition hover:bg-red-700 active:scale-95 disabled:opacity-40"
          onClick={() => void handleCancel()}
        >
          {submitting ? "Đang xử lý..." : pending ? "Thử lại yêu cầu hủy cũ" : "Xác nhận hủy đơn"}
        </button>
        {pending && <button disabled={submitting || blocked || completed.current} onClick={() => void reconcile()}>Đối chiếu yêu cầu hủy</button>}
        {pending && <button disabled={submitting || blocked || completed.current} onClick={() => void reconcile(true)}>Thu hồi yêu cầu chưa ghi nhận</button>}
        {!pending && !canCreate && <p>Không có yêu cầu hủy đang chờ trên trình duyệt này. Không thể tạo yêu cầu hủy mới cho đơn.</p>}
        {pending && <ul className="text-sm">{pending.refunds.map((refund, index) => <li key={index}>Hoàn {money(refund.amount)} · {refund.method}{refund.reference ? " · " + refund.reference : ""}</li>)}</ul>}
        {pending && <p className="text-sm">Giữ nguyên yêu cầu hủy và số tiền hoàn để tránh xử lý hai lần. Đóng cửa sổ không hủy thao tác đã gửi.</p>}
        {blocked && <p role="alert">Phạm vi đã thay đổi hoặc không đọc được yêu cầu. Vui lòng mở lại đúng đơn để đối chiếu.</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
