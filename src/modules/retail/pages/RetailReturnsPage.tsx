import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, RefreshCw, RotateCcw, Search, ShoppingBag, type LucideIcon } from "lucide-react";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { retailAfterSalesApi } from "../api/retailAfterSales.api";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailAfterSale, RetailAfterSaleType } from "../types";

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
    <main className="space-y-5 text-on-surface">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-balance text-xl font-semibold">Đổi trả &amp; thu mua</h1>
          <p className="mt-1 text-pretty text-sm text-on-surface-variant">Tra cứu phiếu hoàn tiền và phiếu thu mua gắn với đơn bán gốc.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Làm mới
        </button>
      </header>

      <section aria-label="Tổng quan chứng từ hiện trên trang" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={FileText} label="Tổng số phiếu" value={total.toLocaleString("vi-VN")} detail="Theo bộ lọc đang chọn" />
        <SummaryCard icon={RotateCcw} label="Khách trả hàng" value={String(returnItems.length)} detail={`${money(returnTotal)} trên trang này`} />
        <SummaryCard icon={ShoppingBag} label="Thu mua hàng cũ" value={String(buybackItems.length)} detail={`${money(buybackTotal)} trên trang này`} />
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
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-on-surface-variant">Loại phiếu</span>
          <select
            value={type}
            onChange={(event) => { setType(event.target.value as RetailAfterSaleType | ""); setPage(1); }}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
          >
            <option value="">Tất cả</option>
            <option value="return">Khách trả hàng</option>
            <option value="buyback">Thu mua hàng cũ</option>
          </select>
        </label>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error bg-surface-container-lowest p-3 text-sm text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="min-h-11 font-semibold underline focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button>
        </div>
      )}

      <section aria-label="Danh sách phiếu đổi trả" aria-busy={loading} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
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
          <ul className="divide-y divide-outline-variant">
            {items.map((item) => <AfterSaleCard key={item._id} item={item} />)}
          </ul>
        ) : error ? (
          <p role="status" className="text-pretty p-8 text-center text-sm text-on-surface-variant">Không tải được danh sách. Hãy thử tải lại.</p>
        ) : (
          <div className="space-y-3 p-8 text-center">
            <h2 className="text-balance font-semibold">{hasFilters ? "Không tìm thấy chứng từ phù hợp" : "Chưa có chứng từ đổi trả"}</h2>
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

      {total > 0 && <nav aria-label="Phân trang chứng từ" className="flex flex-wrap items-center justify-between gap-3">
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

function SummaryCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="min-w-0">
        <p className="text-pretty text-sm text-on-surface-variant">{label}</p>
        <p className="mt-1 tabular-nums text-xl font-semibold">{value}</p>
        <p className="mt-1 text-pretty text-xs text-on-surface-variant">{detail}</p>
      </div>
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
    </article>
  );
}

function AfterSaleCard({ item }: { item: RetailAfterSale }) {
  const isReturn = item.type === "return";
  return (
    <li className="p-4 sm:p-5">
      <article className="space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-all font-semibold">{item.code}</h2>
            <p className="mt-1 text-pretty text-sm text-on-surface-variant">Đơn gốc {item.orderCode} · {new Date(item.createdAt).toLocaleString("vi-VN")}</p>
          </div>
          <span className="rounded-full border border-outline-variant px-3 py-1 text-xs font-semibold">
            {isReturn ? "Khách trả hàng" : "Thu mua hàng cũ"}
          </span>
        </header>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p className="text-pretty"><span className="text-on-surface-variant">Khách hàng: </span>{item.customerName || "Khách lẻ"}</p>
          <p className="text-pretty"><span className="text-on-surface-variant">Phương thức chi: </span>{paymentLabels[item.paymentMethod] || item.paymentMethod}</p>
          <p className="tabular-nums font-semibold"><span className="font-normal text-on-surface-variant">Tổng tiền: </span>{money(item.totalAmount)}</p>
        </div>
        <details className="group rounded-lg border border-outline-variant bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">Chi tiết {item.items.length} mặt hàng và lý do</summary>
          <div className="mt-3 space-y-3">
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
        </details>
      </article>
    </li>
  );
}
