import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Search, ShieldCheck, ShieldAlert, Package as Smartphone, CheckCircle2, AlertCircle, AlertTriangle, Wrench, RotateCw, Copy, Check, QrCode, History, ShoppingBag, Store, Building2, X } from "lucide-react";
import { retailWarrantyService, type WarrantyLookupResult, type WarrantyLookupScope } from "../../../services/retailWarrantyService";
import type { RepairCreatePrefill } from "../../repair/RepairBoardPage";
import WarrantyExpiryPanel from "./WarrantyExpiryPanel";

const date = (value?: string) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
interface Props { onCreateRepair?: (prefill: RepairCreatePrefill) => void; canManage?: boolean; scope?: WarrantyLookupScope; actions?: ReactNode }

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <span className="inline-flex items-center gap-1"><button type="button" aria-label={"Sao chép " + (label || "mã")} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setError(false); } catch { setError(true); }
  }} className="inline-flex size-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
    {copied ? <Check className="size-4 text-primary" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
  </button>{copied && !error && <span role="status" className="sr-only">Đã sao chép {label || "mã"}</span>}{error && <span role="status" className="text-xs text-error">Chọn mã để sao chép thủ công.</span>}</span>;
}

/** Retail's warranty lookup layout, adapted to general products and ERP intake. */
export default function WarrantyLookupPage({ onCreateRepair, canManage = true, scope, actions }: Props) {
  const [code, setCodeValue] = useState("");
  const [searchedCode, setSearchedCode] = useState("");
  const [result, setResult] = useState<WarrantyLookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const recentKey = "igen.warranty-lookups:" + (scope?.companyCode || "local") + ":" + (scope?.branchId || "local");
  const [recentLookups, setRecentLookups] = useState<string[]>(() => {
    try { const items: unknown = JSON.parse(sessionStorage.getItem(recentKey) || "[]"); return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string" && item.length <= 200).slice(0, 5) : []; }
    catch { return []; }
  });
  useEffect(() => () => { request.current?.abort(); }, []);
  const setCode = (value: string) => { request.current?.abort(); request.current = null; setCodeValue(value); setResult(null); setError(""); setBusy(false); };
  const doLookup = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(""); setResult(null); setSearchedCode(trimmed);
    try {
      const data = scope ? await retailWarrantyService.lookup(trimmed, { ...scope, signal: controller.signal }) : await retailWarrantyService.lookup(trimmed);
      if (controller.signal.aborted || request.current !== controller) return;
      setResult(data);
      setRecentLookups(previous => {
        const next = [trimmed, ...previous.filter(item => item !== trimmed)].slice(0, 5);
        try { sessionStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Search remains usable without browser storage. */ }
        return next;
      });
    } catch (cause) { if (!controller.signal.aborted && request.current === controller) setError(cause instanceof Error ? cause.message : "Không thể tra cứu bảo hành."); }
    finally { if (!controller.signal.aborted && request.current === controller) setBusy(false); }
  };
  const handleSubmit = (event: FormEvent) => { event.preventDefault(); void doLookup(code); };
  const isSold = result?.status === "sold" && Boolean(result.serialNumber);
  const isCustomerCovered = Boolean(result?.customerWarranty?.covered);
  const isSupplierCovered = Boolean(result?.supplierWarranty?.covered);
  const isWarrantyCovered = isCustomerCovered || isSupplierCovered;
  const hasWarrantyDates = Boolean(result?.customerWarranty?.endAt || result?.supplierWarranty?.endAt);
  const remainingWarrantyDays = Math.max(isCustomerCovered ? result?.customerWarranty?.daysLeft || 0 : 0, isSupplierCovered ? result?.supplierWarranty?.daysLeft || 0 : 0);
  const openWarrantyTicket = () => {
    if (!result || !isSold || !isWarrantyCovered) return;
    onCreateRepair?.({ ticketType: "warranty", intakeSource: "company_sale", productId: result.product?.productId, productName: result.product?.name || "Sản phẩm", serialNumber: result.serialNumber,
      customerId: result.sold?.customerId, customerName: result.sold?.customerName, customerPhone: result.sold?.customerPhone,
      coverage: { customer: result.customerWarranty || { covered: false }, supplier: result.supplierWarranty || { covered: false }, costBearer: result.costBearer || "shop", checkedAt: new Date().toISOString() } });
  };
  const openServiceTicket = (external = false) => {
    onCreateRepair?.({ ticketType: "service", intakeSource: external ? "external" : "company_sale", productId: external ? undefined : result?.product?.productId, productName: external ? "" : result?.product?.name || "Sản phẩm", serialNumber: external ? searchedCode : result?.serialNumber,
      customerId: external ? undefined : result?.sold?.customerId, customerName: external ? undefined : result?.sold?.customerName, customerPhone: external ? undefined : result?.sold?.customerPhone,
      coverage: { customer: { covered: false }, supplier: { covered: false }, costBearer: "customer", checkedAt: new Date().toISOString() } });
  };

  return (
    <div className="w-full min-w-0 space-y-5 text-on-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-semibold text-balance text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span>Tra cứu bảo hành sản phẩm</span>
          </h1>
        </div>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-3">
        {actions}
        {result && (
          <button
            type="button"
            onClick={() => {
              setCode("");
              setResult(null);
              setSearchedCode("");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Tra cứu sản phẩm khác</span>
          </button>
        )}
        </div>
      </div>

      {/* Main Search Hero Box */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-3xl">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-primary">
              <QrCode className="h-4 w-4" />
            </div>
            <input
              aria-label="Serial hoặc mã định danh sản phẩm"
              aria-describedby="warranty-code-help"
              maxLength={200}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Nhập Serial hoặc mã định danh sản phẩm..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition shadow-2xs"
            />
            {code && (
              <button
                type="button"
                onClick={() => setCode("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Xóa mã tra cứu"
                title="Xóa nhập liệu"
              >
                <span className="rounded-full bg-slate-200/70 p-1 hover:bg-slate-300 text-slate-600 flex items-center justify-center">
                  <X className="h-3 w-3" />
                </span>
              </button>
            )}
          </div>

          <button
            type="submit"
            aria-label="Tra cứu"
            disabled={busy || !code.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
          >
            {busy ? (
              <RotateCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{busy ? "Đang tra cứu..." : "Kiểm tra bảo hành"}</span>
          </button>
        </form>
        <p id="warranty-code-help" className="mt-3 text-pretty text-xs text-on-surface-variant">Không có mã định danh? Chọn Đơn hàng / khách hàng để tra cứu, hoặc tạo phiếu tại Phiếu sửa chữa & Bảo hành. Hệ thống vẫn hỗ trợ mã vạch và IMEI nếu có.</p>

        {/* Tip & Recent Lookups */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">

          {recentLookups.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 flex items-center gap-1">
                <History className="h-3 w-3" />
                <span>Gần đây:</span>
              </span>
              {recentLookups.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setCode(item);
                    void doLookup(item);
                  }}
                  className="min-h-9 max-w-full truncate rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700 transition cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-error bg-error-container p-4 text-on-error-container"><AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div className="min-w-0"><p className="text-pretty text-sm">{error}</p><button type="button" onClick={() => void doLookup(searchedCode)} className="mt-3 min-h-11 rounded-xl border border-current px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Thử lại</button></div></div>}
      {busy && <section role="status" className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6"><p className="text-sm text-on-surface-variant">Đang kiểm tra thông tin bảo hành…</p><div aria-hidden="true" className="h-6 w-2/3 rounded-lg bg-surface-container" /><div aria-hidden="true" className="h-28 rounded-xl bg-surface" /></section>}
      {/* IDLE STATE: When no search has been performed yet */}
      {!result && !busy && !error && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100/70 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-balance text-sm font-semibold text-slate-800 sm:text-base">
              Sẵn sàng kiểm tra thông tin bảo hành
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nhập Serial hoặc quét tem sản phẩm để tra cứu nguồn gốc và thời hạn bảo hành.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-1 text-left text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Store className="h-4 w-4 text-primary" />
                <span>1. Xác thực nguồn gốc từ doanh nghiệp</span>
              </div>
              <p className="text-slate-500">
                Xác định sản phẩm do doanh nghiệp bán hay khách mang từ bên ngoài; thông tin đơn hàng và ngày xuất bán.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>2. Kiểm tra hiệu lực bảo hành</span>
              </div>
              <p className="text-slate-500">
                Tính toán thời hạn bảo hành còn lại tại doanh nghiệp và bảo hành từ Hãng/NCC.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CASE 1: PRODUCT NOT FOUND (MÁY NGOÀI KHÔNG MUA TẠI SHOP) */}
      {result && !result.found && (
        <div className="rounded-2xl border border-amber-200/90 bg-amber-50/70 p-6 text-amber-900 shadow-xs space-y-5">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700 shrink-0">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-amber-200/80 px-3 py-0.5 text-xs font-bold text-amber-900">
                  Sản phẩm ngoài doanh nghiệp
                </span>
                <span className="break-all font-mono text-xs text-amber-700">
                  Mã tra cứu: <b>{searchedCode}</b>
                </span>
              </div>
              <h2 className="text-balance text-lg font-semibold text-amber-950">
                Không tìm thấy sản phẩm trong hệ thống
              </h2>
              <p className="text-sm text-amber-800 leading-relaxed">
                Mã định danh này không được ghi nhận tại chi nhánh đang chọn. Hãy kiểm tra lại mã hoặc tra theo đơn hàng và khách hàng.
              </p>
            </div>
          </div>

          <div className="border-t border-amber-200/60 pt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-amber-800 font-medium">
              Bạn vẫn có thể tiếp nhận sản phẩm để sửa chữa dịch vụ bình thường cho khách hàng:
            </p>

            {onCreateRepair && <button
              type="button"
              onClick={() => openServiceTicket(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary/90 active:scale-[0.99] transition cursor-pointer"
            >
              <Wrench className="h-4 w-4" />
              <span>Tiếp nhận sửa chữa dịch vụ (khách ngoài)</span>
            </button>}
          </div>
        </div>
      )}

      {/* CASE 2: PRODUCT FOUND (MÁY CHÍNH HÃNG DO SHOP BÁN RA) */}
      {result && result.found && (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden space-y-0">
          {/* Top Verification Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-inverse-surface px-4 py-3.5 text-inverse-on-surface sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-2xs">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <span className="text-sm font-semibold">
                {isSold ? "Xác nhận: sản phẩm đã bán tại doanh nghiệp" : "Đã tìm thấy sản phẩm trong hệ thống"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold ${isWarrantyCovered
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  }`}
              >
                {isWarrantyCovered ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Còn hạn bảo hành</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                    <span>{hasWarrantyDates ? "Đã hết hạn bảo hành" : "Chưa ghi nhận bảo hành"}</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-6">
            {/* Device Identity Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex min-w-0 items-start gap-3.5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-primary shadow-2xs">
                  <Smartphone className="h-8 w-8" />
                </div>
                <div className="min-w-0">
                  <h2 className="break-words text-balance text-xl font-semibold text-slate-900 tracking-tight">
                    {result.product?.name || "Sản phẩm bảo hành"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                    <span className="min-w-0 max-w-full break-all">
                      SKU: <b className="font-mono text-slate-700">{result.product?.sku || "—"}</b>
                    </span>
                    <span>•</span>
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
                      <span>Mã định danh:</span>
                      <b className="min-w-0 break-all font-mono text-slate-800">{result.serialNumber || "—"}</b>
                      {result.serialNumber && (
                        <CopyButton text={result.serialNumber} label="mã định danh" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2-Column Core Verification Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Box 1: Nguồn gốc mua hàng tại shop */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 space-y-3.5">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2.5">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Nguồn gốc & Lịch sử bán hàng
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 break-words text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Đơn hàng xuất bán</span>
                    <span className="font-mono font-bold text-primary text-sm">
                      {result.sold?.orderCode || "—"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Ngày xuất bán</span>
                    <span className="font-semibold text-slate-800 text-sm">
                      {date(result.sold?.at)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Tên khách mua</span>
                    <span className="font-bold text-slate-800">
                      {result.sold?.customerName || <span className="text-slate-400 italic">Khách lẻ quầy</span>}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Số điện thoại</span>
                    <span className="font-mono font-bold text-slate-700">
                      {result.sold?.customerPhone || "—"}
                    </span>
                  </div>

                  {result.internalBarcode && (
                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/50 pt-2">
                      <span className="text-slate-400 text-[11px]">Tem mã vạch nội bộ</span>
                      <span className="min-w-0 break-all font-mono font-bold text-slate-700">
                        {result.internalBarcode}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Tình trạng bảo hành */}
              <div
                className={`rounded-2xl border p-5 space-y-3.5 ${isWarrantyCovered
                    ? "bg-emerald-50/40 border-emerald-200"
                    : "bg-rose-50/40 border-rose-200"
                  }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`h-4 w-4 ${isWarrantyCovered ? "text-emerald-600" : "text-rose-600"}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      2. Tình trạng bảo hành
                    </h3>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isWarrantyCovered
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                      }`}
                  >
                    {isWarrantyCovered
                      ? `Còn ${remainingWarrantyDays} ngày`
                      : hasWarrantyDates ? "Đã hết hạn" : "Chưa ghi nhận"}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Shop Warranty Spec */}
                  <div className="rounded-xl bg-white/90 p-3 border border-slate-200/70 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-primary" />
                        <span>Bảo hành khách hàng</span>
                      </span>
                      <span
                        className={`font-bold ${isCustomerCovered ? "text-emerald-700" : "text-slate-400"
                          }`}
                      >
                        {isCustomerCovered
                          ? `Còn ${result.customerWarranty?.daysLeft ?? 0} ngày`
                          : result.customerWarranty?.endAt ? "Hết hạn" : "Chưa ghi nhận"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[11px] tabular-nums text-slate-500">
                      <span>Kích hoạt: {date(result.customerWarranty?.startAt)}</span>
                      <span>Hết hạn: <b className="text-slate-700">{date(result.customerWarranty?.endAt)}</b></span>
                    </div>
                  </div>

                  {/* Supplier Warranty Spec */}
                  {result.supplierWarranty && (
                    <div className="rounded-xl bg-white/90 p-3 border border-slate-200/70 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                          <span>
                            BH Hãng / NCC
                            {result.supplierWarranty.supplierName && ` (${result.supplierWarranty.supplierName})`}
                          </span>
                        </span>
                        <span
                          className={`font-bold ${isSupplierCovered ? "text-indigo-700" : "text-slate-400"
                            }`}
                        >
                          {isSupplierCovered
                            ? `Còn ${result.supplierWarranty.daysLeft ?? 0} ngày`
                            : result.supplierWarranty.endAt ? "Hết hạn" : "Chưa ghi nhận"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[11px] tabular-nums text-slate-500">
                        <span>Kích hoạt: {date(result.supplierWarranty.startAt)}</span>
                        <span>Hết hạn: <b className="text-slate-700">{date(result.supplierWarranty.endAt)}</b></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            {isSold && onCreateRepair && <div className="border-t border-slate-100 pt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {isWarrantyCovered ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Sản phẩm đang còn thời hạn bảo hành. Điều kiện và phạm vi áp dụng được xác nhận khi tiếp nhận.</span>
                  </span>
                ) : (
                  <span className="text-slate-600 font-medium">
                    Sản phẩm chưa có bảo hành còn hiệu lực. Bạn có thể tiếp nhận sửa chữa dịch vụ.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {isWarrantyCovered && (
                  <button
                    type="button"
                    aria-label="Tạo phiếu sửa chữa/bảo hành"
                    onClick={openWarrantyTicket}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm shadow-xs hover:bg-primary/90 active:scale-[0.99] transition cursor-pointer"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    <span>Tiếp nhận bảo hành</span>
                  </button>
                )}

                <button
                  type="button"
                  aria-label={isWarrantyCovered ? "Tạo phiếu sửa chữa dịch vụ" : "Tạo phiếu sửa chữa/bảo hành"}
                  onClick={() => openServiceTicket(false)}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition cursor-pointer ${isWarrantyCovered
                      ? "border border-primary/20 bg-primary/5 text-on-surface hover:bg-primary/10"
                      : "bg-primary text-white hover:bg-primary/90 shadow-sm shadow-xs active:scale-[0.99]"
                    }`}
                >
                  <Wrench className="h-5 w-5" />
                  <span>Tiếp nhận sửa chữa dịch vụ</span>
                </button>
              </div>
            </div>}
          </div>
        </div>
      )}
      {canManage && <WarrantyExpiryPanel scope={scope} />}
    </div>
  );
}
