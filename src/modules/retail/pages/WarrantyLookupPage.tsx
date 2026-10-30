import React, { type FormEvent, useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  RotateCw,
  Copy,
  Check,
  QrCode,
  ShoppingBag,
  History,
  Store,
  Building2,
  X,
} from "lucide-react";
import {
  retailWarrantyService,
  type WarrantyLookupResult,
  type WarrantyLookupScope,
} from "../../../services/retailWarrantyService";
import { toast } from "../../../pages/Toast";
import type { RepairCreatePrefill } from "../../repair/RepairBoardPage";

const date = (value?: string) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`Đã sao chép ${label || "mã"}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      aria-label={`Sao chép ${label || "mã"}`}
      onClick={handleCopy}
      className="inline-flex items-center text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
      title={`Sao chép ${label || ""}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

type Props = { scope?: WarrantyLookupScope; canCreate?: boolean; onCreateRepair?: (prefill: RepairCreatePrefill) => void };

export default function WarrantyLookupPage({ scope, canCreate = true, onCreateRepair }: Props = {}) {
  const [code, setCodeValue] = useState("");
  const [searchedCode, setSearchedCode] = useState("");
  const [result, setResult] = useState<WarrantyLookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const recentKey = "igen.warranty-lookups:" + (scope?.companyCode || "local") + ":" + (scope?.branchId || "local");
  useEffect(() => () => request.current?.abort(), []);
  const setCode = (value: string) => {
    request.current?.abort();
    request.current = null;
    setCodeValue(value);
    setResult(null);
    setSearchedCode("");
    setBusy(false);
  };
  const [recentLookups, setRecentLookups] = useState<string[]>(() => {
    try {
      const items: unknown = JSON.parse(sessionStorage.getItem(recentKey) || "[]");
      return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
    } catch {
      return [];
    }
  });

  const saveRecentLookup = useCallback((c: string) => {
    setRecentLookups((prev) => {
      const next = [c, ...prev.filter((item) => item !== c)].slice(0, 5);
      try {
        sessionStorage.setItem(recentKey, JSON.stringify(next));
      } catch { /* Tra cứu vẫn hoạt động khi trình duyệt không cho lưu lịch sử. */ }
      return next;
    });
  }, [recentKey]);

  const doLookup = useCallback(async (lookupCode: string) => {
    const trimmed = lookupCode.trim();
    if (!trimmed) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setResult(null);
    setSearchedCode(trimmed);
    try {
      const res = scope ? await retailWarrantyService.lookup(trimmed, { ...scope, signal: controller.signal }) : await retailWarrantyService.lookup(trimmed);
      if (controller.signal.aborted || request.current !== controller) return;
      setResult(res);
      saveRecentLookup(trimmed);
    } catch (e) {
      if (!controller.signal.aborted && request.current === controller) toast.error(e instanceof Error ? e.message : "Không thể tra cứu bảo hành");
    } finally {
      if (!controller.signal.aborted && request.current === controller) setBusy(false);
    }
  }, [scope, saveRecentLookup]);

  // Debounce 1s (1000ms): Tự động gửi API tra cứu sau 1s kể từ khi người dùng ngừng nhập
  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Không tự động gọi lại nếu đã tra cứu mã này
    if (trimmed === searchedCode) return;

    const timer = setTimeout(() => {
      void doLookup(trimmed);
    }, 1000);

    return () => clearTimeout(timer);
  }, [code, searchedCode, doLookup]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void doLookup(code);
  };

  const isSold = result?.status === "sold" && Boolean(result.serialNumber);
  const isCustomerCovered = Boolean(result?.customerWarranty?.covered);
  const isSupplierCovered = Boolean(result?.supplierWarranty?.covered);
  const isWarrantyCovered = isCustomerCovered || isSupplierCovered;
  const remainingWarrantyDays = Math.max(isCustomerCovered ? result?.customerWarranty?.daysLeft || 0 : 0, isSupplierCovered ? result?.supplierWarranty?.daysLeft || 0 : 0);

  const openWarrantyTicket = () => {
    if (!result || !isSold || !isWarrantyCovered || !canCreate) return;
    const detail: RepairCreatePrefill = {
          ticketType: "warranty",
          intakeSource: "company_sale",
          productId: result.product?.productId,
          serialNumber: result.serialNumber,
          productName: result.product?.name || "Sản phẩm",
          customerId: result.sold?.customerId,
          customerName: result.sold?.customerName,
          customerPhone: result.sold?.customerPhone,
          coverage: {
            customer: result.customerWarranty || { covered: false },
            supplier: result.supplierWarranty || { covered: false },
            costBearer: result.costBearer || "shop",
            checkedAt: new Date().toISOString(),
          },
    };
    if (onCreateRepair) onCreateRepair(detail);
    else window.dispatchEvent(new CustomEvent("inventory:open-repair", { detail }));
  };

  const openServiceTicket = (isOutsideShop = false) => {
    if (!canCreate || (!isOutsideShop && !isSold)) return;
    const detail: RepairCreatePrefill = {
          ticketType: "service",
          intakeSource: isOutsideShop ? "external" : "company_sale",
          productId: isOutsideShop ? undefined : result?.product?.productId,
          serialNumber: isOutsideShop ? searchedCode : result?.serialNumber,
          productName: isOutsideShop
            ? "Thiết bị khách mang ngoài vào"
            : result?.product?.name || "Sản phẩm",
          customerId: isOutsideShop ? undefined : result?.sold?.customerId,
          customerName: isOutsideShop ? undefined : result?.sold?.customerName,
          customerPhone: isOutsideShop ? undefined : result?.sold?.customerPhone,
          coverage: {
            customer: { covered: false },
            supplier: { covered: false },
            costBearer: "customer",
            checkedAt: new Date().toISOString(),
          },
    };
    if (onCreateRepair) onCreateRepair(detail);
    else window.dispatchEvent(new CustomEvent("inventory:open-repair", { detail }));
  };

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-black tracking-tight text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span>Tra cứu bảo hành thiết bị</span>
          </h1>
        </div>

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
            <span>Tra cứu máy khác</span>
          </button>
        )}
      </div>

      {/* Main Search Hero Box */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-3xl">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-cyan-600">
              <QrCode className="h-4 w-4" />
            </div>
            <input
              autoFocus
              aria-label="IMEI, Serial hoặc mã vạch"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Nhập IMEI (15 số), Serial máy hoặc quét mã vạch..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition shadow-2xs"
            />
            {code && (
              <button
                type="button"
                onClick={() => setCode("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
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
            disabled={busy || !code.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 font-bold text-white shadow-sm shadow-cyan-600/20 hover:from-cyan-700 hover:to-teal-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer text-sm shrink-0"
          >
            {busy ? (
              <RotateCw className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>{busy ? "Đang tra cứu..." : "Kiểm tra bảo hành"}</span>
          </button>
        </form>

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
                  className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 font-mono text-[11px] text-slate-700 transition cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* IDLE STATE: When no search has been performed yet */}
      {!result && !busy && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100/70 text-cyan-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Sẵn sàng kiểm tra thông tin bảo hành
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nhập IMEI/Serial hoặc quét tem máy để tra cứu nguồn gốc và thời hạn bảo hành.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto pt-1 text-left text-xs">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Store className="h-4 w-4 text-cyan-600" />
                <span>1. Xác thực nguồn gốc từ shop</span>
              </div>
              <p className="text-slate-500">
                Xác định máy bán tại shop hay máy ngoài; thông tin đơn hàng và ngày xuất bán.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>2. Kiểm tra hiệu lực bảo hành</span>
              </div>
              <p className="text-slate-500">
                Tính toán thời hạn bảo hành còn lại tại Shop và bảo hành từ Hãng/NCC.
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
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-amber-200/80 px-3 py-0.5 text-xs font-bold text-amber-900">
                  Thiết bị ngoài shop
                </span>
                <span className="text-xs text-amber-700 font-mono">
                  IMEI: <b>{searchedCode}</b>
                </span>
              </div>
              <h3 className="text-lg font-bold text-amber-950">
                Không tìm thấy máy trong lịch sử xuất bán của shop
              </h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                Mã IMEI/Serial này không thuộc đơn hàng nào từng bán ra tại cửa hàng (thiết bị do khách mua ở nơi khác, hoặc thông tin nhập chưa đúng).
              </p>
            </div>
          </div>

          {canCreate && <div className="border-t border-amber-200/60 pt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-amber-800 font-medium">
              Bạn vẫn có thể tiếp nhận máy để sửa chữa dịch vụ bình thường cho khách hàng:
            </p>

            <button
              type="button"
              onClick={() => openServiceTicket(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 active:scale-[0.99] transition cursor-pointer"
            >
              <Wrench className="h-4 w-4" />
              <span>Tiếp nhận sửa chữa dịch vụ (khách ngoài)</span>
            </button>
          </div>}
        </div>
      )}

      {/* CASE 2: PRODUCT FOUND (MÁY CHÍNH HÃNG DO SHOP BÁN RA) */}
      {result && result.found && (
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden space-y-0">
          {/* Top Verification Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-6 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-2xs">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-100">
                Xác nhận: thiết bị xuất bán tại shop
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
                    <span>Đã hết hạn bảo hành</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Device Identity Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 border border-cyan-100 shadow-2xs">
                  <Smartphone className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    {result.product?.name || "Thiết bị bảo hành"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>
                      SKU: <b className="font-mono text-slate-700">{result.product?.sku || "—"}</b>
                    </span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <span>IMEI / Serial:</span>
                      <b className="font-mono text-slate-800">{result.serialNumber || "—"}</b>
                      {result.serialNumber && (
                        <CopyButton text={result.serialNumber} label="IMEI" />
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
                  <ShoppingBag className="h-4 w-4 text-cyan-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Nguồn gốc & Lịch sử bán hàng
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Đơn hàng xuất bán</span>
                    <span className="font-mono font-bold text-cyan-700 text-sm">
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
                    <div className="col-span-2 border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Tem mã vạch nội bộ</span>
                      <span className="font-mono font-bold text-slate-700">
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
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
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
                      : "Đã hết hạn"}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Shop Warranty Spec */}
                  <div className="rounded-xl bg-white/90 p-3 border border-slate-200/70 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-cyan-600" />
                        <span>Bảo hành cửa hàng (Shop)</span>
                      </span>
                      <span
                        className={`font-bold ${isCustomerCovered ? "text-emerald-700" : "text-slate-400"
                          }`}
                      >
                        {isCustomerCovered
                          ? `Còn ${result.customerWarranty?.daysLeft ?? 0} ngày`
                          : "Hết hạn"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
                      <span>Kích hoạt: {date(result.customerWarranty?.startAt)}</span>
                      <span>Hết hạn: <b className="text-slate-700">{date(result.customerWarranty?.endAt)}</b></span>
                    </div>
                  </div>

                  {/* Supplier Warranty Spec */}
                  {result.supplierWarranty && (
                    <div className="rounded-xl bg-white/90 p-3 border border-slate-200/70 space-y-1">
                      <div className="flex items-center justify-between">
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
                            : "Hết hạn"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1">
                        <span>Kích hoạt: {date(result.supplierWarranty.startAt)}</span>
                        <span>Hết hạn: <b className="text-slate-700">{date(result.supplierWarranty.endAt)}</b></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            {canCreate && isSold && <div className="border-t border-slate-100 pt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {isWarrantyCovered ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Thiết bị đủ điều kiện tiếp nhận bảo hành miễn phí theo chính sách cửa hàng.</span>
                  </span>
                ) : (
                  <span className="text-slate-600 font-medium">
                    Thiết bị đã hết thời hạn bảo hành. Khách hàng mua máy tại shop được áp dụng ưu đãi khi sửa chữa dịch vụ.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {isWarrantyCovered && (
                  <button
                    type="button"
                    onClick={openWarrantyTicket}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-cyan-600/20 hover:from-cyan-700 hover:to-teal-700 active:scale-[0.99] transition cursor-pointer"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    <span>Tiếp nhận bảo hành miễn phí (Còn hạn)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openServiceTicket(false)}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition cursor-pointer ${isWarrantyCovered
                      ? "border border-orange-200 bg-orange-50 text-orange-900 hover:bg-orange-100"
                      : "bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-600/20 active:scale-[0.99]"
                    }`}
                >
                  <Wrench className="h-5 w-5" />
                  <span>
                    {isWarrantyCovered
                      ? "Tiếp nhận sửa chữa dịch vụ (kèm ưu đãi)"
                      : "Tiếp nhận sửa chữa dịch vụ (ưu đãi 10% khách mua máy)"}
                  </span>
                </button>
              </div>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
