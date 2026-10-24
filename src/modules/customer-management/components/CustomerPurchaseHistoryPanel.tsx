import React from "react";
import { cn } from "../../student-management/lib/utils";
import { customerApi } from "../customerApi";
import type { CustomerPurchaseHistory, CustomerPurchaseHistoryDevice } from "../types";

type Props = { customerId: string; companyCode: string; branchId?: string };

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = (value?: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("vi-VN");
};
const statusLabel = (status?: string) => ({ draft: "Nháp", confirmed: "Đã xác nhận", completed: "Hoàn thành", cancelled: "Đã hủy" }[status || ""] || status || "Không rõ");
const orderLabel = (order: CustomerPurchaseHistory["items"][number]) => order.orderCode || `Đơn treo #${order._id.slice(-6)}`;

function warrantyState(endAt?: string) {
  if (!endAt) return { label: "Chưa cập nhật bảo hành", className: "bg-surface-container text-on-surface-variant" };

  const endDate = new Date(endAt);
  if (Number.isNaN(endDate.getTime())) return { label: "Chưa cập nhật bảo hành", className: "bg-surface-container text-on-surface-variant" };
  endDate.setHours(23, 59, 59, 999);
  const inWarranty = endDate.getTime() >= Date.now();
  return inWarranty
    ? { label: "Còn bảo hành", className: "bg-primary-container text-on-primary-container" }
    : { label: "Đã hết bảo hành", className: "bg-error-container text-on-error-container" };
}

function DeviceCard({ device }: { device: CustomerPurchaseHistoryDevice }) {
  const warranty = warrantyState(device.warrantyEndAt);
  return (
    <article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-semibold text-on-surface text-balance">{device.productName}</h4>
          <p className="mt-1 text-xs text-on-surface-variant">SKU: {device.sku || "—"}</p>
        </div>
        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", warranty.className)}>
          {warranty.label}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-on-surface-variant">IMEI / Serial</dt>
          <dd className="mt-1 break-all font-mono text-sm font-medium tabular-nums text-on-surface">{device.serialNumber || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-on-surface-variant">Mã vạch nội bộ</dt>
          <dd className="mt-1 break-all font-mono text-sm font-medium tabular-nums text-on-surface">{device.internalBarcode || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Ngày bán</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-on-surface">{date(device.soldAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Bắt đầu bảo hành</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-on-surface">{date(device.warrantyStartAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-on-surface-variant">Hạn bảo hành</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-on-surface">{date(device.warrantyEndAt)}</dd>
        </div>
      </dl>
      {device.orderCode && <p className="mt-3 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">Đơn hàng: <span className="font-semibold text-on-surface">{device.orderCode}</span></p>}
    </article>
  );
}

export default function CustomerPurchaseHistoryPanel({ customerId, companyCode, branchId }: Props) {
  const [history, setHistory] = React.useState<CustomerPurchaseHistory | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!branchId) { setHistory(null); setLoading(false); setError(""); return; }
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    void customerApi.purchaseHistory(customerId, { companyCode, branchId })
      .then((data) => { if (active) setHistory(data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được lịch sử mua hàng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchId, companyCode, customerId]);

  if (!branchId) return <section className="mt-6 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Vui lòng chọn chi nhánh để xem lịch sử mua hàng.</section>;
  if (loading) return <section className="mt-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant" role="status" aria-live="polite" aria-busy="true">Đang tải lịch sử mua hàng...</section>;
  if (error) return <section className="mt-6 rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container" role="alert">{error}</section>;
  if (!history) return null;

  const cards = [
    ["Số đơn", String(history.summary.orderCount)],
    ["Tổng đã mua", currency.format(history.summary.totalPurchased)],
    ["Đã thanh toán", currency.format(history.summary.totalPaid)],
    ["Công nợ hiện tại", currency.format(history.summary.currentDebt)],
    ["Lần mua gần nhất", date(history.summary.lastPurchaseAt)],
  ];

  return (
    <section className="mt-6 space-y-4 border-t border-outline-variant pt-5" aria-label="Lịch sử mua hàng">
      <div>
        <h3 className="text-sm font-semibold text-on-surface text-balance">Lịch sử mua hàng</h3>
        <p className="mt-1 text-xs text-on-surface-variant text-pretty">Đơn hàng và thiết bị đã mua tại chi nhánh đang chọn.</p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {cards.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 break-words text-sm font-semibold tabular-nums text-on-surface">{value}</p></div>)}
      </div>
      {history.items.length === 0
        ? <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant text-pretty">Chưa có đơn mua tại chi nhánh này. Khi bán hàng, chọn khách này tại POS để lưu đơn vào hồ sơ.</div>
        : <div className="space-y-2.5">{history.items.map((order) => <article key={order._id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-on-surface">{orderLabel(order)}</p><p className="mt-1 text-xs text-on-surface-variant">{date(order.businessDate)} · {statusLabel(order.status)}</p></div><p className="break-words font-semibold tabular-nums text-primary">{currency.format(order.grandTotal)}</p></div><div className="mt-3 grid gap-2 text-xs text-on-surface-variant sm:grid-cols-3"><p className="min-w-0 break-words">Đã thanh toán: <span className="font-semibold tabular-nums text-on-surface">{currency.format(order.paidAmount)}</span></p><p className="min-w-0 break-words">Công nợ: <span className="font-semibold tabular-nums text-on-surface">{currency.format(order.dueAmount)}</span></p><p className="min-w-0">{order.itemCount} sản phẩm</p></div><p className="mt-2 text-xs text-on-surface-variant">Nhân viên: {order.salespersonName || "—"}</p></article>)}</div>}
      <div className="space-y-3 border-t border-outline-variant pt-4">
        <div>
          <h3 className="text-sm font-semibold text-on-surface text-balance">Thiết bị đã mua</h3>
          <p className="mt-1 text-xs text-on-surface-variant text-pretty">IMEI / serial, mã vạch và thời hạn bảo hành theo từng máy.</p>
        </div>
        {history.devices.length === 0
          ? <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant text-pretty">Chưa có máy có IMEI / serial tại chi nhánh này. Nếu vừa bán máy, quét mã tại POS để theo dõi bảo hành theo từng thiết bị.</div>
          : <div className="space-y-2.5">{history.devices.map((device) => <DeviceCard key={device._id} device={device} />)}</div>}
      </div>
    </section>
  );
}
