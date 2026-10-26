import { useEffect, useState } from "react";
import { orderWarrantyService, type OrderWarrantyResult, type OrderWarrantyStatus } from "../../../services/orderWarrantyService";
import { useRetailScope } from "../hooks/useRetailScope";

const statusLabels: Record<OrderWarrantyStatus, string> = {
  active: "Còn bảo hành", expiring: "Sắp hết hạn", expired: "Hết bảo hành",
  pending: "Chưa bắt đầu", none: "Không áp dụng", unrecorded: "Chưa ghi nhận",
};
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
const controlClass = "min-h-11 rounded-lg border border-outline bg-surface-container-lowest px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const buttonClass = "min-h-11 rounded-lg border border-outline px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

function OrderWarrantyContent({ companyCode, branchId }: { companyCode: string; branchId: string }) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ q: "", status: "all" as OrderWarrantyStatus | "all", days: 30, page: 1 });
  const [result, setResult] = useState<OrderWarrantyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    orderWarrantyService.list({ companyCode, branchId, ...filters }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu bảo hành."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [companyCode, branchId, filters, reload]);

  return <section className="space-y-4 text-on-surface">
    <header>
      <h2 className="text-balance text-xl font-semibold">Bảo hành theo đơn hàng</h2>
      <p className="mt-1 text-pretty text-sm text-on-surface-variant">Tra cứu sản phẩm đã bán theo đơn hàng, hóa đơn hoặc khách hàng. Thời hạn được ghi nhận theo chính sách tại lúc bán.</p>
    </header>
    <form onSubmit={event => { event.preventDefault(); setFilters(previous => ({ ...previous, q: search.trim(), page: 1 })); }} className="flex flex-wrap items-end gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Tìm bảo hành
        <input className={controlClass} value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="Mã đơn, hóa đơn, khách hàng, số điện thoại, sản phẩm hoặc SKU" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Trạng thái
        <select className={controlClass} value={filters.status} onChange={event => setFilters(previous => ({ ...previous, status: event.target.value as typeof previous.status, page: 1 }))}>
          <option value="all">Mọi trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">Ngưỡng sắp hết hạn
        <select className={controlClass} value={filters.days} onChange={event => setFilters(previous => ({ ...previous, days: Number(event.target.value), page: 1 }))}>
          {[7, 30, 60, 90].map(days => <option key={days} value={days}>{days} ngày</option>)}
        </select>
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Tra cứu</button>
    </form>
    {error && <div role="alert" className="space-y-2 rounded-xl border border-outline p-4"><p>{error}</p><button type="button" className={buttonClass} onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
    <div aria-busy={loading} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải bảo hành…</p>}
      {result && <>
        <p role="status" className="mb-3 text-sm tabular-nums">{result.total} dòng sản phẩm phù hợp</p>
        {result.items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm tabular-nums">
          <caption className="sr-only">Bảo hành sản phẩm đã bán tại chi nhánh đang chọn</caption>
          <thead className="border-b border-outline-variant text-on-surface-variant"><tr>
            {["Đơn / hóa đơn", "Khách hàng", "Sản phẩm", "Số lượng", "Ngày bán", "Thời hạn bảo hành", "Trạng thái"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody>{result.items.map(row => <tr key={row.id} className="border-b border-outline-variant">
            <td className="px-3 py-3"><p className="font-medium">{row.orderCode}</p><p className="text-on-surface-variant">{row.invoiceNo}</p></td>
            <td className="px-3 py-3"><p>{row.customerName || "Khách lẻ"}</p><p className="text-on-surface-variant">{row.customerPhone}</p></td>
            <td className="px-3 py-3"><p>{row.productName}</p><p className="text-on-surface-variant">{row.sku}</p></td>
            <td className="px-3 py-3">{row.quantity}</td>
            <td className="whitespace-nowrap px-3 py-3">{dateLabel(row.soldAt)}</td>
            <td className="px-3 py-3">{row.warrantyStartAt && row.warrantyEndAt ? <><p>{dateLabel(row.warrantyStartAt)} – {dateLabel(row.warrantyEndAt)}</p>{row.warrantyMonths != null && <p className="text-on-surface-variant">{row.warrantyMonths} tháng</p>}</> : statusLabels[row.status]}</td>
            <td className="px-3 py-3"><p className="font-medium">{statusLabels[row.status]}</p>{row.daysLeft != null && <p className="text-on-surface-variant">Còn {row.daysLeft} ngày</p>}</td>
          </tr>)}</tbody>
        </table></div> : <div className="space-y-2 py-4"><p className="text-pretty text-sm text-on-surface-variant">Không có sản phẩm phù hợp. Đơn cần được xác nhận bán; sản phẩm đã hoàn trả toàn bộ sẽ không xuất hiện.</p><button type="button" className={buttonClass} onClick={() => { setSearch(""); setFilters({ q: "", status: "all", days: 30, page: 1 }); }}>Xóa bộ lọc</button></div>}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm tabular-nums">
          <button type="button" className={buttonClass} disabled={filters.page <= 1} onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}>Trang trước</button>
          <span>Trang {result.page} / {Math.max(1, Math.ceil(result.total / result.limit))}</span>
          <button type="button" className={buttonClass} disabled={result.page * result.limit >= result.total} onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}>Trang sau</button>
        </div>
      </>}
    </div>
    <p className="text-pretty text-sm text-on-surface-variant">“Chưa ghi nhận” là đơn cũ chưa lưu thời hạn bảo hành. Số lượng hiển thị đã trừ hàng trả lại hoặc thu mua lại.</p>
  </section>;
}

export default function OrderWarrantyPage() {
  const { scope } = useRetailScope();
  return scope ? <OrderWarrantyContent key={`${scope.companyCode}:${scope.branchId}`} companyCode={scope.companyCode} branchId={scope.branchId} />
    : <p role="status" className="text-sm text-on-surface-variant">Chọn chi nhánh để tra cứu bảo hành.</p>;
}
