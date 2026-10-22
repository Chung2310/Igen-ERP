import React from "react";
import { Camera, Check, CheckCircle2, ChevronDown, Loader2, Pause, QrCode, Search, ShoppingCart, X } from "lucide-react";
import { customerApi } from "../../customer-management/customerApi";
import { ShiftScheduleNotice } from "../components/ShiftScheduleNotice";
import RetailShiftWorkspace from "./RetailShiftWorkspace";
import BarcodeScannerDialog from "../components/pos/BarcodeScannerDialog";
import CheckoutSuccessDialog from "../components/pos/CheckoutSuccessDialog";
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
import RetailCollaboratorSelect from "../components/pos/RetailCollaboratorSelect";
import RetailCouponInput from "../components/pos/RetailCouponInput";
import RetailPointsInput from "../components/pos/RetailPointsInput";
import { SerialPicker, UnitBarcodePicker } from "../components/pos/RetailUnitPickerDialog";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailProductsApi } from "../api/retailProducts.api";
import { retailShiftsApi } from "../api/retailShifts.api";
import {
  initialRetailCart,
  retailCartReducer,
  type RetailCartState,
} from "../hooks/retailCart";
import { buildRetailOrderInput } from "../hooks/retailOrderInput";
import { useRetailScope } from "../hooks/useRetailScope";
import { useRetailPosShortcuts } from "../hooks/useRetailPosShortcuts";
import { createHidScannerBuffer } from "../hooks/retailScannerInput";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import { companyPaymentApi } from "../../../services/companyPaymentService";
import { createIndexedDbRetailOfflineQueue, createMemoryRetailOfflineQueue, createRetailOfflineOrder, type OfflineScope, type RetailOfflineOrder } from "../offline/retailOfflineQueue";
import { isRetailNetworkFailure, syncRetailOfflineQueue } from "../offline/retailOfflineSync";
import type {
  RetailOrder,
  RetailOrderResult,
  RetailPaymentInput,
  RetailPaymentQr,
  RetailProduct,
  RetailScope,
  RetailShift,
} from "../types";
import { toast } from "../../../pages/Toast";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const qrPaymentMethods: RetailPaymentInput["method"][] = ["transfer", "ewallet"];

type PendingTransferPayment = {
  order: RetailOrder;
  qr: RetailPaymentQr | null;
  loading: boolean;
  error?: string;
  settled: boolean;
};

export default function RetailPosPage() {
  const { scope, userProfile } = useRetailScope();
  const [cart, dispatch] = React.useReducer(
    retailCartReducer,
    initialRetailCart,
  );
  const quoteRequestId = React.useRef(0);
  const [products, setProducts] = React.useState<RetailProduct[]>([]);
  const [drafts, setDrafts] = React.useState<RetailOrder[]>([]);
  const [draft, setDraft] = React.useState<RetailOrder | null>(null);
  const [retailPartnerId, setRetailPartnerId] = React.useState("");
  const [shift, setShift] = React.useState<RetailShift | null>(null);
  const [openingFloat, setOpeningFloat] = React.useState(0);
  const [terminalId, setTerminalId] = React.useState("");
  const [openingShift, setOpeningShift] = React.useState(false);
  const [shiftError, setShiftError] = React.useState<unknown>(null);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [paying, setPaying] = React.useState(false);
  const [billingProfiles, setBillingProfiles] = React.useState<any[]>([]);
  const [scanning, setScanning] = React.useState(false);
  const [completed, setCompleted] = React.useState<RetailOrderResult | null>(
    null,
  );
  const [transferPayment, setTransferPayment] = React.useState<PendingTransferPayment | null>(null);
  const [help, setHelp] = React.useState(false);
  const [scanFeedback, setScanFeedback] = React.useState<{
    kind: ScanFeedbackKind;
    text: string;
  } | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const queueRef = React.useRef(typeof indexedDB === "undefined" ? createMemoryRetailOfflineQueue() : createIndexedDbRetailOfflineQueue());
  const [offlineItems, setOfflineItems] = React.useState<RetailOfflineOrder[]>([]);
  const offlineScope = scope && userProfile?.uid ? { ...scope, userId: userProfile.uid } : null;
  const openPayment = () => {
    if (!shift || shift.pausedAt) {
      toast.error(shift?.pausedAt ? "Ca bán hàng đang tạm dừng. Vui lòng mở lại ca." : "Vui lòng mở ca bán hàng trước khi thanh toán.");
      return;
    }
    if (!cart.customer?._id) {
      toast.error("Vui lòng chọn khách hàng trước khi thanh toán.");
      return;
    }
    if (!cart.quote || cart.quoteDirty) {
      toast.error("Đang tính lại tổng tiền. Vui lòng đợi báo giá mới.");
      return;
    }
    setPaying(true);
  };
  const openShift = async () => {
    if (!scope || !Number.isSafeInteger(openingFloat) || openingFloat < 0) return;
    setOpeningShift(true);
    setShiftError(null);
    try {
      const opened = await retailShiftsApi.open(scope, { openingFloat, terminalId: terminalId.trim() || undefined });
      setShift(opened);
    } catch (error) {
      setShiftError(error);
    } finally {
      setOpeningShift(false);
    }
  };
  const refreshOffline = React.useCallback(() => { if (offlineScope) void queueRef.current.list(offlineScope).then((items) => setOfflineItems(items.filter((item) => item.status !== "synced"))); }, [offlineScope?.companyCode, offlineScope?.branchId, offlineScope?.userId]);
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
  const refreshDrafts = React.useCallback(() => {
    if (scope)
      void retailOrdersApi
        .list(scope, { heldOnly: true, limit: 5 })
        .then((data) => setDrafts(data.items))
        .catch(show);
  }, [scope?.companyCode, scope?.branchId, show]);

  React.useEffect(() => {
    if (!scope) return;
    void retailShiftsApi.current(scope).then(setShift).catch(show);
    refreshDrafts();
  }, [scope?.companyCode, scope?.branchId, refreshDrafts, show]);
  React.useEffect(() => {
    if (!scope) return;
    const timer = window.setTimeout(
      () =>
        void retailProductsApi
          .list(scope, { q, limit: 500 })
          .then((data) => setProducts(data.items))
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
        if (order.paymentStatus === "paid" || order.dueAmount <= 0) {
          setTransferPayment((current) => current?.order._id === orderId
            ? { ...current, order, qr: null, loading: false, error: undefined, settled: true }
            : current);
          if (!notified) toast.success("SePay đã xác nhận thanh toán chuyển khoản.");
          notified = true;
          return;
        }
        if (transferPayment.qr && order.dueAmount !== transferPayment.qr.amount) {
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

  if (!scope) return <Notice />;

  if (shift?.operationalEndsAt && new Date(shift.operationalEndsAt).getTime() <= Date.now()) {
    return <RetailShiftWorkspace />;
  }

  if (!shift) return (
    <section className="mx-auto flex min-h-[65vh] w-full max-w-xl items-center justify-center p-5">
      <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-amber-950">Mở ca bán hàng</h1>
        <p className="mt-2 text-sm text-amber-800">Bạn cần mở ca trước khi quét sản phẩm, tạo đơn hoặc thanh toán.</p>
        <ShiftScheduleNotice error={shiftError} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Tiền đầu ca
            <input aria-label="Tiền đầu ca" type="number" min="0" step="1" value={openingFloat} onChange={(event) => setOpeningFloat(Number(event.target.value || 0))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-slate-700">Mã quầy (không bắt buộc)
            <input aria-label="Mã quầy (không bắt buộc)" value={terminalId} onChange={(event) => setTerminalId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" />
          </label>
        </div>
        <button type="button" disabled={openingShift || !Number.isSafeInteger(openingFloat) || openingFloat < 0} onClick={() => void openShift()} className="mt-5 w-full rounded-xl bg-cyan-600 px-4 py-3 font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50">{openingShift ? "Đang mở ca..." : "Mở ca ngay"}</button>
      </div>
    </section>
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
      couponCode: value.couponCode,
      pointsToRedeem: value.pointsRedeemed,
      taxRate: value.taxRate,
      shippingFee: value.shippingFee,
    });
    toast.info(`Đang xử lý đơn treo #${value._id.slice(-6)}`);
  };
  const saveDraft = async () => {
    if (!cart.lines.length) return;
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
      dispatch({ type: "reset" });
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
    if (!cart.quote) return;
    const transferPayments = payments.filter((payment) => qrPaymentMethods.includes(payment.method));
    const immediatePayments = payments.filter((payment) => !qrPaymentMethods.includes(payment.method));
    const transferAmount = transferPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const immediateAmount = immediatePayments.reduce((sum, payment) => sum + payment.amount, 0);
    const hasPendingTransfer = transferPayments.length > 0;
    if (hasPendingTransfer && transferAmount !== cart.quote.grandTotal - immediateAmount) {
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
    let savedId = draft?._id;
    try {
      if (hasPendingTransfer) {
        const config = await companyPaymentApi.getVietqr();
        if (!config?.bankId || !config?.accountNo) {
          throw new Error("Vui lòng cấu hình ngân hàng và số tài khoản trong Cài đặt doanh nghiệp trước.");
        }
      }
      const saved = draft
        ? await retailOrdersApi.updateDraft(scope, draft._id, {
            ...input,
            version: draft.version,
          })
        : await retailOrdersApi.createDraft(scope, input);
      savedId = saved._id;
      const result = await retailOrdersApi.confirm(scope, saved._id, {
        expectedGrandTotal: cart.quote.grandTotal,
        payments: hasPendingTransfer ? immediatePayments : payments,
        idempotencyKey: key,
      });
      if (hasPendingTransfer) await openTransferPayment(result.order);
      else {
        finish(result);
        setPaying(false);
      }
    } catch (error) {
      const attempt = await retailOrdersApi
        .idempotency(scope, key)
        .catch(() => null);
      if (hasPendingTransfer) {
        let confirmedOrder = attempt?.status === "completed" ? attempt.order as RetailOrder | undefined : undefined;
        if (!confirmedOrder && isRetailNetworkFailure(error) && savedId) {
          const current = await retailOrdersApi.detail(scope, savedId).catch(() => null);
          if (current?.status === "confirmed") confirmedOrder = current;
        }
        if (confirmedOrder?.status === "confirmed" && confirmedOrder.dueAmount > 0) {
          await openTransferPayment(confirmedOrder);
        } else {
          if (error instanceof Error && /tồn|không đủ/i.test(error.message)) {
            await retailProductsApi.list(scope, { q, limit: 500 }).then((data) => setProducts(data.items)).catch(() => undefined);
          }
          if (savedId && !draft && !isRetailNetworkFailure(error)) {
            await retailOrdersApi.cancel(scope, savedId, { reason: "Tự động hủy draft sau khi thanh toán thất bại." }).catch(() => {});
          }
          show(error);
        }
      } else if (attempt?.status === "completed" && attempt.order && attempt.invoice) {
        finish({ order: attempt.order, invoice: attempt.invoice });
        setPaying(false);
      }
      else if (offlineScope && isRetailNetworkFailure(error)) {
        await queueRef.current.put(createRetailOfflineOrder(offlineScope, { draftId: savedId, input, expectedGrandTotal: cart.quote.grandTotal, payments }, key));
        dispatch({ type: "reset" }); setDraft(null); setPaying(false); toast.info("Đơn đang chờ đồng bộ khi có mạng."); refreshOffline();
      } else {
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
  const openTransferPayment = async (order: RetailOrder) => {
    const settled = order.paymentStatus === "paid" || order.dueAmount <= 0;
    setTransferPayment({ order, qr: null, loading: !settled, settled });
    setCompleted(null);
    dispatch({ type: "reset" });
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
    setCompleted(result);
    setDraft(null);
    setPaying(false);
    refreshDrafts();
  };
  const newOrder = () => {
    dispatch({ type: "reset" });
    setRetailPartnerId("");
    setCompleted(null);
    setTransferPayment(null);
    setDraft(null);
  };
  const syncOffline = async (activeScope: OfflineScope) => { const results = await syncRetailOfflineQueue(queueRef.current, activeScope, { check: (key) => retailOrdersApi.idempotency(activeScope, key), send: async (item) => { const payload = item.payload as any; const order = payload.draftId ? { _id: payload.draftId } : await retailOrdersApi.createDraft(activeScope, payload.input); return retailOrdersApi.confirm(activeScope, order._id, { expectedGrandTotal: payload.expectedGrandTotal, payments: payload.payments, idempotencyKey: item.idempotencyKey }); } }); refreshOffline(); return results; };
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
    <section className="grid min-h-[65vh] gap-4 lg:grid-cols-[1fr_440px]">
      <HidScannerListener onScan={(value) => void scan(value)} />
      {offlineScope && <OnlineRetailSync scope={offlineScope} sync={syncOffline} />}
      <main className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Bán hàng</h1>
            <p className="text-sm text-slate-500">
              {shift
                ? `${shift.shiftCode} · ${shift.businessDate}${shift.pausedAt ? " · Đang tạm dừng" : ""}`
                : "Chưa mở ca bán hàng"}
            </p>
          </div>
          <button
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            onClick={() => setScanning(true)}
          >
            <Camera className="h-4 w-4" />
            Quét bằng camera
          </button>
        </header>
        <HeldDraftsBar
          drafts={drafts}
          activeId={draft?._id}
          onOpen={openDraft}
        />
        {scope && userProfile?.enabledModules?.includes("retail-partner") && <RetailCollaboratorSelect scope={scope} value={retailPartnerId} onChange={setRetailPartnerId} />}
        <label className="relative block">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
          <input
            ref={searchRef}
            autoFocus
            aria-label="Tìm hoặc quét sản phẩm"
            className="w-full rounded-xl border py-3 pl-10 pr-4"
            placeholder="Tên, SKU hoặc mã vạch"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const product = products[0];
              if (product) addProductToCart(product, true);
            }}
          />
        </label>
        {scanFeedback && <ScanFeedback {...scanFeedback} />}
      <ProductGrid
          products={products}
          onAdd={addProductToCart}
        />
      </main>
      <CartPanel
        scope={scope}
        cart={cart}
        billingProfiles={billingProfiles}
        busy={busy}
        canPay={Boolean(shift && !shift.pausedAt)}
        dispatch={dispatch}
        onHold={saveDraft}
        onPay={openPayment}
      />
      <RetailOfflineQueuePanel items={offlineItems} onRetry={(id) => void queueRef.current.update(id, { status: "pending", lastError: undefined }).then(() => offlineScope && syncOffline(offlineScope))} onRemove={(id) => void queueRef.current.remove(id).then(refreshOffline)} />
      {paying && cart.quote && (
        <PaymentDialog
          total={cart.quote.grandTotal}
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
          onNewOrder={newOrder}
          onClose={() => setCompleted(null)}
        />
      )}
      {help && <PosShortcutHelp onClose={() => setHelp(false)} />}
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
      className="m-auto max-h-[95vh] w-full max-w-md overflow-y-auto rounded-3xl p-5 shadow-2xl backdrop:bg-slate-950/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {transfer.settled
            ? <CheckCircle2 className="mb-2 h-9 w-9 text-emerald-600" />
            : <QrCode className="mb-2 h-9 w-9 text-cyan-700" />}
          <h2 id="pos-transfer-title" className="text-balance text-xl font-bold">
            {transfer.settled ? "Đã xác nhận thanh toán" : "Chờ thanh toán QR"}
          </h2>
          <p className="text-sm text-slate-500">{transfer.order.orderCode}</p>
        </div>
        <button type="button" aria-label="Đóng QR thanh toán" onClick={onClose}><X /></button>
      </div>

      {transfer.settled ? (
        <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-pretty text-sm text-emerald-800">
          SePay đã xác nhận tiền vào tài khoản doanh nghiệp.
        </p>
      ) : (
        <>
          {transfer.loading && (
            <div role="status" className="mt-5 flex items-center justify-center gap-2 py-5 text-sm text-slate-600">
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
              <p className="mt-3 text-center text-xl font-bold tabular-nums text-cyan-700">{money(amount)}</p>
              <p className="mt-1 text-center text-sm">Nội dung chuyển khoản: <b>{transfer.qr.paymentCode}</b></p>
              <p className="mt-1 text-center text-xs text-slate-500">
                {transfer.qr.accountName} · {transfer.qr.accountNumber} · {transfer.qr.bankId}
              </p>
            </>
          )}
          {transfer.error && (
            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p role="alert">{transfer.error}</p>
              <button type="button" className="mt-2 rounded-lg border border-amber-300 px-3 py-2 font-semibold" onClick={onRetry}>
                Tạo lại QR
              </button>
            </div>
          )}
          {!transfer.loading && !transfer.error && (
            <p role="status" className="mt-4 rounded-xl bg-cyan-50 p-3 text-pretty text-sm text-cyan-900">
              Đơn chỉ được đánh dấu đã thanh toán sau khi SePay gửi xác nhận webhook.
            </p>
          )}
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="rounded-xl border px-3 py-3 font-bold" onClick={onClose}>Đóng</button>
        <button type="button" className="rounded-xl bg-cyan-600 px-3 py-3 font-bold text-white" onClick={onNewOrder}>Đơn mới</button>
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
  React.useEffect(() => {
    if (!group.variants.some((variant) => variant._id === selectedId)) setSelectedId(defaultId);
  }, [group.variants, selectedId, defaultId]);
  const selected = group.variants.find((variant) => variant._id === selectedId) || group.variants[0];
  const totalStock = group.variants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
  return (
    <div className="rounded-2xl border bg-white p-4 hover:border-cyan-500">
      <button
        type="button"
        disabled={selected.stock <= 0}
        className="w-full text-left disabled:opacity-50"
        onClick={() => onAdd(selected)}
      >
        <span className="block font-bold">{group.name}</span>
        <span className="block text-xs text-slate-500">
          {selected.sku} · Tồn {selected.stock > 0 ? selected.stock : "Hết tồn khả dụng"}
        </span>
        <span className="mt-2 block font-bold text-cyan-700">{money(selected.price)}</span>
      </button>
      {group.variants.length > 1 && (
        <div className="relative mt-3">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={`Chọn SKU cho ${group.name}`}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition hover:border-cyan-400 hover:bg-white"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-700">
                {selected.variantName || selected.sku}
              </span>
              <span className="block text-[11px] text-slate-400">
                {group.variants.length} SKU · Tồn tổng {totalStock}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
            />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <ul
                role="listbox"
                className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                {group.variants.map((variant) => {
                  const active = variant._id === selected._id;
                  const soldOut = variant.stock <= 0;
                  return (
                    <li key={variant._id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={soldOut}
                        onClick={() => {
                          setSelectedId(variant._id);
                          setOpen(false);
                          onAdd(variant);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${soldOut ? "cursor-not-allowed opacity-45" : "hover:bg-cyan-50"} ${active ? "bg-cyan-50/60" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-700">
                            {variant.variantName || variant.sku}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-slate-400">
                            {variant.sku}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-semibold text-cyan-700">
                            {money(variant.price)}
                          </span>
                          <span
                            className={`block text-[11px] ${soldOut ? "text-rose-500" : "text-slate-400"}`}
                          >
                            {soldOut ? "Hết tồn" : `Tồn ${variant.stock}`}
                          </span>
                        </span>
                        <Check
                          className={`h-4 w-4 shrink-0 ${active ? "text-cyan-600" : "invisible"}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProductGrid({
  products,
  onAdd,
}: {
  products: RetailProduct[];
  onAdd: (product: RetailProduct) => void;
}) {
  const groups = React.useMemo(() => groupProductsBySku(products), [products]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <ProductCard key={group.key} group={group} onAdd={onAdd} />
      ))}
    </div>
  );
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

function OnlineRetailSync({ scope, sync }: { scope: OfflineScope; sync(scope: OfflineScope): Promise<unknown> }) { const callback = React.useRef(sync); callback.current = sync; React.useEffect(() => { const run = () => void callback.current(scope); window.addEventListener("online", run); if (navigator.onLine) run(); return () => window.removeEventListener("online", run); }, [scope.companyCode, scope.branchId, scope.userId]); return null; }

function CartPanel({
  scope,
  cart,
  billingProfiles,
  busy,
  canPay,
  dispatch,
  onHold,
  onPay,
}: {
  scope: RetailScope;
  cart: RetailCartState;
  billingProfiles: any[];
  busy: boolean;
  canPay: boolean;
  dispatch: React.Dispatch<any>;
  onHold: () => Promise<void>;
  onPay: () => void;
}) {
  return (
    <aside className="flex flex-col rounded-2xl border bg-white p-4">
      <h2 className="flex items-center gap-2 font-bold">
        <ShoppingCart className="h-5 w-5" />
        Giỏ hàng ({cart.lines.reduce((sum, line) => sum + line.quantity, 0)})
      </h2>
      <div className="mt-3">
        <CustomerPicker
          scope={scope}
          value={cart.customer}
          onChange={(customer) => dispatch({ type: "customer", customer })}
        />
        {cart.customer?.type === "vat" && (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">Hoa don VAT</p>
            <select
              aria-label="Ho so VAT"
              value={cart.billingProfile?._id || ""}
              onChange={(event) => dispatch({ type: "billingProfile", billingProfile: billingProfiles.find((item) => item._id === event.target.value) || null })}
              className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Chon ho so xuat VAT</option>
              {billingProfiles.map((profile) => (
                <option key={profile._id} value={profile._id}>{profile.legalName} - {profile.taxId}</option>
              ))}
            </select>
            {!billingProfiles.length && <p className="text-xs text-amber-700">Khach nay chua co ho so VAT dang hoat dong.</p>}
          </div>
        )}
      </div>
      <div className="my-4 flex-1 space-y-3">
        {cart.lines.map((line) => (
          <div key={line.product._id} className="space-y-2 border-b pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{line.product.name}</p>
                <p className="text-xs text-slate-500">
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
                aria-label={`Xóa ${line.product.name}`}
                onClick={() =>
                  dispatch({ type: "remove", productId: line.product._id })
                }
              >
                <X className="h-4 w-4" />
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
      <OrderAdjustments
        orderDiscount={cart.orderDiscount}
        taxRate={cart.taxRate}
        shippingFee={cart.shippingFee}
        onChange={(value) => dispatch({ type: "orderAdjustments", ...value })}
      />
      <RetailCouponInput scope={scope} customerId={cart.customer?._id} value={cart.couponCode} onChange={(couponCode) => dispatch({ type: "coupon", couponCode })} />
      <RetailPointsInput scope={scope} customerId={cart.customer?._id} value={cart.pointsToRedeem} onChange={(pointsToRedeem) => dispatch({ type: "points", pointsToRedeem })} />
      <div className="border-t pt-4">
        {!cart.quoteDirty && Number(cart.quote?.couponDiscount || 0) > 0 && <div className="flex justify-between text-sm text-on-surface-variant"><span>Mã ưu đãi</span><span className="tabular-nums">−{money(Number(cart.quote?.couponDiscount))}</span></div>}
        {!cart.quoteDirty && Number(cart.quote?.pointsDiscount || 0) > 0 && <div className="flex justify-between text-sm text-on-surface-variant"><span>Điểm thưởng</span><span className="tabular-nums">−{money(Number(cart.quote?.pointsDiscount))}</span></div>}
        <div className="flex justify-between text-lg font-bold">
          <span>Tổng tiền</span>
          <span aria-live="polite" className="tabular-nums">{cart.quoteDirty ? "Đang tính lại..." : money(cart.quote?.grandTotal || 0)}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            disabled={!cart.lines.length || busy}
            className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-bold disabled:opacity-40"
            onClick={() => void onHold()}
          >
            <Pause className="h-4 w-4" />
            Treo đơn
          </button>
          <button
            disabled={!cart.lines.length || !cart.quote || cart.quoteDirty || !canPay || busy}
            className="rounded-xl bg-cyan-600 px-3 py-3 font-bold text-white disabled:opacity-40"
            onClick={onPay}
          >
            Thanh toán
          </button>
        </div>
      </div>
    </aside>
  );
}

function Notice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
      Vui lòng chọn chi nhánh.
    </div>
  );
}
