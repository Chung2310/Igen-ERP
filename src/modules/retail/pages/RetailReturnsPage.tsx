import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, RotateCcw, Search, ShoppingBag, type LucideIcon } from "lucide-react";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailAfterSale, RetailAfterSaleType } from "../types";
import { cn } from "../../student-management/lib/utils";
import { Dropdown } from "../../../components/common/Dropdown";
import { RetailEmptyState } from "../components/RetailEmptyState";
import { ErpRefreshButton } from "../../../components/common/ErpRefreshButton";

const PAGE_SIZE = 20;
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
const paymentLabels: Record<string, string> = {
  cash: "Tiền mặt",
  card: "Thẻ ngân hàng",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};
const conditionLabels: Record<string, string> = {
  like_new: "Như mới",
  good: "Tốt",
  fair: "Trung bình",
  poor: "Cũ / lỗi",
};

type Props = { onOpenOrders?: () => void };

export default function RetailReturnsPage({ onOpenOrders }: Props) {
  const { scope } = useRetailScope();
  const [items, setItems] = useState<RetailAfterSale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RetailAfterSaleType | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!scope) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    setItems([]);
    setTotal(0);
    try {
      const result = await retailAfterSalesApi.list(scope, {
        q: query.trim() || undefined,
        type: type || undefined,
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (currentRequest !== requestId.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(getApiErrorMessage(cause, "Không tải được chứng từ đổi trả."));
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [scope?.companyCode, scope?.branchId, query, type, page]);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  const returnItems = items.filter((item) => item.type === "return");
  const buybackItems = items.filter((item) => item.type === "buyback");
  const returnTotal = returnItems.reduce((sum, item) => sum + item.totalAmount, 0);
  const buybackTotal = buybackItems.reduce((sum, item) => sum + item.totalAmount, 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(query.trim() || type);

  if (!scope) {
    return <p className="text-pretty rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-sm text-on-surface-variant">Vui lòng chọn chi nhánh để xem chứng từ đổi trả.</p>;
  }

  return (
    <main className="flex flex-1 flex-col gap-5 text-on-surface">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="ml-auto"><ErpRefreshButton onClick={() => void load()} loading={loading} /></div>
      </header>

      <section aria-label="Tổng quan chứng từ hiện trên trang" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={FileText} tone="blue" label="Tổng số phiếu" value={total.toLocaleString("vi-VN")} detail="Theo bộ lọc đang chọn" />
        <SummaryCard icon={RotateCcw} tone="orange" label="Khách trả hàng" value={String(returnItems.length)} detail={`${money(returnTotal)} trên trang này`} />
        <SummaryCard icon={ShoppingBag} tone="green" label="Thu mua hàng cũ" value={String(buybackItems.length)} detail={`${money(buybackTotal)} trên trang này`} />
      </section>

      <section aria-label="Bộ lọc chứng từ" className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 sm:grid-cols-[minmax(16rem,1fr)_14rem]">
        <label className="relative block">
          <span className="sr-only">Tìm chứng từ</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Mã phiếu, đơn hàng, khách hàng hoặc sản phẩm"
            className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-primary"
          />
        </label>
        <div className="flex min-w-0 items-center gap-2 text-sm"><span className="shrink-0 text-on-surface-variant">Loại phiếu</span><Dropdown aria-label="Loại phiếu" value={type} onChange={(value) => { setType(value as RetailAfterSaleType | ""); setPage(1); }} options={[{ value: "", label: "Tất cả" }, { value: "return", label: "Khách trả hàng" }, { value: "buyback", label: "Thu mua hàng cũ" }]} variant="filter" size="md" className="w-full" /></div>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-surface-container-lowest p-3 text-sm text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="min-h-11 font-semibold underline focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button>
        </div>
      )}

      <section aria-label="Danh sách phiếu đổi trả" aria-busy={loading} className={cn("min-w-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest", !loading && items.length > 0 && "flex flex-1 flex-col")}>
        {loading ? (
          <div role="status" aria-live="polite" className="p-4 sm:p-5">
            <span className="sr-only">Đang tải chứng từ đổi trả...</span>
            <ul aria-hidden="true" className="divide-y divide-outline-variant">
              {Array.from({ length: 3 }, (_, index) => <li key={index} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="h-4 w-40 rounded bg-surface-container-high" />
                <div className="h-3 w-72 max-w-full rounded bg-surface-container-high" />
                <div className="h-3 w-full rounded bg-surface-container-high" />
              </li>)}
            </ul>
          </div>
        ) : items.length ? (
          <div className="visible-scrollbar flex-1 overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary" role="region" aria-label="Bảng phiếu đổi trả, cuộn ngang để xem các cột" tabIndex={0}>
            <table className="w-full min-w-[100rem] text-left text-sm">
              <caption className="sr-only">Danh sách phiếu đổi trả và thu mua</caption>
              <thead className="bg-surface text-on-surface-variant">
                <tr className="border-b border-outline-variant">
                  <th scope="col" className="px-4 py-3 font-semibold">Mã phiếu</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Loại phiếu</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Đơn gốc</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Ngày tạo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Khách hàng</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Phương thức chi</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {items.map((item) => <AfterSaleRow key={item._id} item={item} />)}
              </tbody>
            </table>
          </div>
        ) : error ? (
          <p role="status" className="text-pretty p-8 text-center text-sm text-on-surface-variant">Không tải được danh sách. Hãy thử tải lại.</p>
        ) : (
          <div className="space-y-3 p-8 text-center">
            <RetailEmptyState kind={hasFilters ? "generic" : "fee"} compact>{hasFilters ? "Không tìm thấy chứng từ phù hợp" : "Chưa có chứng từ đổi trả"}</RetailEmptyState>
            <p className="text-pretty text-sm text-on-surface-variant">
              {hasFilters ? "Thử đổi từ khóa hoặc loại phiếu để xem kết quả khác." : "Tạo phiếu từ đơn hàng đã hoàn tất để ghi nhận hoàn tiền hoặc thu mua lại."}
            </p>
            {hasFilters ? (
              <button type="button" onClick={() => { setQuery(""); setType(""); setPage(1); }} className="min-h-11 rounded-lg border border-outline px-4 text-sm font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Xóa bộ lọc</button>
            ) : onOpenOrders ? (
              <button type="button" onClick={onOpenOrders} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Mở đơn hàng</button>
            ) : null}
          </div>
        )}
      </section>

      {total > 0 && <nav aria-label="Phân trang chứng từ" className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">Trang {page} / {pageCount} · {total.toLocaleString("vi-VN")} phiếu</p>
        <div className="flex gap-2">
          <button type="button" aria-label="Trang trước" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-outline px-3 text-sm font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
            <ChevronLeft aria-hidden="true" className="size-4" /> Trước
          </button>
          <button type="button" aria-label="Trang sau" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount || loading} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-outline px-3 text-sm font-medium text-on-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
            Sau <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </nav>}
    </main>
  );
}

function SummaryCard({ icon: Icon, tone, label, value, detail }: { icon: LucideIcon; tone: "blue" | "orange" | "green"; label: string; value: string; detail: string }) {
  return (
    <article className={cn("retail-stat-card flex min-w-0 items-center justify-between gap-2.5 rounded-md px-3.5 py-2.5", `retail-stat-card--${tone}`)}>
      <div className="min-w-0">
        <p className="text-pretty text-xs font-medium">{label}</p>
        <p className="mt-1 tabular-nums text-lg font-semibold sm:text-xl">{value}</p>
        <p className="mt-0.5 text-pretty text-xs text-white/90">{detail}</p>
      </div>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/15"><Icon aria-hidden="true" className="size-4" /></span>
    </article>
  );
}

function AfterSaleRow({ item }: { item: RetailAfterSale }) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const isReturn = item.type === "return";
  return (
    <>
      <tr className="hover:bg-surface-container-low">
        <th scope="row" className="px-4 py-3 font-semibold">{item.code}</th>
        <td className="px-4 py-3"><span className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold">{isReturn ? "Khách trả hàng" : "Thu mua hàng cũ"}</span></td>
        <td className="px-4 py-3"><span className="sr-only">Đơn gốc </span>{item.orderCode}</td>
        <td className="whitespace-nowrap px-4 py-3 tabular-nums">{new Date(item.createdAt).toLocaleString("vi-VN")}</td>
        <td className="px-4 py-3">{item.customerName || "Khách lẻ"}</td>
        <td className="px-4 py-3">{paymentLabels[item.paymentMethod] || item.paymentMethod}</td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{money(item.totalAmount)}</td>
        <td className="px-4 py-3">
          <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((current) => !current)} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1 font-medium text-primary hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
            Chi tiết {item.items.length} mặt hàng và lý do <ChevronDown aria-hidden="true" className={cn("size-4", expanded && "rotate-180")} />
          </button>
        </td>
      </tr>
      <tr id={detailsId} hidden={!expanded} className="bg-surface">
        <td colSpan={8} className="px-4 py-4">
          <div className="space-y-3">
            <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest">
              {item.items.map((line, index) => (
                <li key={`${line.sku}-${index}`} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-pretty font-medium">{line.productName}</p>
                    <p className="mt-1 break-all text-pretty text-xs text-on-surface-variant">{line.sku} · {line.quantity} sản phẩm{line.condition ? ` · ${conditionLabels[line.condition] || line.condition}` : ""}</p>
                    {(line.serialNumbers?.length || line.internalBarcodes?.length) ? <p className="mt-1 break-all text-pretty text-xs text-on-surface-variant">IMEI / mã máy: {[...(line.serialNumbers || []), ...(line.internalBarcodes || [])].join(", ")}</p> : null}
                  </div>
                  <p className="shrink-0 tabular-nums font-medium">{money(line.lineAmount)}</p>
                </li>
              ))}
            </ul>
            <p className="text-pretty text-sm"><span className="font-medium">Lý do: </span>{item.reason}</p>
          </div>
        </td>
      </tr>
    </>
  );
}
