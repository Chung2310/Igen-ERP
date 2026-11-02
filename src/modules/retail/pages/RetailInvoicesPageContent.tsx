import React from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  DollarSign,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  ScanLine,
  Wallet,
  X,
} from "lucide-react";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailSettingsApi } from "../api/retailSettings.api";
import BarcodeScannerDialog from "../components/pos/BarcodeScannerDialog";
import ReceiptPrintView from "../components/pos/ReceiptPrintViewSerial";
import { useRetailScope } from "../hooks/useRetailScope";
import type { RetailInvoice, RetailPaymentQr, RetailSettings } from "../types";
import { invoicePaymentRows, invoicePaymentSummary } from "../components/pos/invoicePaymentDisplay";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";
import { socketService } from "../../../services/socketService";
import { cn } from "../../student-management/lib/utils";
import { TableFilterToolbar } from "../../../components/common/TableFilterToolbar";
import { Pagination } from "../../../components/common/Pagination";
import { emptyDatePeriodFilter, getDatePeriodRange, type DatePeriodFilterValue } from "../../../utils/datePeriodFilter";

const receiptStagingWidth = (paperSize: RetailSettings["invoicePaperSize"]) =>
  paperSize === "58mm" || paperSize === "80mm" ? paperSize : paperSize === "A5" ? "148mm" : "210mm";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export default function RetailInvoicesPageContent() {
  const { scope, userProfile } = useRetailScope();
  const canReprint = userProfile?.role === "admin" || userProfile?.role === "superadmin" || Boolean(userProfile?.permissions?.includes("*") || userProfile?.permissions?.includes("retail:manage"));
  const [q, setQ] = React.useState("");
  const [scanningInvoice, setScanningInvoice] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [items, setItems] = React.useState<RetailInvoice[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBulkExporting, setIsBulkExporting] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [dateFilter, setDateFilter] = React.useState<DatePeriodFilterValue>(emptyDatePeriodFilter);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<RetailInvoice | null>(null);
  const [selectedIsReprint, setSelectedIsReprint] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState("");
  const [reprintingId, setReprintingId] = React.useState("");
  const [paymentQr, setPaymentQr] = React.useState<{ qr: RetailPaymentQr; invoiceId: string } | null>(null);
  const [paymentPrintInvoice, setPaymentPrintInvoice] = React.useState<RetailInvoice | null>(null);
  const [invoicePaperSize, setInvoicePaperSize] = React.useState<RetailSettings["invoicePaperSize"]>("80mm");
  const printInvoice = paymentPrintInvoice || (canReprint ? selected : null);
  const printInvoiceIsReprint = paymentPrintInvoice
    ? Boolean(paymentPrintInvoice.initialPrintedAt)
    : selectedIsReprint;
  const paymentQrRef = React.useRef(paymentQr);
  React.useEffect(() => {
    paymentQrRef.current = paymentQr;
  }, [paymentQr]);
  const paymentPrintInFlight = React.useRef(new Set<string>());
  const paymentPrintFailed = React.useRef(new Set<string>());
  const paymentPrintErrorShown = React.useRef(new Set<string>());

  React.useEffect(() => {
    const isolateReceipt = () => {
      if (document.querySelector(".retail-print-staging #retail-receipt")) {
        document.body.classList.add("retail-print-isolated");
      }
    };
    const restorePage = () => document.body.classList.remove("retail-print-isolated");
    window.addEventListener("beforeprint", isolateReceipt);
    window.addEventListener("afterprint", restorePage);
    return () => {
      window.removeEventListener("beforeprint", isolateReceipt);
      window.removeEventListener("afterprint", restorePage);
      restorePage();
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    if (scope) {
      void retailSettingsApi.printConfig(scope)
        .then((config) => { if (active) setInvoicePaperSize(config.invoicePaperSize); })
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [scope]);

  const dateRange = getDatePeriodRange(dateFilter);
  const loadInvoices = React.useCallback(async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const data = await retailInvoicesApi.list(scope, { q, status: status || undefined, from: dateRange.from, to: dateRange.to, page, limit: 20 });
      setItems(data.items);
      setTotal(data.total);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tải được hóa đơn."));
    } finally {
      setLoading(false);
    }
  }, [scope, q, status, dateRange.from, dateRange.to, page]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void loadInvoices();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadInvoices]);

  const finishSePayPayment = React.useCallback(async (orderId: string, transactionKey?: string) => {
    const activeQr = paymentQrRef.current;
    if (!scope || !activeQr || activeQr.qr.orderId !== orderId || paymentPrintInFlight.current.has(orderId) || paymentPrintFailed.current.has(orderId)) return;

    paymentPrintInFlight.current.add(orderId);
    let printRequestStarted = false;
    try {
      const order = await retailOrdersApi.detail(scope, orderId);
      if (order.paymentStatus !== "paid" || paymentQrRef.current?.qr.orderId !== orderId) return;

      const payments = (order as typeof order & {
        payments?: Array<{ method: string; reference?: string; receivedBy?: string }>;
      }).payments || [];
      const sepayPayment = transactionKey
        ? payments.find((payment) => payment.method === "transfer" && payment.reference === transactionKey && payment.receivedBy === "sepay")
        : [...payments].reverse().find((payment) => payment.method === "transfer" && payment.reference && payment.receivedBy === "sepay");
      const verifiedTransactionKey = transactionKey || sepayPayment?.reference;
      if (!verifiedTransactionKey || !sepayPayment) return;

      printRequestStarted = true;
      const printResult = await retailInvoicesApi.registerSePayPaymentPrint(scope, activeQr.invoiceId, verifiedTransactionKey);

      setPaymentQr((current) => current?.qr.orderId === orderId ? null : current);
      setSelected(null);
      void loadInvoices();
      if (printResult.alreadyPrinted) {
        toast.info("Hóa đơn cho giao dịch này đã được in ở cửa sổ khác.");
        return;
      }

      paymentPrintFailed.current.delete(orderId);
      paymentPrintErrorShown.current.delete(orderId);
      setPaymentPrintInvoice(printResult.invoice);
      toast.success("Đã nhận thanh toán qua SePay. Đang in hóa đơn.");
    } catch (cause) {
      if (printRequestStarted) paymentPrintFailed.current.add(orderId);
      if (!paymentPrintErrorShown.current.has(orderId)) {
        paymentPrintErrorShown.current.add(orderId);
        toast.error(getApiErrorMessage(cause, "Đã nhận thanh toán nhưng không in được hóa đơn."));
      }
    } finally {
      paymentPrintInFlight.current.delete(orderId);
    }
  }, [scope, loadInvoices]);

  React.useEffect(() => {
    if (!scope || !paymentQr) return;
    const timer = window.setInterval(() => {
      void finishSePayPayment(paymentQr.qr.orderId);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [scope, paymentQr, finishSePayPayment]);

  React.useEffect(() => {
    if (!scope) return;
    return socketService.on("retail:payment_received", (event: { companyCode?: string; branchId?: string; orderId?: string; transactionKey?: string }) => {
      if (event.companyCode !== scope.companyCode || event.branchId !== scope.branchId || !event.orderId) return;
      void finishSePayPayment(event.orderId, event.transactionKey);
    });
  }, [scope, finishSePayPayment]);

  React.useEffect(() => {
    if (!paymentPrintInvoice) return;
    const clear = () => setPaymentPrintInvoice(null);
    const fallbackTimer = window.setTimeout(clear, 60_000);
    window.addEventListener("afterprint", clear);
    const printTimer = window.setTimeout(() => window.print(), 0);
    return () => {
      window.clearTimeout(printTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("afterprint", clear);
    };
  }, [paymentPrintInvoice]);

  if (!scope) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
        <Building2 className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-base font-medium">Vui lòng chọn chi nhánh để xem danh sách hóa đơn.</p>
      </div>
    );
  }

  const detail = async (id: string) => {
    try {
      const invoice = await retailInvoicesApi.detail(scope, id);
      setSelected(invoice);
      setSelectedIsReprint(false);
      return invoice;
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tải được hóa đơn."));
      return null;
    }
  };

  const reprint = async (id: string) => {
    if (!scope || !canReprint) return;
    setReprintingId(id);
    try {
      const invoice = await retailInvoicesApi.reprint(scope, id);
      setSelected(invoice);
      setSelectedIsReprint(true);
      window.setTimeout(() => window.print(), 0);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không in lại được hóa đơn."));
    } finally {
      setReprintingId("");
    }
  };

  const download = async (id: string) => {
    if (!canReprint) return;
    setDownloadingId(id);
    try {
      await retailInvoicesApi.downloadPdf(scope, id);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tải được PDF hóa đơn."));
    } finally {
      setDownloadingId("");
    }
  };

  const handleExportBulkPdf = async (specificIds?: string[], preferredPaperSize: "A4" | "80mm" = "A4") => {
    if (!scope) return;
    setIsBulkExporting(true);
    try {
      const idsToExport = specificIds && specificIds.length > 0 ? specificIds : Array.from(selectedIds);
      const payload = idsToExport.length > 0
        ? { ids: idsToExport, paperSize: preferredPaperSize }
        : {
            q: q || undefined,
            status: status || undefined,
            from: dateRange.from,
            to: dateRange.to,
            paperSize: preferredPaperSize,
          };
      toast.info("Đang tạo file PDF chuỗi bill hóa đơn...");
      await retailInvoicesApi.downloadBulkPdf(scope, payload);
      toast.success("Đã xuất chuỗi bill PDF thành công.");
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không thể xuất file PDF chuỗi bill."));
    } finally {
      setIsBulkExporting(false);
    }
  };

  const isAllPageSelected = items.length > 0 && items.every((i) => selectedIds.has(i._id));
  const isSomePageSelected = items.some((i) => selectedIds.has(i._id));

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        items.forEach((i) => next.delete(i._id));
      } else {
        items.forEach((i) => next.add(i._id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const showPaymentQr = async (invoice: RetailInvoice) => {
    try {
      paymentPrintFailed.current.delete(invoice.orderId);
      paymentPrintErrorShown.current.delete(invoice.orderId);
      const qr = await retailOrdersApi.paymentQr(scope, invoice.orderId);
      setPaymentQr({ qr, invoiceId: invoice._id });
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Không tạo được QR thanh toán."));
    }
  };

  // KPI computations
  const totalGrand = items.reduce((sum, item) => sum + Number(item.snapshot?.grandTotal || 0), 0);
  const totalDue = items.reduce((sum, item) => sum + Number(item.snapshot?.dueAmount || 0), 0);
  const totalPaid = items.reduce((sum, item) => {
    const paid = item.snapshot?.paidAmount ?? (Number(item.snapshot?.grandTotal || 0) - Number(item.snapshot?.dueAmount || 0));
    return sum + Number(paid || 0);
  }, 0);

  return (
    <section className="space-y-3.5">
      {/* Header card */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xs">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Hóa đơn nội bộ
            </h1>
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 border border-cyan-200/60">
              {total.toLocaleString("vi-VN")} chứng từ
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadInvoices()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-cyan-600 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </header>

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tổng hóa đơn</span>
            <FileText className="h-3.5 w-3.5 text-cyan-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-slate-900">{total}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Doanh số trang này</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-emerald-700">{money(totalGrand)}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Đã thu trang này</span>
            <Wallet className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-blue-700">{money(totalPaid)}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Công nợ trang này</span>
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-amber-600">{money(totalDue)}</p>
        </div>
      </div>

      {/* Filter and Search toolbar */}
      <TableFilterToolbar
        search={{
          value: q,
          onChange: (val) => {
            setQ(val);
            setPage(1);
          },
          placeholder: "Số hóa đơn, mã đơn, khách hàng...",
          ariaLabel: "Tìm hóa đơn",
        }}
        dateFilter={{
          label: "thời gian hóa đơn",
          value: dateFilter,
          onChange: (next) => {
            setDateFilter(next);
            setPage(1);
          },
        }}
        totalCount={total}
        countLabel="chứng từ"
        hasActiveFilters={Boolean(q || status || dateFilter.mode !== "all")}
        onResetFilters={() => {
          setQ("");
          setStatus("");
          setDateFilter(emptyDatePeriodFilter());
          setPage(1);
          clearSelection();
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBulkExporting || items.length === 0}
              onClick={() => void handleExportBulkPdf()}
              title="Xuất file PDF chứa chuỗi các hóa đơn / bill bán hàng"
              className="inline-flex min-h-8.5 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              {isBulkExporting ? (
                <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5" aria-hidden="true" />
              )}
              <span>{selectedIds.size > 0 ? `Xuất chuỗi bill (${selectedIds.size})` : "Xuất chuỗi bill PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => setScanningInvoice(true)}
              className="inline-flex min-h-8.5 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
            >
              <ScanLine className="size-3.5" aria-hidden="true" />
              Quét mã
            </button>
          </div>
        }
      >
        <div className="w-full sm:w-48 shrink-0">
          <select
            aria-label="Trạng thái hóa đơn"
            className="h-9.5 w-full rounded-xl border border-outline-variant bg-surface-container-low/60 px-3 py-1.5 text-xs sm:text-sm font-medium text-on-surface transition focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="issued">Đã phát hành</option>
            <option value="void">Đã vô hiệu</option>
          </select>
        </div>
      </TableFilterToolbar>

      {/* Bulk action banner */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-on-surface animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
              {selectedIds.size}
            </span>
            <span className="font-semibold text-primary">
              Đã chọn {selectedIds.size} hóa đơn
            </span>
            <span className="text-on-surface-variant hidden sm:inline">• Gom thành 1 file PDF chuỗi các bill</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-lg px-2.5 py-1 font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              disabled={isBulkExporting}
              onClick={() => void handleExportBulkPdf(undefined, "80mm")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-surface-container-lowest px-3 py-1.5 font-semibold text-primary shadow-2xs hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
              title="Xuất dạng cuộn in nhiệt 80mm"
            >
              Cuộn bill 80mm
            </button>
            <button
              type="button"
              disabled={isBulkExporting}
              onClick={() => void handleExportBulkPdf(undefined, "A4")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 font-semibold text-on-primary shadow-2xs hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              title="Xuất chuỗi bill khổ A4"
            >
              {isBulkExporting ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5" aria-hidden="true" />
              )}
              Xuất PDF chuỗi bill ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800">Không tìm thấy hóa đơn</h3>
          <p className="mt-1 text-xs text-slate-500">
            Không có hóa đơn nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.
          </p>
          {(q || status || dateFilter.mode !== "all") && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatus("");
                setDateFilter(emptyDatePeriodFilter());
                setPage(1);
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
                  <th className="w-10 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả hóa đơn trên trang này"
                      checked={isAllPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomePageSelected && !isAllPageSelected;
                      }}
                      onChange={toggleSelectAllPage}
                      className="size-4 rounded border-outline-variant text-primary focus:ring-primary/30 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Số hóa đơn</th>
                  <th className="px-4 py-3">Mã đơn & Khách hàng</th>
                  <th className="px-4 py-3">Thanh toán & Công nợ</th>
                  <th className="px-4 py-3 text-right">Tổng tiền</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((invoice) => {
                  const summary = invoicePaymentSummary(invoice.snapshot);
                  const isVoid = invoice.status === "void";
                  const hasDue = Number(invoice.snapshot?.dueAmount || 0) > 0;
                  const isSelected = selectedIds.has(invoice._id);

                  return (
                    <tr
                      key={invoice._id}
                      onClick={() => void detail(invoice._id)}
                      className={cn(
                        "hover:bg-cyan-50/40 transition-colors group cursor-pointer",
                        isSelected && "bg-cyan-50/70",
                      )}
                    >
                      <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Chọn hóa đơn ${invoice.invoiceNo}`}
                          checked={isSelected}
                          onChange={(e) => toggleSelectOne(invoice._id, e)}
                          className="size-4 rounded border-outline-variant text-primary focus:ring-primary/30 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span title={invoice.invoiceNo} className="block max-w-56 truncate font-mono font-bold text-slate-900 group-hover:text-cyan-700 transition">
                          {invoice.invoiceNo}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                          {new Date(invoice.issuedAt).toLocaleDateString("vi-VN")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div title={invoice.snapshot.customerName || "Khách lẻ"} className="max-w-56 truncate font-semibold text-slate-800">
                          {invoice.snapshot.customerName || "Khách lẻ"}
                        </div>
                        <div title={invoice.orderCode} className="max-w-56 truncate text-[11px] text-slate-400 font-mono">
                          {invoice.orderCode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-cyan-700">
                          {summary.label}
                          {summary.paidAmount !== undefined && ` · Đã thanh toán ${money(summary.paidAmount)}`}
                          {summary.dueAmount !== undefined && ` · Còn nợ ${money(summary.dueAmount)}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {money(invoice.snapshot.grandTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isVoid
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isVoid ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          {isVoid ? "Đã vô hiệu" : "Đã phát hành"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Xem hóa đơn ${invoice.invoiceNo}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 shadow-2xs cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void detail(invoice._id);
                            }}
                            title="Xem chi tiết hóa đơn"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {canReprint && !isVoid && <>
                            <button
                              type="button"
                              aria-label={`In lại hóa đơn ${invoice.invoiceNo}`}
                              disabled={reprintingId === invoice._id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 disabled:opacity-50 shadow-2xs cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                void reprint(invoice._id);
                              }}
                              title="In lại hóa đơn"
                            >
                              {reprintingId === invoice._id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" /> : <Printer className="h-3.5 w-3.5" />}
                            </button>

                            <button
                              type="button"
                              aria-label={`Tải PDF hóa đơn ${invoice.invoiceNo}`}
                              disabled={downloadingId === invoice._id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 disabled:opacity-50 shadow-2xs cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                void download(invoice._id);
                              }}
                              title="Tải bản in lại PDF"
                            >
                              {downloadingId === invoice._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-600" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>}

                          {!isVoid && hasDue && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void showPaymentQr(invoice);
                              }}
                              className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 text-[11px] font-semibold text-cyan-700 transition hover:bg-cyan-100 active:scale-95 cursor-pointer"
                              title="Tạo mã QR thu nợ SePay"
                            >
                              <QrCode className="h-3 w-3" />
                              <span className="hidden sm:inline">QR nợ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / 20))}
        onPageChange={setPage}
      />

      {/* Invoice Detail Dialog */}
      {selected && (
        <InvoiceDialog
          invoice={selected}
          downloading={downloadingId === selected._id}
          canReprint={canReprint && selected.status === "issued"}
          isReprint={selectedIsReprint}
          paperSize={invoicePaperSize}
          onDownload={() => void download(selected._id)}
          onReprint={() => void reprint(selected._id)}
          onClose={() => setSelected(null)}
          onShowQr={() => void showPaymentQr(selected)}
        />
      )}

      {/* Floating QR button when viewing an invoice with debt */}
      {selected && selected.status === "issued" && Number(selected.snapshot.dueAmount || 0) > 0 && (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-3 font-bold text-white shadow-xl shadow-cyan-600/30 transition hover:bg-cyan-700 hover:shadow-cyan-600/40 active:scale-95"
          onClick={() => void showPaymentQr(selected)}
        >
          <QrCode className="h-5 w-5" />
          QR thanh toán
        </button>
      )}

      {/* Payment QR Dialog */}
      {paymentQr && <PaymentQrDialog qr={paymentQr.qr} onClose={() => setPaymentQr(null)} />}
      {printInvoice && createPortal(
        <div className="retail-print-staging" style={{ position: "fixed", left: "-10000px", top: 0, width: receiptStagingWidth(invoicePaperSize), visibility: "hidden" }}>
          <ReceiptPrintView invoice={printInvoice} isReprint={printInvoiceIsReprint} paperSize={invoicePaperSize} printTarget />
        </div>,
        document.body,
      )}
      {scanningInvoice && (
        <BarcodeScannerDialog
          title="Quét mã hóa đơn"
          onScan={(value) => { setQ(value); setStatus(""); setDateFilter(emptyDatePeriodFilter()); setPage(1); }}
          onClose={() => setScanningInvoice(false)}
        />
      )}
    </section>
  );
}

function PaymentQrDialog({ qr, onClose }: { qr: RetailPaymentQr; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-3 sm:p-4">
      <div
        role="dialog"
        aria-label="QR thanh toán hóa đơn"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-center shadow-xl [overflow-wrap:anywhere]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 p-4 text-left">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">QR thanh toán</h2>
          </div>
          <button
            type="button"
            aria-label="Đóng QR thanh toán"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div role="region" aria-label="Chi tiết chuyển khoản" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-primary">
        <p className="text-left text-sm font-medium text-slate-500">{qr.orderCode}</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
          <img
            className="mx-auto aspect-square w-full max-w-[260px] rounded-xl object-contain bg-white p-2"
            src={qr.qrUrl}
            alt={`QR thanh toán ${qr.orderCode}`}
          />
        </div>

        <p className="mt-4 text-2xl font-black tracking-tight text-cyan-700">
          {money(qr.amount)}
        </p>

        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-left text-sm border border-slate-100">
          <p className="text-xs text-slate-400 uppercase font-semibold">Nội dung chuyển khoản:</p>
          <p className="mt-0.5 font-mono text-base font-bold text-slate-900">
            {qr.transferContent || qr.orderCode}
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-500 font-medium">
          {qr.accountName} · <span className="font-mono">{qr.accountNumber}</span>
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-cyan-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
          </span>
          <span>Tự động cập nhật khi khách hàng chuyển khoản thành công</span>
        </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDialog({
  invoice,
  downloading,
  canReprint,
  onDownload,
  onReprint,
  onClose,
}: {
  invoice: RetailInvoice;
  downloading: boolean;
  canReprint: boolean;
  isReprint: boolean;
  paperSize: RetailSettings["invoicePaperSize"];
  onDownload: () => void;
  onReprint: () => void;
  onClose: () => void;
  onShowQr: () => void;
}) {
  const isVoid = invoice.status === "void";
  const titleId = React.useId();
  const actionClass = "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary hover:bg-surface disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-xl [--color-on-surface-variant:var(--color-slate-600)]">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h2 id={titleId} className="text-balance text-lg font-semibold">Hóa đơn</h2>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", isVoid ? "border-outline-variant bg-surface text-on-surface-variant" : "border-primary/20 bg-primary/5 text-primary")}>{isVoid ? "Đã vô hiệu" : "Đã phát hành"}</span>
          </div>
          {canReprint && <div className="order-last flex w-full shrink-0 justify-end gap-2 sm:order-none sm:w-auto">
            <button type="button" aria-label="Tải bản in lại PDF" disabled={downloading} className={actionClass} onClick={onDownload}>
              {downloading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}PDF
            </button>
            <button type="button" aria-label="In lại hóa đơn" className={cn(actionClass, "border-primary bg-primary text-on-primary hover:bg-primary/90")} onClick={onReprint}><Printer className="size-4" aria-hidden="true" />In lại</button>
          </div>}
          <button type="button" aria-label="Đóng hóa đơn" onClick={onClose} className={cn(actionClass, "size-11 p-0")}><X className="size-5" aria-hidden="true" /></button>
        </header>

        <div role="region" aria-label="Nội dung hóa đơn" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 sm:p-6">
          <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-on-surface-variant">Mã hóa đơn</dt><dd className="mt-1 font-semibold [overflow-wrap:anywhere]">{invoice.invoiceNo}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-on-surface-variant">Đơn hàng</dt><dd className="mt-1 [overflow-wrap:anywhere]">{invoice.orderCode}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-on-surface-variant">Khách hàng</dt><dd className="mt-1 [overflow-wrap:anywhere]">{invoice.snapshot.customerName}</dd></div>
            <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-on-surface-variant">Nhân viên bán hàng</dt><dd className="mt-1 [overflow-wrap:anywhere]">{invoice.snapshot.salespersonName || invoice.snapshot.cashierName}</dd></div>
          </dl>

          {invoice.snapshot.store && <div className="mt-4 min-w-0 rounded-xl border border-outline-variant bg-surface p-3.5 text-xs text-on-surface-variant [overflow-wrap:anywhere]">
            <p className="font-semibold text-on-surface">{invoice.snapshot.store.storeName || invoice.snapshot.store.legalName}</p>
            <p className="mt-1">{[invoice.snapshot.store.branchName, invoice.snapshot.store.branchAddress].filter(Boolean).join(" · ")}</p>
          </div>}

          <section className="mt-5" aria-labelledby={titleId + "_items"}>
            <h3 id={titleId + "_items"} className="mb-2 text-balance text-xs font-semibold text-on-surface-variant">Chi tiết sản phẩm</h3>
            <div className="divide-y divide-outline-variant rounded-xl border border-outline-variant px-3 sm:px-4">
              {invoice.snapshot.items.length === 0 ? <p className="py-3 text-sm text-on-surface-variant">Không có dòng sản phẩm.</p> : invoice.snapshot.items.map((item, idx) => {
                const serials = item.serialNumbers || [];
                const serialText = serials.join(", ");
                return <div key={item.productId + "-" + item.sku + "-" + idx} className="grid min-w-0 gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4">
                  <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{item.productName} × {item.quantity}</p>
                  <p className="min-w-0 text-right font-semibold tabular-nums [overflow-wrap:anywhere] sm:max-w-64">{money(item.lineTotal)}</p>
                  {serials.length > 0 && (serials.length > 3 || serialText.length > 160 ? <details className="min-w-0 text-xs text-on-surface-variant sm:col-span-2"><summary className="min-h-9 cursor-pointer rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-primary">S/N: {serials.length} mã</summary><p className="leading-5 [overflow-wrap:anywhere]">S/N: {serialText}</p></details> : <p className="min-w-0 text-xs leading-5 text-on-surface-variant [overflow-wrap:anywhere] sm:col-span-2">S/N: {serialText}</p>)}
                </div>;
              })}
            </div>
          </section>

          <div className="mt-5 space-y-2 rounded-xl border border-outline-variant bg-surface p-4 text-sm">
            <Row label="Tạm tính" value={invoice.snapshot.subtotal} />
            <Row label="Giảm giá" value={invoice.snapshot.orderDiscount} />
            <Row label={"Thuế (" + invoice.snapshot.taxRate + "%)"} value={invoice.snapshot.taxAmount} />
            <div className="border-t border-outline-variant pt-2"><Row label="Tổng cộng" value={invoice.snapshot.grandTotal} strong /></div>
          </div>

          <section className="mt-4 space-y-2 border-t border-outline-variant pt-3 text-sm" aria-labelledby={titleId + "_payments"}>
            <h3 id={titleId + "_payments"} className="text-balance text-xs font-semibold text-on-surface-variant">Thanh toán</h3>
            {invoicePaymentRows(invoice.snapshot).map((row, idx) => <Row key={row.label + "-" + idx} label={row.label} value={row.amount} />)}
          </section>

          <p className="mt-4 whitespace-pre-wrap rounded-xl border border-outline-variant bg-surface p-3 text-pretty text-sm text-on-surface-variant [overflow-wrap:anywhere]">Bằng chữ: <span className="font-semibold text-on-surface">{invoice.snapshot.amountInWords}</span></p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={cn("grid grid-cols-2 items-start gap-x-4", strong ? "text-base font-semibold text-on-surface" : "text-on-surface-variant")}>
    <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    <span className="min-w-0 text-right tabular-nums [overflow-wrap:anywhere]">{money(value)}</span>
  </div>;
}
