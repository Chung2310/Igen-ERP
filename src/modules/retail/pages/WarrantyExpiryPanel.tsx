import { useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { retailWarrantyService, type WarrantyLookupResult, type WarrantyLookupScope } from "../../../services/retailWarrantyService";
import { StyledSelect } from "../../../components/common/StyledSelect";

const field = "min-h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
const statuses: Record<string, string> = { in_stock: "Còn tồn", sold: "Đã bán", reserved: "Đã giữ hàng", scrapped: "Đã loại bỏ" };
const payers: Record<string, string> = { supplier: "Nhà cung cấp", shop: "Doanh nghiệp", customer: "Khách hàng" };
const date = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";

export default function WarrantyExpiryPanel({ scope }: { scope?: WarrantyLookupScope }) {
  const [kind, setKind] = useState<"customer" | "supplier">("customer");
  const [days, setDays] = useState(30);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [payer, setPayer] = useState("");
  const [data, setData] = useState<{ kind: "customer" | "supplier"; days: number; items: WarrantyLookupResult[]; gaps: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  const valid = Number.isInteger(days) && days >= 1 && days <= 1200;
  const load = async () => {
    if (!valid) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setData(null);
    try {
      const options = scope ? { ...scope, signal: controller.signal } : undefined;
      const [items, gaps] = await Promise.all([retailWarrantyService.expiring(kind, days, options), retailWarrantyService.gapRisk(options)]);
      if (!controller.signal.aborted) setData({ kind, days, items, gaps: gaps.length });
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được báo cáo bảo hành."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  const matches = (item: WarrantyLookupResult) => (!status || item.status === status) && (!payer || item.costBearer === payer) && (!query.trim() || [item.serialNumber, item.internalBarcode, item.sku, item.productName, item.product?.name].some(value => value?.toLocaleLowerCase("vi-VN").includes(query.trim().toLocaleLowerCase("vi-VN"))));
  const items = data?.items.filter(matches) || [];
  return <details className="group rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-xs">
    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-primary sm:px-5"><CalendarClock className="size-5 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 text-sm font-semibold">Danh sách sắp hết hạn</span><ChevronDown className="size-4 shrink-0 text-on-surface-variant group-open:rotate-180" aria-hidden="true" /></summary>
    <div className="space-y-4 border-t border-outline-variant p-4 sm:p-5">
      <form onSubmit={event => { event.preventDefault(); void load(); }} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2"><p className="text-xs font-medium">Loại bảo hành</p><StyledSelect ariaLabel="Loại bảo hành báo cáo" value={kind} onChange={value => setKind(value as typeof kind)} options={[{ value: "customer", label: "Bảo hành khách hàng" }, { value: "supplier", label: "Bảo hành nhà cung cấp" }]} /></div>
        <label className="grid gap-2 text-xs font-medium">Số ngày sắp hết hạn<input className={field} type="number" min={1} max={1200} value={days || ""} onChange={event => setDays(Number(event.target.value))} required /></label>
        <button type="submit" disabled={busy || !valid} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Đang tải..." : "Tải báo cáo"}</button>
      </form>
      {error && <p role="alert" className="text-pretty text-sm text-error">{error} Bấm Tải báo cáo để thử lại.</p>}
      {data && <>
        <div className="grid gap-3 sm:grid-cols-3"><input className={field} aria-label="Lọc sản phẩm bảo hành" placeholder="Serial, SKU, sản phẩm..." value={query} onChange={event => setQuery(event.target.value)} /><StyledSelect ariaLabel="Trạng thái sản phẩm bảo hành" value={status} onChange={setStatus} options={[{ value: "", label: "Mọi trạng thái" }, ...Object.entries(statuses).map(([value, label]) => ({ value, label }))]} /><StyledSelect ariaLabel="Bên chịu phí bảo hành" value={payer} onChange={setPayer} options={[{ value: "", label: "Mọi bên chịu phí" }, ...Object.entries(payers).map(([value, label]) => ({ value, label }))]} /></div>
        <p role="status" className="text-pretty text-sm tabular-nums text-on-surface-variant">Bảo hành {data.kind === "customer" ? "khách hàng" : "nhà cung cấp"} trong {data.days} ngày: {items.length} sản phẩm phù hợp · {data.gaps} sản phẩm có khe hở bảo hành.</p>
        {items.length ? <div className="overflow-x-auto rounded-xl border border-outline-variant"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Sản phẩm sắp hết hạn bảo hành</caption><thead className="bg-surface text-xs text-on-surface-variant"><tr>{["Sản phẩm / SKU", "Serial", "Mã nội bộ", "Trạng thái", "Hết hạn", "Bên chịu phí"].map(label => <th key={label} scope="col" className="p-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-outline-variant">{items.map((item, index) => <tr key={item._id || item.serialNumber || index}><td className="p-3"><p className="font-medium">{item.productName || item.product?.name || "—"}</p><p className="mt-1 text-xs text-on-surface-variant">{item.sku || item.product?.sku || "—"}</p></td><td className="p-3 font-mono text-xs">{item.serialNumber || "—"}</td><td className="p-3 font-mono text-xs">{item.internalBarcode || "—"}</td><td className="p-3">{statuses[item.status || ""] || item.status || "—"}</td><td className="p-3 tabular-nums">{date(data.kind === "supplier" ? item.supplierWarranty?.endAt : item.customerWarranty?.endAt)}</td><td className="p-3">{payers[item.costBearer || ""] || "—"}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed border-outline-variant p-5 text-pretty text-sm text-on-surface-variant">Không có sản phẩm phù hợp với bộ lọc.</p>}
      </>}
    </div>
  </details>;
}
