import React from "react";
import { Camera, CheckCircle2, ChevronDown, ChevronRight, Folder, Keyboard, Loader2, Lock, Maximize2, Minimize2, Package, Pause, Printer, QrCode, RefreshCw, Search, ShoppingCart, Smartphone, Tablet, Headphones, User, X } from "lucide-react";
import { customerApi } from "../../customer-management/customerApi";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import BarcodeScannerDialog from "../components/pos/BarcodeScannerDialog";
import CheckoutSuccessDialog from "../components/pos/CheckoutSuccessDialog";
import { retailSettingsApi } from "../api/retailSettings.api";
import CustomerPicker from "../components/pos/CustomerPicker";
import DiscountInput from "../components/pos/DiscountInput";
import HeldDraftsBar from "../components/pos/HeldDraftsBar";
import OrderAdjustments from "../components/pos/OrderAdjustments";
import { QuantityInput } from "../components/pos/QuantityInput";
import PaymentDialog from "../components/pos/PaymentDialog";
import PosShortcutHelp from "../components/pos/PosShortcutHelp";
import ScanFeedback, {
  playScanTone,
  type ScanFeedbackKind,
} from "../components/pos/ScanFeedback";
import RetailOfflineQueuePanel from "../components/pos/RetailOfflineQueuePanel";
import RetailAddSerialDialog from "../components/pos/RetailAddSerialDialog";
import RetailCollaboratorSelect from "../components/pos/RetailCollaboratorSelect";
import RetailCouponInput from "../components/pos/RetailCouponInput";
import RetailPointsInput from "../components/pos/RetailPointsInput";
import { SerialPicker, UnitBarcodePicker } from "../components/pos/RetailUnitPickerDialog";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import { retailProductsApi, type RetailOfficialCategory } from "../api/retailProducts.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import {
  initialRetailCart,
  retailCartReducer,
  type RetailCartState,
} from "../hooks/retailCart";
import { buildRetailOrderInput } from "../hooks/retailOrderInput";
import { useRetailScope } from "../hooks/useRetailScope";
import { useRetailPosShortcuts } from "../hooks/useRetailPosShortcuts";
import { useRetailFullscreen } from "../hooks/useRetailFullscreen";
import { getPosTerminalId } from "../posTerminal";
import { createHidScannerBuffer } from "../hooks/retailScannerInput";
import { discardPosCart, readPosCart, savePosCart } from "../offline/posCartRecovery";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { companyPaymentApi } from "../../../services/companyPaymentService";
import { createIndexedDbRetailOfflineQueue, createRetailOfflineOrder, type OfflineScope, type RetailOfflineOrder, type RetailOfflineQueue } from "../offline/retailOfflineQueue";
import { isRetailNetworkFailure, syncRetailOfflineQueue } from "../offline/retailOfflineSync";
import { withRetailCheckoutLock } from "../offline/retailCheckoutLock";
import type {
  RetailOrder,
  RetailOrderResult,
  RetailPaymentInput,
  RetailPaymentQr,
  RetailProduct,
  RetailInstallment,
  RetailInvoice,
  RetailScope,
  RetailShift,
  RetailSettings,
} from "../types";
import { toast } from "../../../pages/Toast";
import { cn } from "../../student-management/lib/utils";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const installmentError = (value?: RetailInstallment | null) => !value ? "" : !value.partner.trim() || value.partner.length > 100 || !Number.isSafeInteger(value.months) || value.months < 1 || value.months > 60 || !Number.isFinite(value.prepayPercent) || value.prepayPercent < 0 || value.prepayPercent > 100 ? "Kiểm tra đối tác, thời hạn 1–60 tháng và tỷ lệ trả trước 0–100%." : "";
const canonicalValue = (value: any): any => Array.isArray(value) ? value.map(canonicalValue) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])])) : value;
const qrPaymentMethods: RetailPaymentInput["method"][] = ["transfer", "ewallet"];

type PendingTransferPayment = {
  order: RetailOrder;
  invoice?: RetailInvoice;
  qr: RetailPaymentQr | null;
  loading: boolean;
  error?: string;
  settled: boolean;
};

export default function RetailPosPage({ onLeavePos, onManageShift, onPrinterSettings }: { onLeavePos?: () => void; onManageShift?: () => void; onPrinterSettings?: () => void } = {}) {
  const { scope, userProfile, branchName, logout } = useRetailScope();
  const canLeavePos = userProfile?.role === "admin" || userProfile?.role === "superadmin" || Boolean(userProfile?.permissions?.includes("retail:manage") || userProfile?.permissions?.includes("*"));
  const terminalId = scope ? getPosTerminalId(scope.companyCode, scope.branchId) : "";
  const { fullscreen, toggleFullscreen } = useRetailFullscreen();
  const [cart, dispatch] = React.useReducer(
    retailCartReducer,
    initialRetailCart,
  );
  const cartRef = React.useRef(cart);
  cartRef.current = cart;
  const defaultTaxRate = React.useRef(0);
  const manualTaxRateChanged = React.useRef(false);
  const dispatchCartAction = (action: any) => {
    if (action?.type === "orderAdjustments") manualTaxRateChanged.current = true;
    dispatch(action);
  };
  const quoteRequestId = React.useRef(0);
  const [products, setProducts] = React.useState<RetailProduct[]>([]);
  const [officialCategories, setOfficialCategories] = React.useState<RetailOfficialCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [selectedBrand, setSelectedBrand] = React.useState("");
  const [drafts, setDrafts] = React.useState<RetailOrder[]>([]);
  const [draft, setDraft] = React.useState<RetailOrder | null>(null);
  const [retailPartnerId, setRetailPartnerId] = React.useState("");
  const [shift, setShift] = React.useState<RetailShift | null>(null);
  const [shiftError, setShiftError] = React.useState<unknown>(null);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [billingProfiles, setBillingProfiles] = React.useState<any[]>([]);
  const [scanning, setScanning] = React.useState(false);
  const [unitSelection, setUnitSelection] = React.useState<RetailProduct | null>(null);
  const [completed, setCompleted] = React.useState<RetailOrderResult | null>(
    null,
  );
  React.useEffect(() => {
    if (!completed) return;
    const timer = window.setTimeout(() => { try { window.print(); } catch { toast.error("Chưa mở được hộp thoại in. Bạn có thể in hóa đơn từ màn hình xác nhận."); } }, 0);
    return () => window.clearTimeout(timer);
  }, [completed?.invoice._id]);
  const [invoicePaperSize, setInvoicePaperSize] = React.useState<RetailSettings["invoicePaperSize"]>("80mm");
  const [transferPayment, setTransferPayment] = React.useState<PendingTransferPayment | null>(null);
  const [help, setHelp] = React.useState(false);
  const [mobileCartOpen, setMobileCartOpen] = React.useState(false);
  const [pendingLeave, setPendingLeave] = React.useState<(() => void) | null>(null);
  const [closeShiftOpen, setCloseShiftOpen] = React.useState(false);
  const [countedCash, setCountedCash] = React.useState("");
  const [varianceReason, setVarianceReason] = React.useState("");
  const [closeShiftError, setCloseShiftError] = React.useState("");
  const closeShiftDialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = closeShiftDialogRef.current;
    if (closeShiftOpen && dialog && !dialog.open) dialog.showModal();
    else if (!closeShiftOpen && dialog?.open) dialog.close();
  }, [closeShiftOpen]);
  const [recoveryBlocked, setRecoveryBlocked] = React.useState(false);
  const [recoveryError, setRecoveryError] = React.useState("");
  const [recoveryMessage, setRecoveryMessage] = React.useState("");
  const recoveryKey = scope && userProfile?.uid ? `retail-pos-cart:v1:${JSON.stringify([scope.companyCode, scope.branchId, userProfile.uid])}` : null;
  const recoveryAppliedKey = React.useRef<string | null>(null);
  const [recoveryReadyKey, setRecoveryReadyKey] = React.useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = React.useState<{
    kind: ScanFeedbackKind;
    text: string;
  } | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const queueRef = React.useRef<RetailOfflineQueue | null>(null);
  const [offlineItems, setOfflineItems] = React.useState<RetailOfflineOrder[]>([]);
  const offlineScope = scope && userProfile?.uid ? { ...scope, userId: userProfile.uid } : null;
  const [offlineReady, setOfflineReady] = React.useState(false);
  const [offlineStorageError, setOfflineStorageError] = React.useState("");
  const getOfflineQueue = React.useCallback(() => {
    if (typeof indexedDB === "undefined") throw new Error("Trình duyệt không hỗ trợ lưu giao dịch an toàn. Hãy mở POS trên trình duyệt hỗ trợ IndexedDB.");
    if (!(navigator as any).locks?.request) throw new Error("Trình duyệt cần hỗ trợ khóa giao dịch để thanh toán an toàn.");
    if (!queueRef.current) queueRef.current = createIndexedDbRetailOfflineQueue(indexedDB);
    return queueRef.current;
  }, []);
  const hasPendingOffline = offlineItems.some((item) => item.status !== "synced");
  const openPayment = () => {
    const installmentIssue = installmentError(cart.installment);
    if (installmentIssue) { toast.error(installmentIssue); return; }
    if (recoveryBlocked) {
      toast.error("Hãy xử lý bản lưu giỏ lỗi trước khi thanh toán.");
      return;
    }
    if (!shift || shift.pausedAt) {
      toast.error(shift?.pausedAt ? "Ca bán hàng đang tạm dừng. Vui lòng mở lại ca." : "Vui lòng mở ca bán hàng trước khi thanh toán.");
      return;
    }
    if (!offlineReady) {
      toast.info("Đang kiểm tra bộ lưu giao dịch của POS. Vui lòng thử lại sau giây lát.");
      return;
    }
    if (offlineStorageError) {
      toast.error(offlineStorageError);
      return;
    }
    if (hasPendingOffline) {
      toast.error("Còn giao dịch bán chưa rõ kết quả. Hãy đồng bộ hoặc đối chiếu trước khi bán đơn mới.");
      return;
    }
    if (!cart.quote || cart.quoteDirty) {
      toast.error("Đang tính lại tổng tiền. Vui lòng đợi báo giá mới.");
      return;
    }
    setPaying(true);
  };
  const refreshOffline = React.useCallback(async () => {
    if (!offlineScope) return;
    try {
      const items = await getOfflineQueue().list(offlineScope);
      setOfflineItems(items.filter((item) => item.status !== "synced"));
      setOfflineStorageError("");
    } catch (error) {
      setOfflineItems([]);
      setOfflineStorageError(error instanceof Error ? error.message : "Không truy cập được bộ lưu giao dịch của POS.");
    } finally {
      setOfflineReady(true);
    }
  }, [getOfflineQueue, offlineScope?.companyCode, offlineScope?.branchId, offlineScope?.userId]);
  useRetailPosShortcuts(
    React.useMemo(
      () => ({
        focusSearch: () => searchRef.current?.focus(),
        openPayment,
        holdDraft: () =>
          (
            Array.from(document.querySelectorAll("button")).find((button) =>
              button.textContent?.includes("Treo đơn"),
            ) as HTMLButtonElement | undefined
          )?.click(),
        openScanner: () => setScanning(true),
        openHelp: () => setHelp(true),
      }),
      [openPayment],
    ),
  );

  const show = React.useCallback(
    (cause: unknown) =>
      toast.error(
        cause instanceof Error ? cause.message : "Không xử lý được yêu cầu.",
      ),
    [],
  );
  const signOut = async () => {
    if (!logout) return;
    try {
      if (scope && shift && !shift.pausedAt) await retailShiftsApi.pause(scope, shift._id, "Đăng xuất khỏi quầy POS");
      await logout();
    } catch (cause) { show(cause); }
  };
  const closeShift = async () => {
    if (!shift || !scope || busy) return;
    const amount = Number(countedCash);
    if (!countedCash.trim() || !Number.isSafeInteger(amount) || amount < 0) {
      setCloseShiftError("Nhập số tiền thực đếm hợp lệ.");
      return;
    }
    setBusy(true);
    setCloseShiftError("");
    try {
      await retailShiftsApi.close(scope, shift._id, { countedCash: amount, varianceReason: varianceReason.trim() || undefined });
      setShift(null);
      setCloseShiftOpen(false);
      setCountedCash("");
      setVarianceReason("");
      toast.success("Đã kiểm đếm và đóng ca bán hàng.");
    } catch (cause) {
      setCloseShiftError(cause instanceof Error ? cause.message : "Không đóng được ca bán hàng.");
    } finally {
      setBusy(false);
    }
  };
  const refreshDrafts = React.useCallback(() => {
    if (scope)
      void retailOrdersApi
        .list(scope, { heldOnly: true, limit: 5 })
        .then((data) => setDrafts(data.items))
        .catch(show);
  }, [scope?.companyCode, scope?.branchId, show]);

  const categoryPath = React.useMemo(() => {
    const path: RetailOfficialCategory[] = [];
    let current = officialCategories.find((item) => item.code === selectedCategory);
    while (current && path.length < officialCategories.length) {
      path.unshift(current);
      current = officialCategories.find((item) => item.code === current?.parentCode);
    }
    return path;
  }, [officialCategories, selectedCategory]);
  const categoryProductCodes = React.useMemo(() => {
    if (!selectedCategory) return null;
    const codes = new Set([selectedCategory]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of officialCategories) {
        if (category.parentCode && codes.has(category.parentCode) && !codes.has(category.code)) {
          codes.add(category.code);
          changed = true;
        }
      }
    }
    return codes;
  }, [officialCategories, selectedCategory]);
  const visibleProducts = React.useMemo(
    () => categoryProductCodes ? products.filter((product) => categoryProductCodes.has(product.category || "")) : products,
    [categoryProductCodes, products],
  );
  const brandOptions = React.useMemo(() => [...new Set(visibleProducts.map((product) => product.brand?.trim()).filter((brand): brand is string => Boolean(brand)))], [visibleProducts]);
  const displayProducts = React.useMemo(() => selectedBrand ? visibleProducts.filter((product) => product.brand?.trim() === selectedBrand) : visibleProducts, [visibleProducts, selectedBrand]);
  const chooseCategory = (code: string) => { setSelectedCategory(code); setSelectedBrand(""); };
  const level2Categories = React.useMemo(
    () => categoryPath[0] ? officialCategories.filter((category) => category.parentCode === categoryPath[0].code) : [],
    [officialCategories, categoryPath],
  );
  const level3Categories = React.useMemo(
    () => categoryPath[1] ? officialCategories.filter((category) => category.parentCode === categoryPath[1].code) : [],
    [officialCategories, categoryPath],
  );
  const topCategories = React.useMemo(
    () => officialCategories.filter((category) => !category.parentCode || !officialCategories.some((parent) => parent.code === category.parentCode)),
    [officialCategories],
  );
  const currentRoot = categoryPath[0]?.code || "";
  const categoryTitle = q.trim() ? `Kết quả tìm kiếm cho "${q.trim()}"` : selectedBrand || categoryPath.at(-1)?.name || "Tất cả sản phẩm";
  const leavePos = (action?: () => void) => {
    if (!action) return;
    if (cart.lines.length || draft) setPendingLeave(() => action);
    else action();
  };

  React.useEffect(() => {
    let active = true;
    setInvoicePaperSize("80mm");
    defaultTaxRate.current = 0;
    manualTaxRateChanged.current = false;
    if (scope) void retailSettingsApi.printConfig(scope)
      .then((settings) => {
        if (!active) return;
        setInvoicePaperSize(settings.invoicePaperSize);
        defaultTaxRate.current = settings.defaultTaxRate;
        if (!cartRef.current.lines.length && !manualTaxRateChanged.current) dispatch({ type: "defaultTaxRate", taxRate: settings.defaultTaxRate });
      })
      .catch(() => { if (active) toast.error("Không tải được khổ giấy máy in của chi nhánh."); });
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId]);

  React.useEffect(() => {
    if (!scope) return;
    let active = true;
    const refreshShift = () => { void retailShiftsApi.current(scope).then(async (value) => {
      if (value && !value.terminalId) value = await retailShiftsApi.resume(scope, value._id, terminalId);
      if (active) { setShift(value); setShiftError(null); }
    }).catch((cause) => { if (active) setShiftError(cause); }); };
    refreshShift();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refreshShift(); }, 15000);
    const onFocus = () => { if (document.visibilityState === "visible") refreshShift(); };
    document.addEventListener("visibilitychange", onFocus);
    refreshDrafts();
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", onFocus); };
  }, [scope?.companyCode, scope?.branchId, terminalId, refreshDrafts, show]);
  React.useEffect(() => {
    if (!scope) return;
    let active = true;
    void retailProductsApi.categories(scope)
      .then((items) => {
        if (!active) return;
        setOfficialCategories(items);
        setSelectedCategory((current) => items.some((item) => item.code === current) ? current : "");
      })
      .catch(show);
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId, show]);
  React.useEffect(() => {
    if (!recoveryKey || recoveryAppliedKey.current === recoveryKey) return;
    recoveryAppliedKey.current = recoveryKey;
    setRecoveryReadyKey(null);
    setRecoveryBlocked(false);
    setRecoveryError("");
    setRecoveryMessage("");
    const recovered = readPosCart(recoveryKey);
    dispatch({ type: "reset", taxRate: defaultTaxRate.current });
    if (recovered.error) {
      setRecoveryBlocked(true);
      setRecoveryError(recovered.error);
      return;
    }
    if (recovered.cart.lines.length) {
      dispatch({
        type: "load",
        lines: recovered.cart.lines,
        customer: recovered.cart.customer,
        billingProfile: recovered.cart.billingProfile,
        orderDiscount: recovered.cart.orderDiscount,
        couponCode: recovered.cart.couponCode,
        pointsToRedeem: recovered.cart.pointsToRedeem,
        taxRate: recovered.cart.taxRate,
        shippingFee: recovered.cart.shippingFee,
      });
      setRecoveryMessage(`Đã khôi phục giỏ hàng gồm ${recovered.cart.lines.length} mặt hàng. Giá sẽ được tính lại trước khi thanh toán.`);
    }
    setRecoveryReadyKey(recoveryKey);
  }, [recoveryKey]);
  React.useEffect(() => {
    if (!recoveryKey || recoveryReadyKey !== recoveryKey || recoveryBlocked) return;
    try {
      savePosCart(recoveryKey, cart);
      setRecoveryError("");
    } catch {
      setRecoveryError("Không lưu được giỏ hàng trên thiết bị này.");
    }
  }, [cart, recoveryBlocked, recoveryKey, recoveryReadyKey]);
  React.useEffect(() => {
    if (!scope) return;
    const timer = window.setTimeout(
      () =>
        void retailProductsApi
          .list(scope, { q, limit: 500 })
          .then((data) => { setProducts(data.items); if (data.categories?.length) setOfficialCategories(data.categories); })
          .catch(show),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [scope?.companyCode, scope?.branchId, q, show]);
  React.useEffect(() => {
    const requestId = ++quoteRequestId.current;
    if (!scope || !cart.lines.length || !cart.quoteDirty) return;
    const timer = window.setTimeout(
      () =>
        void retailOrdersApi
          .quote(scope, buildRetailOrderInput(cart))
          .then((quote) => { if (requestId === quoteRequestId.current) dispatch({ type: "quote", quote }); })
          .catch((error) => { if (requestId === quoteRequestId.current) show(error); }),
      180,
    );
    return () => window.clearTimeout(timer);
  }, [scope, cart, show]);
  React.useEffect(() => {
    if (!scope || !cart.customer?._id) {
      setBillingProfiles([]);
      dispatch({ type: "billingProfile", billingProfile: null });
      return;
    }
    void customerApi.billingProfiles(cart.customer._id, scope.companyCode)
      .then((items) => {
        const active = items.filter((item) => item.status === "active");
        setBillingProfiles(active);
        const selected = active.find((item) => item._id === cart.billingProfile?._id) || active.find((item) => item.isDefault) || null;
        dispatch({ type: "billingProfile", billingProfile: selected });
      })
      .catch(() => {
        setBillingProfiles([]);
        dispatch({ type: "billingProfile", billingProfile: null });
      });
  }, [scope?.companyCode, cart.customer?._id]);
  React.useEffect(() => { refreshOffline(); }, [refreshOffline]);
  React.useEffect(() => {
    if (!scope || !transferPayment || transferPayment.settled) return;
    const orderId = transferPayment.order._id;
    let active = true;
    let notified = false;
    const poll = async () => {
      try {
        const order = await retailOrdersApi.detail(scope, orderId);
        if (!active) return;
        if (order.pendingTransferAmount === 0 || order.paymentStatus === "paid" || order.dueAmount <= 0) {
          setTransferPayment((current) => current?.order._id === orderId
            ? { ...current, order, qr: null, loading: false, error: undefined, settled: true }
            : current);
          if (!notified) toast.success("SePay đã xác nhận thanh toán chuyển khoản.");
          notified = true;
          return;
        }
        if (transferPayment.qr && Number(order.pendingTransferAmount || order.dueAmount) !== transferPayment.qr.amount) {
          const qr = await retailOrdersApi.paymentQr(scope, orderId);
          if (!active) return;
          setTransferPayment((current) => current?.order._id === orderId
            ? { ...current, order, qr, loading: false, error: undefined }
            : current);
        }
      } catch {
        // Keep the current QR visible while a polling request fails temporarily.
      }
    };
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [scope?.companyCode, scope?.branchId, transferPayment?.order._id, transferPayment?.qr?.amount, transferPayment?.settled]);
  React.useEffect(() => {
    if (!scope || !transferPayment?.settled || !transferPayment.invoice?._id) return;
    let active = true;
    void retailInvoicesApi.detail(scope, transferPayment.invoice._id)
      .then((invoice) => {
        if (!active) return;
        setCompleted({ order: transferPayment.order, invoice });
        setTransferPayment(null);
      })
      .catch(show);
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId, transferPayment?.order._id, transferPayment?.settled]);

  if (!scope) return <Notice />;

  if (!shift || (shift.terminalId && shift.terminalId !== terminalId) || shift.pausedAt || (shift.operationalEndsAt && new Date(shift.operationalEndsAt).getTime() <= Date.now())) return (
    <main className="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-on-surface p-4 text-on-primary" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <section className="w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 text-on-surface shadow-lg">
        <p className="text-sm font-semibold text-primary">Quầy bán hàng · {userProfile?.displayName || "Thu ngân"}</p>
        <h1 className="mt-3 text-balance text-2xl font-bold">{shift?.terminalId && shift.terminalId !== terminalId ? "Phiên đang mở trên máy khác" : shift?.pausedAt ? "Ca bán hàng đang tạm dừng" : "Chưa có ca bán hàng"}</h1>
        <p className="mt-3 text-pretty text-sm text-on-surface-variant">{shift?.terminalId && shift.terminalId !== terminalId ? "Tiếp tục bán hàng trên máy này sẽ chuyển phiên khỏi máy cũ." : shift?.pausedAt ? "Quản lý cần tiếp tục ca trước khi bán hàng." : "Hãy chờ quản lý mở ca. Màn hình bán hàng sẽ hiện khi ca sẵn sàng."}</p>
        {shiftError && <p role="alert" className="mt-3 rounded-xl bg-error-container p-3 text-sm text-on-error-container">Không tải được trạng thái ca. Hãy thử lại hoặc liên hệ quản lý.</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {shift?.terminalId && shift.terminalId !== terminalId && <button type="button" disabled={busy} onClick={() => { setBusy(true); void retailShiftsApi.resume(scope, shift._id, terminalId).then((value) => { setShift(value); setShiftError(null); }).catch(setShiftError).finally(() => setBusy(false)); }} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Tiếp tục trên máy này</button>}
          <button type="button" onClick={() => void retailShiftsApi.current(scope).then((value) => { setShift(value); setShiftError(null); }).catch(setShiftError)} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Tải lại</button>
          {onManageShift && <button type="button" onClick={onManageShift} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary">Quản lý ca</button>}
          {onLeavePos && canLeavePos && <button type="button" onClick={onLeavePos} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Màn quản lý</button>}
          {logout && <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">Đăng xuất</button>}
        </div>
      </section>
    </main>
  );

  const scan = async (barcode: string) => {
    try {
      const warranty = await retailWarrantyService.lookup(barcode);
      if (warranty.found && warranty.status === "sold") {
        const soldDate = warranty.sold?.at ? new Date(warranty.sold.at).toLocaleDateString("vi-VN") : "không rõ ngày";
        const endDate = warranty.customerWarranty?.endAt ? new Date(warranty.customerWarranty.endAt).toLocaleDateString("vi-VN") : "không xác định";
        setScanFeedback({ kind: "warning", text: `Máy đã bán ngày ${soldDate} — còn bảo hành khách đến ${endDate}` });
        playScanTone("warning");
        return;
      }
      if (warranty.found && warranty.status === "in_stock" && (warranty.gapMonths || 0) > 0) {
        setScanFeedback({ kind: "warning", text: `Cảnh báo: bảo hành nhà cung cấp ngắn hơn cam kết khách ${warranty.gapMonths} tháng — shop sẽ chịu phần chênh lệch` });
        playScanTone("warning");
      }
      const result = await retailProductsApi.list(scope, { barcode, limit: 1 });
      const product = result.items[0];
      if (!product) {
        setScanFeedback({ kind: "not-found", text: "Không tìm thấy sản phẩm" });
        playScanTone("not-found");
        return;
      }
      const line = cart.lines.find((item) => item.product._id === product._id);
      if (product.stock <= (line?.quantity || 0)) {
        const text = `${product.name} không còn đủ tồn khả dụng.`;
        setScanFeedback({ kind: "warning", text });
        playScanTone("warning");
        return;
      }
      const unitField =
        product.trackingMode === "serial"
          ? ("serialNumbers" as const)
          : product.trackingMode === "unit_barcode"
            ? ("internalBarcodes" as const)
            : null;
      const scannedUnit =
        product.trackingMode === "serial"
          ? product.matchedSerialNumber
          : product.trackingMode === "unit_barcode"
            ? product.matchedInternalBarcode
            : undefined;
      if (unitField && scannedUnit) {
        const current = line?.[unitField] || [];
        if (current.includes(scannedUnit)) {
          setScanFeedback({
            kind: "duplicate",
            text: `${scannedUnit} đã có trong đơn`,
          });
          playScanTone("duplicate");
          return;
        }
        const next = [...current, scannedUnit];
        if (!line) dispatch({ type: "add", product });
        dispatch({
          type: "quantity",
          productId: product._id,
          quantity: next.length,
        });
        dispatch(
          unitField === "serialNumbers"
            ? { type: "serials", productId: product._id, serialNumbers: next }
            : {
                type: "internalBarcodes",
                productId: product._id,
                internalBarcodes: next,
              },
        );
        setQ("");
        setScanFeedback({
          kind: "success",
          text: `Đã thêm ${product.name} (${scannedUnit})`,
        });
        playScanTone("success");
        return;
      }
      const duplicate = Boolean(line);
      dispatch({ type: "add", product });
      setQ("");
      const kind = duplicate ? "duplicate" : "success";
      setScanFeedback({
        kind,
        text: duplicate
          ? `Đã tăng số lượng ${product.name}`
          : `Đã thêm ${product.name}`,
      });
      playScanTone(kind);
    } catch (error) {
      show(error);
    }
  };
  const addProductToCart = (product: RetailProduct, clearSearch = false) => {
    const current = cart.lines.find((line) => line.product._id === product._id)?.quantity || 0;
    if (product.stock <= current) {
      toast.error(`${product.name} không còn đủ tồn khả dụng.`);
      return;
    }
    if (product.trackingMode === "serial" || product.trackingMode === "unit_barcode") {
      setUnitSelection(product);
      return;
    }
    dispatch({ type: "add", product });
    if (clearSearch) setQ("");
  };
  const openDraft = (value: RetailOrder) => {
    setDraft(value);
    setRetailPartnerId(value.retailPartnerId || "");
    dispatch({
      type: "load",
      lines: value.items.map((item) => ({
        product: {
          _id: item.productId,
          sku: item.sku,
          name: item.productName,
          category: "",
          unit: item.unit,
          stock: 0,
          price: item.unitPrice,
        },
        quantity: item.quantity,
        discount: { type: "amount", value: item.discountAmount },
        serialNumbers: item.serialNumbers,
      })),
      customer: value.customerId
        ? {
            _id: value.customerId,
            customerCode: value.customerSnapshot?.customerCode || value.customerId,
            companyCode: scope.companyCode,
            type: value.billingProfileId ? "vat" : "regular",
            name: value.customerName || "Khách hàng",
            phone: value.customerPhone,
          }
        : null,
      billingProfile: value.billingProfileId && value.billingSnapshot
        ? {
            _id: value.billingProfileId,
            customerId: value.customerId || "",
            legalName: value.billingSnapshot.legalName,
            taxId: value.billingSnapshot.taxId,
            address: value.billingSnapshot.address,
            invoiceEmail: value.billingSnapshot.invoiceEmail,
            contactName: value.billingSnapshot.contactName,
            isDefault: false,
            status: "active",
            version: 0,
          }
        : null,
      orderDiscount: { type: "amount", value: value.manualOrderDiscount ?? value.orderDiscount },
      note: value.note,
      installment: value.installment,
      couponCode: value.couponCode,
      pointsToRedeem: value.pointsRedeemed,
      taxRate: value.taxRate,
      shippingFee: value.shippingFee,
    });
    toast.info(`Đang xử lý đơn treo #${value._id.slice(-6)}`);
  };
  const saveDraft = async () => {
    if (!cart.lines.length) return;
    const installmentIssue = installmentError(cart.installment);
    if (installmentIssue) { toast.error(installmentIssue); return; }
    if (!cart.customer?._id) { toast.error("Vui lòng chọn khách hàng trước khi lưu đơn."); return; }
    setBusy(true);
    try {
      const input = { ...buildRetailOrderInput(cart), retailPartnerId: retailPartnerId || undefined };
      if (draft)
        await retailOrdersApi.updateDraft(scope, draft._id, {
          ...input,
          version: draft.version,
        });
      else await retailOrdersApi.createDraft(scope, input);
      dispatch({ type: "reset", taxRate: defaultTaxRate.current });
      setRetailPartnerId("");
      setDraft(null);
      refreshDrafts();
      toast.success("Đã treo đơn. Đơn không giữ tồn kho.");
    } catch (error) {
      show(error);
    } finally {
      setBusy(false);
    }
  };
  const checkout = async (payments: RetailPaymentInput[], dueDate?: string) => {
    if (!shift || (shift.terminalId && shift.terminalId !== terminalId)) { toast.error("Phiên POS đã thay đổi. Hãy tải lại quầy bán hàng."); return; }
    if (!cart.quote || !offlineScope) return;
    const transferPayments = payments.filter((payment) => qrPaymentMethods.includes(payment.method));
    const immediatePayments = payments.filter((payment) => !qrPaymentMethods.includes(payment.method));
    const transferAmount = transferPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const immediateAmount = immediatePayments.reduce((sum, payment) => sum + payment.amount, 0);
    const hasPendingTransfer = transferPayments.length > 0;
    const upfrontAmount = cart.installment ? Math.round(cart.quote.grandTotal * cart.installment.prepayPercent / 100) : cart.quote.grandTotal;
    if (hasPendingTransfer && transferAmount !== upfrontAmount - immediateAmount) {
      throw new Error("Số tiền QR phải bằng phần còn lại sau các khoản thu ngay.");
    }
    if (hasPendingTransfer && !navigator.onLine) {
      throw new Error("Cần kết nối mạng để tạo QR chuyển khoản.");
    }
    setBusy(true);
    const key = crypto.randomUUID();
    const today = new Date();
    const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
    const input = { ...buildRetailOrderInput(cart), retailPartnerId: retailPartnerId || undefined, dueDate: hasPendingTransfer ? dueDate || localDate : dueDate };
    const confirmPayments = hasPendingTransfer ? immediatePayments : payments;
    const payload = {
      intentType: "checkout",
      input,
      expectedGrandTotal: cart.quote.grandTotal,
      payments: confirmPayments,
      pendingTransfer: hasPendingTransfer,
      pendingTransferAmount: transferAmount,
      posSessionId: shift._id,
      terminalId,
      draftId: draft?._id,
      draftVersion: draft?.version,
      updateExistingDraft: Boolean(draft),
      draftSaved: false,
    };
    let intent: RetailOfflineOrder | null = null;
    let savedId = draft?._id;
    try {
      if (!offlineReady || offlineStorageError) throw new Error(offlineStorageError || "Bộ lưu giao dịch của POS chưa sẵn sàng.");
      await withRetailCheckoutLock(offlineScope, async () => {
        const queue = getOfflineQueue();
        if ((await queue.list(offlineScope)).some((item) => item.status !== "synced")) {
          throw new Error("Còn giao dịch bán chưa rõ kết quả. Hãy đồng bộ hoặc đối chiếu trước khi bán đơn mới.");
        }
      if (hasPendingTransfer) {
        const config = await companyPaymentApi.getVietqr();
        if (!config?.bankId || !config?.accountNo) {
          throw new Error("Vui lòng cấu hình ngân hàng và số tài khoản trong Cài đặt doanh nghiệp trước.");
        }
      }
      intent = createRetailOfflineOrder(offlineScope, payload, key);
      intent.status = "syncing";
      await queue.put(intent);
      refreshOffline();
      const saved = payload.updateExistingDraft && payload.draftId
        ? await retailOrdersApi.updateDraft(scope, payload.draftId, { ...input, version: payload.draftVersion, idempotencyKey: key })
        : await retailOrdersApi.createDraft(scope, { ...input, idempotencyKey: key });
      savedId = saved._id;
      payload.draftId = saved._id;
      payload.draftVersion = saved.version;
      payload.draftSaved = true;
      await queue.update(intent.id, { payload });
      const result = await retailOrdersApi.confirm(scope, saved._id, {
        expectedVersion: saved.version,
        expectedGrandTotal: cart.quote.grandTotal,
        pendingTransfer: hasPendingTransfer,
        pendingTransferAmount: transferAmount,
        posSessionId: payload.posSessionId,
        terminalId: payload.terminalId,
        payments: confirmPayments,
        idempotencyKey: key,
      });
      await queue.update(intent.id, { status: "synced", lastError: undefined });
      refreshOffline();
      if (hasPendingTransfer) await openTransferPayment(result.order, result.invoice);
      else finish(result);
      });
    } catch (error) {
      const attempt = await retailOrdersApi
        .idempotency(scope, key)
        .catch(() => null);
      if (attempt?.status === "completed" && attempt.order && attempt.invoice) {
        if (intent) await getOfflineQueue().update(intent.id, { status: "synced", lastError: undefined }).catch(() => undefined);
        if (hasPendingTransfer && attempt.order.dueAmount > 0) await openTransferPayment(attempt.order, attempt.invoice);
        else finish({ order: attempt.order, invoice: attempt.invoice });
        refreshOffline();
      } else if (intent && (isRetailNetworkFailure(error) || attempt?.status === "processing" || Number((error as any)?.status) >= 500)) {
        await getOfflineQueue().update(intent.id, { status: "failed", lastError: error instanceof Error ? error.message : "Chưa rõ kết quả giao dịch." }).catch(() => undefined);
        setPaying(false);
        toast.info("Yêu cầu bán đã được lưu trên thiết bị. Hãy đồng bộ hoặc thử lại trước khi tạo giao dịch mới.");
        refreshOffline();
      } else {
        if (intent) await getOfflineQueue().remove(intent.id).catch(() => undefined);
        if (error instanceof Error && /tồn|không đủ/i.test(error.message)) {
          await retailProductsApi.list(scope, { q, limit: 500 }).then((data) => setProducts(data.items)).catch(() => undefined);
        }
        if (savedId && !draft) await retailOrdersApi.cancel(scope, savedId, { reason: "Tự động hủy draft sau khi thanh toán thất bại." }).catch(() => {});
        show(error);
      }
    } finally {
      setBusy(false);
    }
  };
  const openTransferPayment = async (order: RetailOrder, invoice?: RetailInvoice) => {
    const settled = order.pendingTransferAmount === 0 || order.paymentStatus === "paid" || order.dueAmount <= 0;
    setTransferPayment({ order, invoice, qr: null, loading: !settled, settled });
    setCompleted(null);
    dispatch({ type: "reset", taxRate: defaultTaxRate.current });
    setRetailPartnerId("");
    setDraft(null);
    setPaying(false);
    refreshDrafts();
    if (settled) return;
    try {
      const qr = await retailOrdersApi.paymentQr(scope, order._id);
      setTransferPayment((current) => current?.order._id === order._id
        ? { ...current, qr, loading: false, error: undefined }
        : current);
    } catch (error) {
      setTransferPayment((current) => current?.order._id === order._id
        ? { ...current, loading: false, error: error instanceof Error ? error.message : "Không tạo được QR thanh toán." }
        : current);
    }
  };
  const finish = (result: RetailOrderResult) => {
    dispatch({ type: "reset", taxRate: defaultTaxRate.current });
    setRetailPartnerId("");
    setCompleted(result);
    setDraft(null);
    setPaying(false);
    refreshDrafts();
  };
  const newOrder = () => {
    dispatch({ type: "reset", taxRate: defaultTaxRate.current });
    setRetailPartnerId("");
    setCompleted(null);
    setTransferPayment(null);
    setDraft(null);
  };
  const syncOffline = async (activeScope: OfflineScope) => {
    const queue = getOfflineQueue();
    const results = await withRetailCheckoutLock(activeScope, async () => {
      const before = await queue.list(activeScope);
      const synced = await syncRetailOfflineQueue(queue, activeScope, {
        check: (key) => retailOrdersApi.idempotency(activeScope, key),
        send: async (item) => {
          const attempt = await retailOrdersApi.idempotency(activeScope, item.idempotencyKey);
          if (attempt?.status === "completed" && attempt.order && attempt.invoice) return { order: attempt.order, invoice: attempt.invoice };
          if (attempt?.status === "processing") throw new Error("Giao dịch đang được máy chủ xử lý. Hãy đợi rồi đồng bộ lại.");
          const payload = item.payload as any;
          const saved = payload.intentType === "checkout"
            ? payload.draftSaved && payload.draftId
              ? { _id: payload.draftId, version: payload.draftVersion }
              : payload.updateExistingDraft && payload.draftId
                ? await retailOrdersApi.updateDraft(activeScope, payload.draftId, { ...payload.input, version: payload.draftVersion, idempotencyKey: item.idempotencyKey })
                : await retailOrdersApi.createDraft(activeScope, { ...payload.input, idempotencyKey: item.idempotencyKey })
            : payload.draftId
              ? await retailOrdersApi.detail(activeScope, payload.draftId)
              : await retailOrdersApi.createDraft(activeScope, { ...payload.input, idempotencyKey: item.idempotencyKey });
          if (payload.intentType === "checkout" && !payload.draftSaved) {
            const nextPayload = { ...payload, draftId: saved._id, draftVersion: saved.version, draftSaved: true };
            await queue.update(item.id, { payload: nextPayload });
          }
          return retailOrdersApi.confirm(activeScope, saved._id, {
            expectedVersion: saved.version,
            expectedGrandTotal: payload.expectedGrandTotal,
            pendingTransfer: payload.pendingTransfer === true,
            pendingTransferAmount: payload.pendingTransferAmount,
            posSessionId: payload.posSessionId,
            terminalId: payload.terminalId,
            payments: payload.payments || [],
            idempotencyKey: item.idempotencyKey,
          });
        },
      });
      for (const result of synced) {
        if (result.status !== "synced") continue;
        const item = before.find((entry) => entry.id === result.itemId);
        const payload = item?.payload as any;
        if (payload?.intentType !== "checkout") continue;
        const expectedInput = { ...payload.input };
        delete expectedInput.dueDate;
        const currentInput = { ...buildRetailOrderInput(cart), retailPartnerId: retailPartnerId || undefined };
        if (JSON.stringify(canonicalValue(expectedInput)) !== JSON.stringify(canonicalValue(currentInput))) continue;
        const attempt = await retailOrdersApi.idempotency(activeScope, item.idempotencyKey).catch(() => null);
        if (attempt?.status !== "completed" || !attempt.order || !attempt.invoice) continue;
        if (payload.pendingTransfer && attempt.order.dueAmount > 0) await openTransferPayment(attempt.order, attempt.invoice);
        else finish({ order: attempt.order, invoice: attempt.invoice });
        break;
      }
      return synced;
    });
    void refreshOffline();
    return results;
  };
  const retryTransferQr = async () => {
    if (!transferPayment) return;
    const orderId = transferPayment.order._id;
    setTransferPayment((current) => current?.order._id === orderId ? { ...current, loading: true, error: undefined } : current);
    try {
      const qr = await retailOrdersApi.paymentQr(scope, orderId);
      setTransferPayment((current) => current?.order._id === orderId ? { ...current, qr, loading: false, error: undefined } : current);
    } catch (error) {
      setTransferPayment((current) => current?.order._id === orderId
        ? { ...current, loading: false, error: error instanceof Error ? error.message : "Không tạo được QR thanh toán." }
        : current);
    }
  };

  return (
    <section className="fixed inset-0 z-50 flex h-dvh min-h-0 flex-col overflow-hidden bg-surface text-on-surface" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <HidScannerListener onScan={(value) => void scan(value)} />
      {offlineScope && <OnlineRetailSync scope={offlineScope} sync={syncOffline} ready={recoveryKey === recoveryReadyKey} />}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-lowest px-3 py-2 sm:px-5">
        <button type="button" onClick={() => { setCloseShiftError(""); setCloseShiftOpen(true); }} className="flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary"><Lock className="size-4" aria-hidden="true" />Đóng phiên</button>
        <label className="relative order-last w-full min-w-0 sm:order-none sm:mx-auto sm:max-w-2xl sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 size-5 text-on-surface-variant" aria-hidden="true" />
          <input ref={searchRef} autoFocus aria-label="Tìm hoặc quét sản phẩm" className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-10 pr-20 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" placeholder="Tìm tên, SKU, IMEI hoặc mã vạch" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const product = displayProducts[0]; if (product) addProductToCart(product, true); }} />
          <button type="button" aria-label="Quét camera hoặc mã vạch" onClick={() => setScanning(true)} className="absolute right-2 top-1 flex size-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Camera className="size-4" aria-hidden="true" /></button>
        </label>
        <span className="hidden max-w-48 truncate text-sm font-medium text-on-surface-variant lg:flex lg:items-center lg:gap-1"><User className="size-4 shrink-0" aria-hidden="true" />{userProfile?.displayName || userProfile?.email || "Thu ngân"}<span className="rounded-full bg-surface px-2 py-1 text-xs text-primary">{branchName || scope.branchId}</span></span>
        <button type="button" aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"} aria-pressed={fullscreen} onClick={() => void toggleFullscreen()} className="flex size-11 items-center justify-center rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">{fullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}</button>
        <button type="button" aria-label="Phím tắt" onClick={() => setHelp(true)} className="hidden size-11 items-center justify-center rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary sm:flex"><Keyboard className="size-4" aria-hidden="true" /></button>
        <button type="button" aria-label="Làm mới sản phẩm" onClick={() => void retailProductsApi.list(scope, { q, limit: 500 }).then((result) => { setProducts(result.items); if (result.categories?.length) setOfficialCategories(result.categories); }).catch(show)} className="flex size-11 items-center justify-center rounded-xl border border-outline-variant bg-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><RefreshCw className="size-4" aria-hidden="true" /></button>
        <button type="button" aria-pressed={mobileCartOpen} onClick={() => setMobileCartOpen((value) => !value)} className="flex min-h-11 items-center gap-1 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary lg:hidden"><ShoppingCart className="size-4" aria-hidden="true" />{mobileCartOpen ? "Sản phẩm" : `Giỏ (${cart.lines.length})`}</button>
        {onLeavePos && canLeavePos && <button type="button" onClick={() => leavePos(onLeavePos)} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-semibold hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Màn quản lý</button>}
        {onPrinterSettings && <button type="button" onClick={() => leavePos(onPrinterSettings)} className="flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-semibold hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Printer className="size-4" aria-hidden="true" />Cài đặt máy in</button>}
        {logout && <button type="button" disabled={busy} onClick={() => leavePos(() => void signOut())} className="min-h-11 rounded-xl border border-outline-variant bg-surface px-3 text-sm font-semibold hover:bg-surface-container-low disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Đăng xuất</button>}
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_450px]">
      <main className={cn("min-h-0 flex-col overflow-hidden bg-surface lg:flex", mobileCartOpen ? "hidden" : "flex")}>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3"><div><h1 className="text-balance text-lg font-bold">{categoryTitle}</h1><p className="text-xs text-on-surface-variant">{shift?.shiftCode} · {shift?.businessDate}{shift?.pausedAt ? " · Đang tạm dừng" : ""}</p></div><span className="shrink-0 rounded-full bg-surface-container-low px-2 py-1 text-xs font-semibold tabular-nums text-on-surface-variant">{displayProducts.length} món</span></div>
        <HeldDraftsBar
          drafts={drafts}
          activeId={draft?._id}
          onOpen={openDraft}
        />
        {!offlineReady && <p role="status" className="text-sm text-on-surface-variant">Đang kiểm tra bộ lưu giao dịch an toàn…</p>}
        {offlineStorageError && <p role="alert" className="rounded-xl border border-error/40 bg-error-container p-3 text-sm text-on-error-container">{offlineStorageError} Thanh toán đang tạm khóa để tránh mất hoặc tạo trùng đơn.</p>}
        {recoveryError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/40 bg-error-container p-3 text-sm text-on-error-container">
            <p>{recoveryError}</p>
            {recoveryBlocked && recoveryKey && <button type="button" className="min-h-10 rounded-lg border border-error/40 px-3 font-semibold focus-visible:outline-2 focus-visible:outline-primary" onClick={() => {
              try {
                discardPosCart(recoveryKey);
                dispatch({ type: "reset", taxRate: defaultTaxRate.current });
                setRecoveryBlocked(false);
                setRecoveryError("");
                setRecoveryReadyKey(recoveryKey);
              } catch {
                setRecoveryError("Không xóa được bản lưu lỗi trên thiết bị này.");
              }
            }}>Xóa bản lưu lỗi</button>}
          </div>
        )}
        {recoveryMessage && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface"><p>{recoveryMessage}</p><button type="button" aria-label="Ẩn thông báo khôi phục giỏ" onClick={() => setRecoveryMessage("")} className="min-h-10 rounded-lg px-3 font-semibold focus-visible:outline-2 focus-visible:outline-primary">Đã hiểu</button></div>}
        {scanFeedback && <ScanFeedback {...scanFeedback} />}
        {officialCategories.length > 0 && (
          <section aria-label="Danh mục sản phẩm" className="space-y-2">
            {selectedCategory && <nav aria-label="Đường dẫn danh mục" className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant">
              <button type="button" aria-current={!selectedCategory ? "page" : undefined} onClick={() => chooseCategory("")} className="min-h-9 rounded-lg px-2 font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">Tất cả</button>
              {categoryPath.map((category, index) => (
                <React.Fragment key={category.code}><ChevronRight className="size-3" aria-hidden="true" /><button type="button" aria-current={index === categoryPath.length - 1 ? "page" : undefined} onClick={() => chooseCategory(category.code)} className="min-h-9 rounded-lg px-2 font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{category.name}</button></React.Fragment>
              ))}
            </nav>}
            {level2Categories.length > 0 && <div role="group" aria-label="Danh mục mức 2" className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" aria-pressed={categoryPath.length === 1} onClick={() => chooseCategory(categoryPath[0].code)} className={cn("min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", categoryPath.length === 1 ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low")}>Tất cả</button>
              {level2Categories.map((category) => <button key={category.code} type="button" aria-pressed={categoryPath[1]?.code === category.code} onClick={() => chooseCategory(category.code)} className={cn("min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", categoryPath[1]?.code === category.code ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low")}>{category.name}</button>)}
            </div>}
            {level3Categories.length > 0 && <div role="group" aria-label="Danh mục mức 3" className="flex gap-2 overflow-x-auto pb-1">
              <button type="button" aria-pressed={categoryPath.length === 2} onClick={() => chooseCategory(categoryPath[1].code)} className={cn("min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", categoryPath.length === 2 ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low")}>Tất cả</button>
              {level3Categories.map((category) => <button key={category.code} type="button" aria-pressed={categoryPath[2]?.code === category.code} onClick={() => chooseCategory(category.code)} className={cn("min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", categoryPath[2]?.code === category.code ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low")}>{category.name}</button>)}
            </div>}
          </section>
        )}
        {brandOptions.length > 0 && level2Categories.length === 0 && <div role="group" aria-label="Lọc theo hãng" className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" aria-pressed={!selectedBrand} onClick={() => setSelectedBrand("")} className={cn("min-h-9 shrink-0 rounded-xl border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", !selectedBrand ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low")}>Tất cả hãng</button>
          {brandOptions.map((brand) => <button key={brand} type="button" aria-pressed={selectedBrand === brand} onClick={() => setSelectedBrand(brand)} className={cn("min-h-9 shrink-0 rounded-xl border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary", selectedBrand === brand ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low")}>{brand}</button>)}
        </div>}
        <ProductGrid
          products={displayProducts}
          onAdd={addProductToCart}
          categories={officialCategories}
          showFolders={!selectedCategory && !selectedBrand && !q.trim()}
        />
        </div>
        <nav aria-label="Danh mục chính" className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-3 py-2 sm:px-5"><div className="flex gap-2 overflow-x-auto">
          <button type="button" aria-current={!currentRoot ? "page" : undefined} onClick={() => chooseCategory("")} className={cn("min-h-11 min-w-24 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", !currentRoot ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low")}>Tất cả</button>
          {topCategories.map((category) => <button key={category.code} type="button" aria-current={currentRoot === category.code ? "page" : undefined} onClick={() => chooseCategory(category.code)} className={cn("min-h-11 min-w-24 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary", currentRoot === category.code ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low")}>{category.name}</button>)}
        </div></nav>
      </main>
      <div className={cn("min-h-0 overflow-hidden lg:block", mobileCartOpen ? "block" : "hidden")}><CartPanel
        scope={scope}
        cart={cart}
        billingProfiles={billingProfiles}
        retailPartnerId={retailPartnerId}
        onRetailPartnerIdChange={setRetailPartnerId}
        showCollaborator={Boolean(userProfile?.enabledModules?.includes("retail-partner"))}
        busy={busy}
        canPay={Boolean(shift && !shift.pausedAt && offlineReady && !offlineStorageError && !hasPendingOffline && !recoveryBlocked)}
        dispatch={dispatchCartAction}
        onHold={saveDraft}
        onPay={openPayment}
      /></div>
      </div>
      <RetailOfflineQueuePanel items={offlineItems} onRetry={(id) => void getOfflineQueue().update(id, { status: "pending", lastError: undefined }).then(() => offlineScope && syncOffline(offlineScope)).catch(show)} />
      <ConfirmDialog isOpen={Boolean(pendingLeave)} title="Rời quầy bán hàng?" description="Giỏ hàng hiện tại sẽ được lưu trên thiết bị này để tiếp tục khi mở lại quầy." confirmLabel="Rời quầy" cancelLabel="Tiếp tục bán" tone="warning" onClose={() => setPendingLeave(null)} onConfirm={() => { const action = pendingLeave; setPendingLeave(null); action?.(); }} />
      <dialog ref={closeShiftDialogRef} aria-labelledby="pos-close-shift-title" onClose={() => setCloseShiftOpen(false)} className="m-auto max-h-dvh w-11/12 max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-lg backdrop:bg-on-surface/60">
        <h2 id="pos-close-shift-title" className="text-balance text-lg font-bold">Kiểm đếm và đóng ca</h2>
        <p className="mt-2 text-pretty text-sm text-on-surface-variant">Nhập tiền mặt thực đếm để hệ thống đối chiếu và đóng ca.</p>
        {cart.lines.length > 0 && <p className="mt-3 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface">Giỏ hiện tại sẽ được lưu trên thiết bị để tiếp tục sau.</p>}
        <label className="mt-4 block text-sm font-semibold">Tiền thực đếm<input autoFocus type="number" inputMode="numeric" min="0" step="1" required value={countedCash} onChange={(event) => { setCountedCash(event.target.value); setCloseShiftError(""); }} aria-invalid={Boolean(closeShiftError)} aria-describedby={closeShiftError ? "pos-close-shift-error" : undefined} className="mt-1 min-h-11 w-full rounded-xl border border-outline bg-surface px-3 tabular-nums focus-visible:outline-2 focus-visible:outline-primary" /></label>
        <label className="mt-3 block text-sm font-semibold">Lý do chênh lệch (nếu có)<input value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-outline bg-surface px-3 focus-visible:outline-2 focus-visible:outline-primary" /></label>
        {closeShiftError && <p id="pos-close-shift-error" role="alert" className="mt-3 text-sm text-error">{closeShiftError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setCloseShiftOpen(false)} className="min-h-11 rounded-xl border border-outline px-4 font-semibold focus-visible:outline-2 focus-visible:outline-primary">Hủy</button><button type="button" disabled={busy} onClick={() => void closeShift()} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">{busy ? "Đang đóng…" : "Gửi kiểm đếm và đóng ca"}</button></div>
      </dialog>
      {paying && cart.quote && (
        <PaymentDialog
          total={cart.quote.grandTotal}
          installment={cart.installment}
          busy={busy}
          customerId={cart.customer?._id}
          onClose={() => setPaying(false)}
          transferAsPending
          onSubmit={checkout}
        />
      )}
      {scanning && (
        <BarcodeScannerDialog
          onScan={(value) => void scan(value)}
          onClose={() => setScanning(false)}
        />
      )}
      {transferPayment && (
        <PosTransferPaymentDialog
          transfer={transferPayment}
          onClose={() => setTransferPayment(null)}
          onNewOrder={newOrder}
          onRetry={() => void retryTransferQr()}
        />
      )}
      {completed && (
        <CheckoutSuccessDialog
          result={completed}
          paperSize={invoicePaperSize}
          onNewOrder={newOrder}
          onClose={() => setCompleted(null)}
        />
      )}
      {help && <PosShortcutHelp onClose={() => setHelp(false)} />}
      {unitSelection && (
        <RetailAddSerialDialog
          product={unitSelection}
          unavailable={cart.lines.find((line) => line.product._id === unitSelection._id)?.[unitSelection.trackingMode === "serial" ? "serialNumbers" : "internalBarcodes"] || []}
          onClose={() => setUnitSelection(null)}
          onConfirm={(value) => {
            const selectedProduct = unitSelection;
            const line = cart.lines.find((item) => item.product._id === selectedProduct._id);
            const previous = selectedProduct.trackingMode === "serial" ? line?.serialNumbers || [] : line?.internalBarcodes || [];
            dispatch({ type: "add", product: selectedProduct });
            dispatch(selectedProduct.trackingMode === "serial"
              ? { type: "serials", productId: selectedProduct._id, serialNumbers: [...previous, value] }
              : { type: "internalBarcodes", productId: selectedProduct._id, internalBarcodes: [...previous, value] });
            setUnitSelection(null);
          }}
        />
      )}
    </section>
  );
}

function PosTransferPaymentDialog({
  transfer,
  onClose,
  onNewOrder,
  onRetry,
}: {
  transfer: PendingTransferPayment;
  onClose: () => void;
  onNewOrder: () => void;
  onRetry: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  const amount = transfer.qr?.amount ?? transfer.order.dueAmount;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="pos-transfer-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-2xl backdrop:bg-on-surface/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {transfer.settled
            ? <CheckCircle2 className="mb-2 size-9 text-primary" />
            : <QrCode className="mb-2 size-9 text-primary" />}
          <h2 id="pos-transfer-title" className="text-balance text-xl font-bold">
            {transfer.settled ? "Đã xác nhận thanh toán" : "Chờ thanh toán QR"}
          </h2>
          <p className="text-sm text-on-surface-variant">{transfer.order.orderCode}</p>
        </div>
        <button type="button" aria-label="Đóng QR thanh toán" onClick={onClose}><X /></button>
      </div>

      {transfer.settled ? (
        <p role="status" className="mt-5 rounded-xl bg-primary-container p-4 text-pretty text-sm text-on-primary-container">
          SePay đã xác nhận tiền vào tài khoản doanh nghiệp.
        </p>
      ) : (
        <>
          {transfer.loading && (
            <div role="status" className="mt-5 flex items-center justify-center gap-2 py-5 text-sm text-on-surface-variant">
              <Loader2 className="h-5 w-5" />Đang tải QR thanh toán...
            </div>
          )}
          {transfer.qr && (
            <>
              <img
                className="mx-auto mt-4 w-full max-w-[280px] rounded-2xl border"
                src={transfer.qr.qrUrl}
                alt={"QR chuyển khoản đơn " + transfer.order.orderCode}
              />
              <p className="mt-3 text-center text-xl font-bold tabular-nums text-primary">{money(amount)}</p>
              <p className="mt-1 text-center text-sm">Nội dung chuyển khoản: <b>{transfer.qr.paymentCode}</b></p>
              <p className="mt-1 text-center text-xs text-on-surface-variant">
                {transfer.qr.accountName} · {transfer.qr.accountNumber} · {transfer.qr.bankId}
              </p>
            </>
          )}
          {transfer.error && (
            <div className="mt-4 rounded-xl bg-tertiary-container p-3 text-sm text-on-tertiary-container">
              <p role="alert">{transfer.error}</p>
              <button type="button" className="mt-2 min-h-10 rounded-lg border border-tertiary/40 px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-primary" onClick={onRetry}>
                Tạo lại QR
              </button>
            </div>
          )}
          {!transfer.loading && !transfer.error && (
            <p role="status" className="mt-4 rounded-xl bg-primary-container p-3 text-pretty text-sm text-on-primary-container">
              Đơn chỉ được đánh dấu đã thanh toán sau khi SePay gửi xác nhận webhook.
            </p>
          )}
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="min-h-11 rounded-xl border border-outline px-3 py-3 font-bold focus-visible:outline-2 focus-visible:outline-primary" onClick={onClose}>Đóng</button>
        <button type="button" className="min-h-11 rounded-xl bg-primary px-3 py-3 font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-primary" onClick={onNewOrder}>Đơn mới</button>
      </div>
    </dialog>
  );
}

type ProductGroup = { key: string; name: string; variants: RetailProduct[] };

function groupProductsBySku(products: RetailProduct[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  for (const product of products) {
    const key = product.productId || product._id;
    const suffix = product.variantName ? ` - ${product.variantName}` : "";
    const baseName = suffix && product.name.endsWith(suffix) ? product.name.slice(0, -suffix.length) : product.name;
    const existing = groups.get(key);
    if (existing) existing.variants.push(product);
    else groups.set(key, { key, name: baseName, variants: [product] });
  }
  return Array.from(groups.values());
}

function ProductCard({
  group,
  onAdd,
}: {
  group: ProductGroup;
  onAdd: (product: RetailProduct) => void;
}) {
  const defaultId = (group.variants.find((variant) => variant.stock > 0) || group.variants[0])._id;
  const [selectedId, setSelectedId] = React.useState(defaultId);
  const [open, setOpen] = React.useState(false);
  const [failedImageUrl, setFailedImageUrl] = React.useState<string | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => { const dialog = dialogRef.current; if (!dialog) return; if (open && !dialog.open) { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); } if (!open && dialog.open) { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); } }, [open]);
  React.useEffect(() => {
    if (!group.variants.some((variant) => variant._id === selectedId)) setSelectedId(defaultId);
  }, [group.variants, selectedId, defaultId]);
  const selected = group.variants.find((variant) => variant._id === selectedId) || group.variants[0];
  const totalStock = group.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
  return (
    <div className="group rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-sm hover:border-primary">
      <button
        type="button"
        className="w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => group.variants.length > 1 ? setOpen(true) : onAdd(selected)}
      >
        <span className="relative mb-2 flex h-24 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-surface sm:h-28">
          {selected.imageUrl && selected.imageUrl !== failedImageUrl ? <img src={selected.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-2" onError={() => setFailedImageUrl(selected.imageUrl!)} /> : /điện thoại|phone|iphone|galaxy|xiaomi|oppo|samsung/i.test(`${group.name} ${selected.category}`) ? <Smartphone className="size-8 text-on-surface-variant" aria-hidden="true" /> : /tablet|ipad|máy tính bảng/i.test(`${group.name} ${selected.category}`) ? <Tablet className="size-8 text-on-surface-variant" aria-hidden="true" /> : /tai nghe|airpods|headphone|sạc|cáp|ốp/i.test(`${group.name} ${selected.category}`) ? <Headphones className="size-8 text-on-surface-variant" aria-hidden="true" /> : <Package className="size-8 text-on-surface-variant" aria-hidden="true" />}
          {selected.stock <= 0 ? <span className="absolute right-2 top-2 rounded-full bg-error-container px-2 py-1 text-xs font-semibold text-on-error-container">Hết hàng</span> : selected.stock <= 2 ? <span className="absolute right-2 top-2 rounded-full bg-tertiary-container px-2 py-1 text-xs font-semibold text-on-tertiary-container">Tồn: {selected.stock}</span> : null}
        </span>
        <span className="block truncate text-sm font-bold" title={group.name}>{group.name}</span>
        <span className="block text-xs text-on-surface-variant">
          {selected.sku} · Tồn {Math.max(0, selected.stock)}
        </span>
        <span className="mt-2 block font-bold tabular-nums text-primary">{money(selected.price)}</span>
      </button>
      {group.variants.length > 1 && (
        <div className="mt-3">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`Chọn SKU cho ${group.name}`}
            onClick={() => setOpen(true)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2 text-left text-sm text-on-surface transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-on-surface">
                {selected.variantName || selected.sku}
              </span>
              <span className="block text-[11px] text-on-surface-variant">
                {group.variants.length} SKU · Tồn tổng {totalStock}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
          </button>
          <dialog ref={dialogRef} onClose={() => setOpen(false)} aria-label={`Chọn phiên bản ${group.name}`} className="m-auto max-h-dvh w-11/12 max-w-lg rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface shadow-lg backdrop:bg-on-surface/40">
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-balance text-lg font-bold">Chọn phiên bản {group.name}</h2><button type="button" aria-label="Đóng chọn phiên bản" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-lg hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden="true" /></button></div>
              <ul className="max-h-96 space-y-2 overflow-y-auto">
                {group.variants.map((variant) => {
                  const soldOut = variant.stock <= 0;
                  return (
                    <li key={variant._id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(variant._id);
                          setOpen(false);
                          onAdd(variant);
                        }}
                        aria-label={`${variant.variantName || variant.sku}, ${soldOut ? "hết hàng" : `tồn ${variant.stock}`}`}
                        className={cn("flex min-h-11 w-full items-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-left text-sm text-on-surface hover:border-primary focus-visible:outline-2 focus-visible:outline-primary", soldOut && "opacity-70")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-on-surface">
                            {variant.variantName || variant.sku}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-on-surface-variant">
                            {variant.sku}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-semibold text-primary">
                            {money(variant.price)}
                          </span>
                          <span
                            className="block text-[11px] text-on-surface-variant"
                          >
                            {soldOut ? "Hết tồn" : `Tồn ${variant.stock}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
          </dialog>
        </div>
      )}
    </div>
  );
}

function ProductGrid({
  products,
  onAdd,
  categories = [],
  showFolders = false,
}: {
  products: RetailProduct[];
  onAdd: (product: RetailProduct) => void;
  categories?: RetailOfficialCategory[];
  showFolders?: boolean;
}) {
  const groups = React.useMemo(() => groupProductsBySku(products), [products]);
  const folders = React.useMemo(() => {
    if (!showFolders || !categories.length) return null;
    const roots: ProductFolder[] = [];
    const byCode = new Map(categories.map((category) => [category.code, category]));
    for (const group of groups) {
      const code = group.variants[0].category;
      const path: RetailOfficialCategory[] = [];
      const seen = new Set<string>();
      let current = byCode.get(code);
      while (current && !seen.has(current.code)) {
        seen.add(current.code);
        path.unshift(current);
        current = current.parentCode ? byCode.get(current.parentCode) : undefined;
      }
      if (!path.length) path.push({ code: code || "uncategorized", name: code || "Chưa phân loại" });
      let siblings = roots;
      let folder: ProductFolder | undefined;
      for (const category of path) {
        folder = siblings.find((item) => item.code === category.code);
        if (!folder) { folder = { code: category.code, name: category.name, count: 0, groups: [], children: [] }; siblings.push(folder); }
        folder.count += 1;
        siblings = folder.children;
      }
      folder?.groups.push(group);
    }
    return roots;
  }, [categories, groups, showFolders]);
  if (!groups.length) return <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest p-5 text-center"><Package className="size-8 text-on-surface-variant" aria-hidden="true" /><p className="mt-2 text-pretty text-sm font-medium">Không tìm thấy sản phẩm nào.</p><p className="text-pretty text-xs text-on-surface-variant">Thử từ khóa khác hoặc quét mã vạch.</p></div>;
  if (folders) return <div aria-label="Thư mục sản phẩm" className="space-y-3">{folders.map((folder) => <ProductFolderBranch key={folder.code} folder={folder} onAdd={onAdd} />)}</div>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {groups.map((group) => (
        <ProductCard key={group.key} group={group} onAdd={onAdd} />
      ))}
    </div>
  );
}

type ProductFolder = { code: string; name: string; count: number; groups: ProductGroup[]; children: ProductFolder[] };

function ProductFolderBranch({ folder, onAdd, depth = 1 }: { folder: ProductFolder; onAdd: (product: RetailProduct) => void; depth?: number }) {
  return <details className={cn("group/folder min-w-0 border border-outline-variant bg-surface-container-lowest open:pb-3", depth === 1 ? "rounded-2xl" : depth === 2 ? "rounded-xl" : "rounded-lg border-l-2 border-l-primary")}>
    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 text-left focus-visible:outline-2 focus-visible:outline-primary sm:px-4">
      <span className={cn("flex shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container", depth === 1 ? "size-10" : "size-8")}><Folder className="size-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{folder.name}</span>{depth === 1 && <span className="block text-xs text-on-surface-variant">Danh mục chính · {folder.count} sản phẩm</span>}</span>
      <span className="shrink-0 rounded-full bg-surface-container-low px-2 py-1 text-xs tabular-nums text-on-surface-variant">{folder.count} sản phẩm</span>
      <ChevronDown className="size-4 shrink-0 text-on-surface-variant group-open/folder:rotate-180" aria-hidden="true" />
    </summary>
    <div className="space-y-3 border-t border-outline-variant bg-surface-container-low p-3 sm:p-4">
      {folder.groups.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{folder.groups.map((group) => <ProductCard key={group.key} group={group} onAdd={onAdd} />)}</div>}
      {folder.children.map((child) => <ProductFolderBranch key={child.code} folder={child} onAdd={onAdd} depth={depth + 1} />)}
    </div>
  </details>;
}

function HidScannerListener({ onScan }: { onScan(value: string): void }) {
  const callback = React.useRef(onScan);
  callback.current = onScan;
  React.useEffect(() => {
    const scanner = createHidScannerBuffer({
      timeoutMs: 50,
      minLength: 3,
      onScan: (value) => callback.current(value),
    });
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        scanner.keydown(event);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
}

function OnlineRetailSync({ scope, sync, ready }: { scope: OfflineScope; sync(scope: OfflineScope): Promise<unknown>; ready: boolean }) { const callback = React.useRef(sync); callback.current = sync; React.useEffect(() => { if (!ready) return; const run = () => void callback.current(scope).catch(() => undefined); window.addEventListener("online", run); if (navigator.onLine) run(); return () => window.removeEventListener("online", run); }, [scope.companyCode, scope.branchId, scope.userId, ready]); return null; }

function CartPanel({
  scope,
  cart,
  billingProfiles,
  retailPartnerId,
  onRetailPartnerIdChange,
  showCollaborator,
  busy,
  canPay,
  dispatch,
  onHold,
  onPay,
}: {
  scope: RetailScope;
  cart: RetailCartState;
  billingProfiles: any[];
  retailPartnerId: string;
  onRetailPartnerIdChange: (value: string) => void;
  showCollaborator: boolean;
  busy: boolean;
  canPay: boolean;
  dispatch: React.Dispatch<any>;
  onHold: () => Promise<void>;
  onPay: () => void;
}) {
  const currentInstallmentError = installmentError(cart.installment);
  const [cartAction, setCartAction] = React.useState<"discount" | "collaborator" | "note" | "installment" | null>(null);
  const actionDialogRef = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const dialog = actionDialogRef.current;
    if (cartAction && dialog && !dialog.open) dialog.showModal();
  }, [cartAction]);
  const closeAction = () => { actionDialogRef.current?.close(); setCartAction(null); };
  const actionTitle = cartAction === "discount" ? "Giảm giá và ưu đãi" : cartAction === "collaborator" ? "Người giới thiệu" : cartAction === "note" ? "Ghi chú đơn hàng" : "Trả góp";
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l border-outline-variant bg-surface-container-lowest p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <ShoppingCart className="h-5 w-5" />
        Giỏ hàng ({cart.lines.reduce((sum, line) => sum + line.quantity, 0)})
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      <div className="mt-3">
        <CustomerPicker
          scope={scope}
          value={cart.customer}
          onChange={(customer) => dispatch({ type: "customer", customer })}
        />
        {cart.customer?.type === "vat" && (
          <div className="mt-3 space-y-2 rounded-xl border border-tertiary/40 bg-tertiary-container p-3 text-on-tertiary-container">
            <p className="text-sm font-semibold">Hóa đơn VAT</p>
            <select
              aria-label="Hồ sơ VAT"
              value={cart.billingProfile?._id || ""}
              onChange={(event) => dispatch({ type: "billingProfile", billingProfile: billingProfiles.find((item) => item._id === event.target.value) || null })}
              className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
            >
              <option value="">Chọn hồ sơ xuất VAT</option>
              {billingProfiles.map((profile) => (
                <option key={profile._id} value={profile._id}>{profile.legalName} - {profile.taxId}</option>
              ))}
            </select>
            {!billingProfiles.length && <p className="text-pretty text-xs">Khách này chưa có hồ sơ VAT đang hoạt động.</p>}
          </div>
        )}
      </div>
      <div className="my-4 min-h-32 space-y-2">
        {!cart.lines.length && <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-outline-variant p-4 text-center text-sm text-on-surface-variant">Chưa có sản phẩm nào trong giỏ hàng</div>}
        {cart.lines.map((line) => (
          <div key={line.product._id} className="space-y-2 rounded-xl border border-outline-variant bg-surface p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{line.product.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {money(line.product.price)}
                </p>
              </div>
              <QuantityInput
                ariaLabel={`Số lượng ${line.product.name}`}
                value={line.quantity}
                onQuantityChange={(quantity) =>
                  dispatch({ type: "quantity", productId: line.product._id, quantity })
                }
              />
              <button
                type="button"
                aria-label={`Xóa ${line.product.name}`}
                onClick={() =>
                  dispatch({ type: "remove", productId: line.product._id })
                }
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-on-error-container focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <DiscountInput
              label={`Giảm giá ${line.product.name}`}
              value={line.discount}
              onChange={(discount) =>
                dispatch({
                  type: "lineDiscount",
                  productId: line.product._id,
                  discount,
                })
              }
            />
            {line.product.trackingMode === "serial" && <SerialPicker productId={line.product.productId || line.product._id} variantId={line.product.variantId} quantity={line.quantity} value={line.serialNumbers || []} onChange={(serialNumbers) => dispatch({ type: "serials", productId: line.product._id, serialNumbers })} />}
            {line.product.trackingMode === "unit_barcode" && <UnitBarcodePicker productId={line.product._id} variantId={line.product.variantId} quantity={line.quantity} value={line.internalBarcodes || []} onChange={(internalBarcodes) => dispatch({ type: "internalBarcodes", productId: line.product._id, internalBarcodes })} />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-outline-variant pt-3">
        <button type="button" aria-haspopup="dialog" aria-expanded={cartAction === "discount"} aria-controls="pos-cart-action-dialog" onClick={() => setCartAction("discount")} className="min-h-11 rounded-xl border border-outline px-3 text-sm font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Giảm giá{cart.couponCode ? ` · ${cart.couponCode}` : ""}</button>
        {showCollaborator && <button type="button" aria-haspopup="dialog" aria-expanded={cartAction === "collaborator"} aria-controls="pos-cart-action-dialog" onClick={() => setCartAction("collaborator")} className="min-h-11 rounded-xl border border-outline px-3 text-sm font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Người giới thiệu{retailPartnerId ? " · Đã chọn" : ""}</button>}
        <button type="button" aria-haspopup="dialog" aria-expanded={cartAction === "note"} aria-controls="pos-cart-action-dialog" onClick={() => setCartAction("note")} className="min-h-11 rounded-xl border border-outline px-3 text-sm font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Ghi chú{cart.note ? " · Đã nhập" : ""}</button>
        <button type="button" aria-haspopup="dialog" aria-expanded={cartAction === "installment"} aria-controls="pos-cart-action-dialog" onClick={() => setCartAction("installment")} className="min-h-11 rounded-xl border border-outline px-3 text-sm font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Trả góp{cart.installment ? ` · ${cart.installment.months} tháng` : ""}</button>
      </div>
      </div>
      <div className="border-t pt-4">
        {!cart.quoteDirty && Number(cart.quote?.couponDiscount || 0) > 0 && <div className="flex justify-between text-sm text-on-surface-variant"><span>Mã ưu đãi</span><span className="tabular-nums">−{money(Number(cart.quote?.couponDiscount))}</span></div>}
        {!cart.quoteDirty && Number(cart.quote?.pointsDiscount || 0) > 0 && <div className="flex justify-between text-sm text-on-surface-variant"><span>Điểm thưởng</span><span className="tabular-nums">−{money(Number(cart.quote?.pointsDiscount))}</span></div>}
        <div className="flex justify-between text-lg font-bold">
          <span>Tổng tiền</span>
          <span aria-live="polite" className="tabular-nums">{cart.quoteDirty ? "Đang tính lại..." : money(cart.quote?.grandTotal || 0)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            disabled={!cart.lines.length || busy || Boolean(currentInstallmentError)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-outline px-3 py-3 font-bold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => void onHold()}
          >
            <Pause className="h-4 w-4" />
            Treo đơn
          </button>
          <button
            disabled={!cart.lines.length || !cart.quote || cart.quoteDirty || !canPay || busy || Boolean(currentInstallmentError)}
            className="min-h-11 rounded-xl bg-primary px-3 py-3 font-bold text-on-primary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"
            onClick={onPay}
          >
            Thanh toán
          </button>
        </div>
      </div>
      {cartAction && <dialog id="pos-cart-action-dialog" ref={actionDialogRef} aria-labelledby="pos-cart-action-title" onClose={() => setCartAction(null)} className="m-auto max-h-dvh w-11/12 max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface backdrop:bg-on-surface/60">
        <div className="flex items-start justify-between gap-3"><h3 id="pos-cart-action-title" className="text-balance text-lg font-bold">{actionTitle}</h3><button type="button" aria-label="Đóng tùy chọn giỏ hàng" onClick={closeAction} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-outline focus-visible:outline-2 focus-visible:outline-primary"><X className="size-4" aria-hidden="true" /></button></div>
        <div className="mt-4 space-y-4">
          {cartAction === "discount" && <><OrderAdjustments orderDiscount={cart.orderDiscount} taxRate={cart.taxRate} shippingFee={cart.shippingFee} onChange={(value) => dispatch({ type: "orderAdjustments", ...value })} /><RetailCouponInput scope={scope} customerId={cart.customer?._id} value={cart.couponCode} onChange={(couponCode) => dispatch({ type: "coupon", couponCode })} /><RetailPointsInput scope={scope} customerId={cart.customer?._id} value={cart.pointsToRedeem} onChange={(pointsToRedeem) => dispatch({ type: "points", pointsToRedeem })} /></>}
          {cartAction === "collaborator" && showCollaborator && <RetailCollaboratorSelect scope={scope} value={retailPartnerId} onChange={onRetailPartnerIdChange} />}
          {cartAction === "note" && <label className="block text-sm font-semibold">Ghi chú đơn hàng<textarea maxLength={2000} value={cart.note || ""} onChange={(event) => dispatch({ type: "note", note: event.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" placeholder="Thông tin cần lưu cùng đơn hàng" /></label>}
          {cartAction === "installment" && <><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(cart.installment)} onChange={(event) => dispatch({ type: "installment", installment: event.target.checked ? { partner: "HD Saison", months: 6, prepayPercent: 20 } : null })} />Bán trả góp</label>{cart.installment && <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="col-span-2 font-semibold">Đối tác tài trợ<input value={cart.installment.partner} maxLength={100} onChange={(event) => dispatch({ type: "installment", installment: { ...cart.installment!, partner: event.target.value } })} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>
            <label className="font-semibold">Thời hạn (tháng)<input type="number" min={1} max={60} value={cart.installment.months} onChange={(event) => dispatch({ type: "installment", installment: { ...cart.installment!, months: Number(event.target.value) } })} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>
            <label className="font-semibold">Trả trước (%)<input type="number" min={0} max={100} value={cart.installment.prepayPercent} onChange={(event) => dispatch({ type: "installment", installment: { ...cart.installment!, prepayPercent: Number(event.target.value) } })} className="mt-1 min-h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>
            <p className="col-span-2 text-pretty text-xs text-on-surface-variant">Chọn khách hàng và ngày đối tác thanh toán nếu còn khoản tài trợ.</p>
            {currentInstallmentError && <p role="alert" className="col-span-2 text-pretty text-xs text-error">{currentInstallmentError}</p>}
          </div>}</>}
        </div>
        <div className="mt-5 flex justify-end"><button type="button" onClick={closeAction} className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary">Xong</button></div>
      </dialog>}
    </aside>
  );
}

function Notice() {
  return (
    <div className="rounded-2xl border border-tertiary/40 bg-tertiary-container p-5 text-on-tertiary-container">
      Vui lòng chọn chi nhánh.
    </div>
  );
}
