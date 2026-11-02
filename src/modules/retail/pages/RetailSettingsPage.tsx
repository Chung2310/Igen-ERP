import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Coins,
  FileText,
  Hash,
  Package,
  Percent,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { retailSettingsApi } from "../api/retailSettings.api";
import type { RetailInvoice, RetailSettings } from "../types";
import ReceiptPrintView from "../components/pos/ReceiptPrintViewSerial";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import { toast } from "../../../pages/Toast";

const receiptStagingWidth = (paperSize: RetailSettings["invoicePaperSize"]) =>
  paperSize === "58mm" || paperSize === "80mm" ? paperSize : paperSize === "A5" ? "148mm" : "210mm";

export default function RetailSettingsPage() {
  const { userProfile } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [settings, setSettings] = useState<RetailSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<RetailSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testInvoice, setTestInvoice] = useState<RetailInvoice | null>(null);
  const [error, setError] = useState("");
  const companyCode = userProfile?.companyCode || "";

  React.useEffect(() => {
    if (!companyCode || !activeBranchId) return;
    setError("");
    void retailSettingsApi
      .get({ companyCode, branchId: activeBranchId })
      .then((value) => {
        setSettings(value);
        setInitialSettings(value);
      })
      .catch((cause) => setError(getApiErrorMessage(cause, "Không tải được cài đặt.")));
  }, [companyCode, activeBranchId]);

  const hasChanges = useMemo(() => {
    if (!settings || !initialSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [settings, initialSettings]);

  if (!activeBranchId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-amber-200 bg-amber-50/70 p-12 text-center text-amber-800">
        <Store className="mb-3 h-12 w-12 text-amber-500" />
        <h3 className="text-base font-bold text-amber-900">Chưa chọn chi nhánh</h3>
        <p className="mt-1 text-xs text-amber-700 max-w-sm">
          Vui lòng chọn chi nhánh làm việc từ thanh điều hướng phía trên để thiết lập cấu hình bán hàng.
        </p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 animate-pulse">
          <Settings className="h-6 w-6 animate-spin" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">Đang tải cấu hình bán hàng…</p>
        <p className="mt-1 text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
      </div>
    );
  }

  const update = <K extends keyof RetailSettings>(key: K, value: RetailSettings[K]) =>
    setSettings((current) => (current ? { ...current, [key]: value } : current));

  const handleReset = () => {
    if (initialSettings) {
      setSettings(initialSettings);
      setError("");
      toast.info("Đã khôi phục cài đặt ban đầu.");
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const { companyCode: _companyCode, branchId: _branchId, ...input } = settings;
      const updated = await retailSettingsApi.update(input, { companyCode, branchId: activeBranchId });
      setSettings(updated);
      setInitialSettings(updated);
      toast.success("Đã lưu cấu hình bán hàng chi nhánh thành công!");
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không lưu được cài đặt.");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const openTestReceipt = async () => {
    let storeName = "";
    try {
      ({ storeName } = await retailSettingsApi.printConfig({ companyCode, branchId: activeBranchId }));
    } catch (cause) {
      const msg = getApiErrorMessage(cause, "Không lấy được tên cửa hàng để in thử.");
      toast.error(msg);
      return;
    }
    const issuedAt = new Date().toISOString();
    const total = 13_300_000;
    const brandName = storeName.trim() || companyCode;
    setTestInvoice({
      _id: "test-invoice",
      orderId: "test-order",
      invoiceNo: (settings.invoicePrefix || "HD") + "-IN-THU",
      orderCode: (settings.orderPrefix || "DH") + "-IN-THU",
      issuedAt,
      status: "issued",
      snapshot: {
        store: {
          legalName: brandName,
          storeName: brandName,
          branchCode: activeBranch?.code || "",
          branchName: activeBranch?.name || userProfile?.branchName || "",
          branchAddress: activeBranch?.address,
          branchPhone: activeBranch?.phone,
        },
        customerName: "Khách hàng in thử",
        cashierName: userProfile?.displayName || "Nhân viên bán hàng",
        salespersonName: userProfile?.displayName || "Nhân viên bán hàng",
        businessDate: issuedAt.slice(0, 10),
        items: [
          { productId: "test-phone", sku: "SP-IN-THU-01", productName: "Điện thoại mẫu 128GB", unit: "cái", quantity: 1, unitPrice: 12_900_000, discountAmount: 0, lineTotal: 12_900_000 },
          { productId: "test-case", sku: "SP-IN-THU-02", productName: "Ốp lưng mẫu", unit: "cái", quantity: 2, unitPrice: 250_000, discountAmount: 0, lineTotal: 500_000 },
        ],
        subtotal: 13_400_000,
        orderDiscount: 100_000,
        taxRate: 0,
        taxAmount: 0,
        shippingFee: 0,
        grandTotal: total,
        paidAmount: total,
        dueAmount: 0,
        paymentStatus: "paid",
        payments: [{ method: "cash", amount: total, tenderedAmount: 14_000_000, changeAmount: 700_000 }],
        amountInWords: "Mười ba triệu ba trăm nghìn đồng",
      },
    });
  };

  const printTestReceipt = async () => {
    const receipt = document.querySelector<HTMLElement>(".retail-print-staging #retail-receipt");
    if (!receipt) {
      toast.error("Chưa dựng được hóa đơn mẫu để in.");
      return;
    }
    const printWindow = window.open("about:blank", "_blank");
    if (!printWindow) {
      toast.error("Trình duyệt đang chặn cửa sổ in hóa đơn.");
      return;
    }

    const paperSize = settings.invoicePaperSize;
    const isThermal = paperSize === "80mm" || paperSize === "58mm";
    const receiptWidth = isThermal ? paperSize : "100%";
    const receiptPadding = paperSize === "58mm" ? "5mm" : paperSize === "80mm" ? "4mm" : "14mm";
    const contentHeightMm = receipt.getBoundingClientRect().height * 25.4 / 96;
    const pageRule = isThermal ? `${paperSize} ${Math.ceil(contentHeightMm + 2)}mm` : paperSize;
    const printDocument = printWindow.document;
    printDocument.open();
    printDocument.write("<!doctype html><html><head><meta charset=\"utf-8\"><title></title></head><body></body></html>");
    printDocument.close();
    printDocument.title = "";
    const base = printDocument.createElement("base");
    base.href = `${window.location.origin}/`;
    printDocument.head.appendChild(base);

    const stylesheetLoads: Promise<void>[] = [];
    document.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]').forEach((node) => {
      const copy = node.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
      if (copy instanceof HTMLLinkElement && node instanceof HTMLLinkElement) {
        copy.href = node.href;
        stylesheetLoads.push(new Promise((resolve) => {
          copy.addEventListener("load", () => resolve(), { once: true });
          copy.addEventListener("error", () => resolve(), { once: true });
        }));
      }
      printDocument.head.appendChild(copy);
    });

    const printStyle = printDocument.createElement("style");
    printStyle.media = "print";
    printStyle.textContent = `@page { size: ${pageRule}; margin: 0; } @media print { html, body { margin: 0 !important; padding: 0 !important; } }`;
    printDocument.head.appendChild(printStyle);
    printDocument.body.className = "retail-print-isolated";
    const staging = printDocument.createElement("div");
    staging.className = "retail-print-staging";
    staging.style.position = "fixed";
    staging.style.left = "-10000px";
    staging.style.top = "0";
    staging.style.visibility = "hidden";
    staging.style.width = receiptWidth;
    staging.appendChild(receipt.cloneNode(true));
    printDocument.body.appendChild(staging);

    try {
      await Promise.race([
        Promise.all(stylesheetLoads),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
      ]);
      await printDocument.fonts.ready;
      await Promise.all(Array.from(printDocument.images, (image) =>
        image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
      ));
      printWindow.addEventListener("afterprint", () => printWindow.close(), { once: true });
      printWindow.focus();
      printWindow.print();
    } catch {
      printWindow.close();
      toast.error("Không mở được nội dung hóa đơn để in.");
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-100/50 to-blue-100/30 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/20">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900">Cài đặt bán hàng</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-0.5 text-xs font-semibold text-cyan-800">
                  <Store className="h-3.5 w-3.5" />
                  {activeBranch?.name || `Chi nhánh: ${activeBranchId}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Khôi phục
              </button>
            )}
            <button
              type="button"
              disabled={saving || !hasChanges}
              onClick={() => void save()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:shadow-none cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? "Đang lưu…" : "Lưu cài đặt"}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 flex items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 1: Kho & Vận hành quầy POS */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Vận hành kho & Bán hàng</h2>
                <p className="text-[11px] text-slate-500">Quy tắc xuất bán và kiểm soát tồn kho tại quầy</p>
              </div>
            </div>

            <div className="space-y-5 pt-5">
              {/* Cho phép bán âm kho toggle card */}
              <div
                className={`flex items-start justify-between gap-4 rounded-2xl border p-4 transition ${settings.allowNegativeStock
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-slate-200 bg-slate-50/40"
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">Cho phép bán âm kho</span>
                    {settings.allowNegativeStock ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        <AlertTriangle className="h-3 w-3" />
                        Đang bật
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Đang khóa
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Cho phép thu ngân hoàn tất đơn bán ngay cả khi số lượng tồn kho sản phẩm bằng 0. Tồn kho sẽ chuyển sang số âm và cần nhập bù sau.
                  </p>
                </div>

                {/* Custom Accessible Toggle */}
                <label className="relative inline-flex cursor-pointer items-center shrink-0 mt-0.5">
                  <input
                    aria-label="Cho phép bán âm kho"
                    type="checkbox"
                    className="sr-only peer"
                    checked={settings.allowNegativeStock}
                    onChange={(event) => update("allowNegativeStock", event.target.checked)}
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-amber-500 peer-focus:ring-4 peer-focus:ring-amber-500/20 transition-all after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-xs after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Ngưỡng chênh lệch kiểm quỹ ca */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="varianceReasonThreshold" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-slate-400" />
                    Ngưỡng giải trình lệch quỹ kết ca (₫)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-cyan-700">
                    {(settings.varianceReasonThreshold || 0).toLocaleString("vi-VN")} ₫
                  </span>
                </div>
                <input
                  id="varianceReasonThreshold"
                  aria-label="Ngưỡng giải trình lệch quỹ (₫)"
                  type="number"
                  min="0"
                  step="10000"
                  value={settings.varianceReasonThreshold || 0}
                  onChange={(event) => update("varianceReasonThreshold", Math.max(0, Number(event.target.value)))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 shadow-xs transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
                <p className="text-[11px] text-slate-400">
                  Khi chênh lệch tiền mặt thực tế và sổ sách khi đóng ca vượt số tiền này, thu ngân bắt buộc phải nhập lý do giải trình.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-3.5 text-[11px] text-slate-500 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-600 shrink-0" />
            <span>Mọi thay đổi tồn kho và kết ca đều được lưu nhật ký đối soát chi tiết.</span>
          </div>
        </div>

        {/* Section 2: Chính sách giá, Thuế & Chiết khấu */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Percent className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Chiết khấu & Thuế VAT</h2>
                <p className="text-[11px] text-slate-500">Giới hạn giảm giá tay và tỷ lệ thuế suất tự động</p>
              </div>
            </div>

            <div className="space-y-5 pt-5">
              {/* Giảm giá tối đa */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="maxDiscountPercent" className="text-xs font-bold text-slate-700">
                    Giảm giá tối đa (%)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[0, 5, 10, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => update("maxDiscountPercent", pct)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${settings.maxDiscountPercent === pct
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="maxDiscountPercent"
                    aria-label="Giảm giá tối đa (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.maxDiscountPercent}
                    onChange={(event) => update("maxDiscountPercent", Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 shadow-xs transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Hạn mức % chiết khấu tối đa mà thu ngân được phép tự nhập tại màn hình thanh toán POS.
                </p>
              </div>

              {/* Thuế suất mặc định */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="defaultTaxRate" className="text-xs font-bold text-slate-700">
                    Thuế suất mặc định (%)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[0, 8, 10].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => update("defaultTaxRate", rate)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${settings.defaultTaxRate === rate
                            ? "bg-cyan-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="defaultTaxRate"
                    aria-label="Thuế suất mặc định (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.defaultTaxRate}
                    onChange={(event) => update("defaultTaxRate", Number(event.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 shadow-xs transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tự động áp dụng thuế GTGT (VAT) này vào tổng thanh toán đơn hàng mới tạo.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-emerald-50/50 p-3.5 text-[11px] text-emerald-800 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Thu ngân có thể điều chỉnh lại mã ưu đãi coupon trực tiếp trên từng đơn hàng.</span>
          </div>
        </div>

        {/* Section 3: Định dạng mã chứng từ */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Hash className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Định dạng mã chứng từ</h2>
                <p className="text-[11px] text-slate-500">Tiền tố nhận diện đơn hàng và hóa đơn bán hàng</p>
              </div>
            </div>

            <div className="space-y-4 pt-5">
              <div className="grid grid-cols-2 gap-3">
                {/* Prefix mã đơn */}
                <div className="space-y-1.5">
                  <label htmlFor="orderPrefix" className="text-xs font-bold text-slate-700">
                    Prefix mã đơn
                  </label>
                  <input
                    id="orderPrefix"
                    aria-label="Prefix mã đơn"
                    type="text"
                    maxLength={8}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold uppercase text-slate-800 shadow-xs transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="DH"
                    value={settings.orderPrefix}
                    onChange={(event) => update("orderPrefix", event.target.value.toUpperCase())}
                  />
                  <p className="text-[10px] text-slate-400">Tối đa 8 ký tự</p>
                </div>

                {/* Prefix hóa đơn */}
                <div className="space-y-1.5">
                  <label htmlFor="invoicePrefix" className="text-xs font-bold text-slate-700">
                    Prefix hóa đơn
                  </label>
                  <input
                    id="invoicePrefix"
                    aria-label="Prefix hóa đơn"
                    type="text"
                    maxLength={8}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold uppercase text-slate-800 shadow-xs transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="HD"
                    value={settings.invoicePrefix}
                    onChange={(event) => update("invoicePrefix", event.target.value.toUpperCase())}
                  />
                  <p className="text-[10px] text-slate-400">Tối đa 8 ký tự</p>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4 space-y-2">
                <span className="text-[11px] font-bold text-indigo-900 block">Xem trước mã sinh tự động:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white p-2.5 border border-indigo-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 block">Mã đơn hàng</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {settings.orderPrefix || "DH"}-{todayStr}-0001
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 border border-indigo-100 shadow-xs">
                    <span className="text-[10px] text-slate-400 block">Số hóa đơn</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {settings.invoicePrefix || "HD"}-{todayStr}-0001
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Cấu hình in ấn & Hóa đơn */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Printer className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">In ấn & Hóa đơn</h2>
                <p className="text-[11px] text-slate-500">Kích thước khổ giấy và mẫu biểu xuất in</p>
              </div>
            </div>

            <div className="space-y-4 pt-5">
              {/* Khổ giấy hóa đơn */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Khổ giấy in hóa đơn
                </label>

                {/* Visual card selector */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: "58mm", title: "58 mm (XP-58)", desc: "Máy in bill XP-58", icon: Receipt },
                    { id: "80mm", title: "80 mm (K80)", desc: "Máy in bill nhiệt", icon: Receipt },
                    { id: "A5", title: "Khổ A5", desc: "Phiếu nhỏ gọn", icon: FileText },
                    { id: "A4", title: "Khổ A4", desc: "Đầy đủ tiêu chuẩn", icon: Printer },
                  ].map((item) => {
                    const active = settings.invoicePaperSize === item.id;
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => update("invoicePaperSize", item.id as RetailSettings["invoicePaperSize"])}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center cursor-pointer transition select-none ${active
                            ? "border-cyan-500 bg-cyan-50/70 text-cyan-950 font-bold shadow-xs ring-2 ring-cyan-500/20"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/60"
                          }`}
                      >
                        <Icon className={`h-5 w-5 mb-1.5 ${active ? "text-cyan-600" : "text-slate-400"}`} />
                        <span className="text-xs leading-tight font-semibold">{item.title}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{item.desc}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Hidden/Standard Select for full compatibility and automated testing */}
                <select
                  aria-label="Khổ giấy hóa đơn"
                  value={settings.invoicePaperSize}
                  onChange={(event) => update("invoicePaperSize", event.target.value as RetailSettings["invoicePaperSize"])}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-800 shadow-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="58mm">58 mm (Máy in bill XP-58)</option>
                  <option value="80mm">80 mm (Máy in bill nhiệt K80)</option>
                  <option value="A5">Khổ A5 (Nửa tờ A4)</option>
                  <option value="A4">Khổ A4 (Tiêu chuẩn)</option>
                </select>
              </div>

              {/* Mẫu hóa đơn */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Mẫu hóa đơn
                </label>
                <select
                  aria-label="Mẫu hóa đơn"
                  value={settings.invoiceTemplate}
                  onChange={(event) => update("invoiceTemplate", event.target.value as RetailSettings["invoiceTemplate"])}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 shadow-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="standard">{"Ti\u00eau chu\u1ea9n (K\u00e8m m\u00e3 v\u1ea1ch v\u00e0 th\u00f4ng tin c\u1eeda h\u00e0ng)"}</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3.5">
                <p className="max-w-md text-[11px] leading-relaxed text-slate-600">In hóa đơn mẫu để kiểm tra nội dung và khổ giấy đang chọn. Không tạo đơn bán thật.</p>
                <button type="button" onClick={openTestReceipt} className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-cyan-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/25">
                  <Printer className="h-4 w-4" />
                  In thử hóa đơn
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {testInvoice && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="In thử hóa đơn" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div><h2 className="font-bold text-slate-900">In thử hóa đơn</h2><p className="mt-0.5 text-xs text-slate-500">Dữ liệu mẫu · Khổ giấy {settings.invoicePaperSize}</p></div>
              <button type="button" aria-label="Đóng xem trước" onClick={() => setTestInvoice(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
            </header>
            <div className="max-h-[65vh] overflow-y-auto bg-slate-100 p-4 sm:p-6">
              <ReceiptPrintView invoice={testInvoice} paperSize={settings.invoicePaperSize} />
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">
              <button type="button" onClick={() => setTestInvoice(null)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Đóng</button>
              <button type="button" onClick={() => void printTestReceipt()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800"><Printer className="h-4 w-4" />In thử</button>
            </footer>
          </div>
        </div>
      )}
      {testInvoice && createPortal(
        <div className="retail-print-staging" style={{ position: "fixed", left: "-10000px", top: 0, width: receiptStagingWidth(settings.invoicePaperSize), visibility: "hidden" }}>
          <ReceiptPrintView invoice={testInvoice} paperSize={settings.invoicePaperSize} printTarget />
        </div>,
        document.body,
      )}

      {/* Floating / Sticky Save Bar when changes detected */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/95 px-6 py-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700">Có thay đổi cấu hình chưa lưu</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-600/20 transition hover:from-cyan-500 hover:to-blue-500 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
