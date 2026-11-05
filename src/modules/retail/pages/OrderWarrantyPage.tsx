import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { cn } from "../../student-management/lib/utils";
import { orderWarrantyService, type OrderWarrantyResult, type OrderWarrantyStatus } from "../../../services/orderWarrantyService";
import { useRetailScope } from "../hooks/useRetailScope";
import { RetailEmptyState } from "../components/RetailEmptyState";

const statusLabels: Record<OrderWarrantyStatus, string> = {
  active: "Còn bảo hành", expiring: "Sắp hết hạn", expired: "Hết bảo hành",
  pending: "Chưa bắt đầu", none: "Không áp dụng", unrecorded: "Chưa ghi nhận",
};
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
const controlClass = "h-10 w-full min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-normal leading-5 text-on-surface placeholder:text-on-surface-variant hover:border-primary focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:ring-0";
const buttonClass = "h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";

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

  return <section className="flex flex-1 flex-col gap-4 text-on-surface">
    <header className="border-b border-outline-variant pb-3">
      <h2 className="retail-page-title text-balance text-lg font-semibold">Bảo hành theo đơn hàng</h2>
    </header>
    <form onSubmit={event => { event.preventDefault(); setFilters(previous => ({ ...previous, q: search.trim(), page: 1 })); }} className="grid grid-cols-1 items-end gap-3 border-b border-outline-variant pb-4 sm:grid-cols-2 xl:flex">
      <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-on-surface sm:col-span-2 xl:flex-1">Tìm bảo hành
        <span className="relative block">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface/60" />
          <input className={cn(controlClass, "pl-10")} value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="Mã đơn, hóa đơn, khách hàng, số điện thoại, sản phẩm hoặc SKU" />
        </span>
      </label>
      <div className="flex min-w-0 flex-col gap-1.5 xl:w-48 xl:shrink-0">
        <span aria-hidden="true" className="text-sm font-medium text-on-surface">Trạng thái</span>
        <StyledSelect ariaLabel="Trạng thái" className={controlClass} value={filters.status} onChange={status => setFilters(previous => ({ ...previous, status: status as typeof previous.status, page: 1 }))} options={[{ value: "all", label: "Mọi trạng thái" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 xl:w-48 xl:shrink-0">
        <span aria-hidden="true" className="text-sm font-medium text-on-surface">Ngưỡng sắp hết hạn</span>
        <StyledSelect ariaLabel="Ngưỡng sắp hết hạn" className={controlClass} value={String(filters.days)} onChange={days => setFilters(previous => ({ ...previous, days: Number(days), page: 1 }))} options={[7, 30, 60, 90].map(days => ({ value: String(days), label: `${days} ngày` }))} />
      </div>
      <button type="submit" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary sm:col-span-2"><Search aria-hidden="true" className="size-4" />Tra cứu</button>
    </form>
    {error && <div role="alert" className="space-y-2 rounded-xl border border-outline p-4"><p>{error}</p><button type="button" className={buttonClass} onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
    <div aria-busy={loading} className="min-h-64">
      {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải bảo hành…</p>}
      {result && <>
        <p role="status" className="mb-3 text-sm tabular-nums"><span className="font-semibold text-cyan-700">{result.total}</span> dòng sản phẩm phù hợp</p>
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
        </table></div> : <div className="flex flex-col items-center py-4"><RetailEmptyState kind={filters.q || filters.status !== "all" ? "generic" : "resource"}>Không có sản phẩm phù hợp. Đơn cần được xác nhận bán; sản phẩm đã hoàn trả toàn bộ sẽ không xuất hiện.</RetailEmptyState><button type="button" className={buttonClass} onClick={() => { setSearch(""); setFilters({ q: "", status: "all", days: 30, page: 1 }); }}>Xóa bộ lọc</button></div>}
      </>}
    </div>
    <footer className="mt-auto flex flex-col gap-3 border-t border-outline-variant pt-3 xl:flex-row xl:items-center xl:justify-between">
      <p className="text-pretty text-sm text-on-surface-variant">“Chưa ghi nhận” là đơn cũ chưa lưu thời hạn bảo hành. Số lượng hiển thị đã trừ hàng trả lại hoặc thu mua lại.</p>
      {result && <nav aria-label="Phân trang bảo hành" className="flex shrink-0 flex-wrap items-center gap-3 text-sm tabular-nums">
        <button type="button" className={buttonClass} disabled={filters.page <= 1} onClick={() => setFilters(previous => ({ ...previous, page: previous.page - 1 }))}>Trang trước</button>
        <span>Trang {result.page} / {Math.max(1, Math.ceil(result.total / result.limit))}</span>
        <button type="button" className={buttonClass} disabled={result.page * result.limit >= result.total} onClick={() => setFilters(previous => ({ ...previous, page: previous.page + 1 }))}>Trang sau</button>
      </nav>}
    </footer>
  </section>;
}

export default function OrderWarrantyPage() {
  const { scope } = useRetailScope();
  return scope ? <OrderWarrantyContent key={`${scope.companyCode}:${scope.branchId}`} companyCode={scope.companyCode} branchId={scope.branchId} />
    : <p role="status" className="text-sm text-on-surface-variant">Chọn chi nhánh để tra cứu bảo hành.</p>;
}
