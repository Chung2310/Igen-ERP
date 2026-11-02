import { readPosCart, savePosCart } from "../offline/posCartRecovery";
import { resolveCheckoutIntent, resolveCheckoutIntentLocked } from "../offline/resolveCheckoutIntent";
import { checkoutWithPersistedIntent, PendingCheckoutError } from "../offline/checkoutIntent";
import React from "react";
import { createPortal } from "react-dom";
import { confirmOfflineOrderLocked } from "../offline/confirmOfflineOrder";
import { RetailCheckoutLockBusyError, withRetailCheckoutLock } from "../offline/draftCreationRequest";
import {
  Camera,
  Check,
  Folder,
  Headphones,
  Package,
  Plus,
  Smartphone,
  Star,
  Store,
  Tablet,
  Tag,
} from "lucide-react";
import BarcodeScannerDialog from "../components/pos/BarcodeScannerDialog";
import CheckoutSuccessDialog from "../components/pos/CheckoutSuccessDialog";
import SePayPaymentPendingDialog from "../components/pos/SePayPaymentPendingDialog";
import ReceiptPrintView from "../components/pos/ReceiptPrintViewSerial";
import PaymentDialog from "../components/pos/PaymentDialog";
import PosShortcutHelp from "../components/pos/PosShortcutHelp";
import ScanFeedback, {
  playScanTone,
  type ScanFeedbackKind,
} from "../components/pos/ScanFeedback";
import RetailOfflineQueuePanel from "../components/pos/RetailOfflineQueuePanel";
import AddSerialToCartDialog from "../components/pos/AddSerialToCartDialog";
import ProductVariantSelectorModal from "../components/pos/ProductVariantSelectorModal";
import { PosHeader } from "../components/pos/PosHeader";
import {
  PosCategoryDrilldown,
  PosBottomTabs,
} from "../components/pos/PosCategoryNavigation";
import {
  ProductCard,
  type ProductGroup,
  groupProductsBySku,
} from "../components/pos/ProductCard";
import { ProductGrid } from "../components/pos/ProductGrid";
import { CartPanel } from "../components/pos/CartPanel";
import {
  HidScannerListener,
  OnlineRetailSync,
  PosNotice,
} from "../components/pos/PosSyncListeners";
import { retailOrdersApi } from "../api/retailOrders.api";
import { retailInvoicesApi } from "../api/retailInvoices.api";
import { customerApi } from "../../customer-management/customerApi";
import { retailProductsApi, type RetailOfficialCategory } from "../api/retailProducts.api";
import {
  initialRetailCart,
  retailCartReducer,
  type RetailCartState,
} from "../hooks/retailCart";
import { buildRetailOrderInput } from "../hooks/retailOrderInput";
import { useRetailScope } from "../hooks/useRetailScope";
import { useRetailPosShortcuts } from "../hooks/useRetailPosShortcuts";
import { useRetailFullscreen } from "../hooks/useRetailFullscreen";
import { createHidScannerBuffer } from "../hooks/retailScannerInput";
import { retailWarrantyService } from "../../../services/retailWarrantyService";
import {
  createIndexedDbRetailOfflineQueue,
  createMemoryRetailOfflineQueue,
  type OfflineScope,
  type RetailOfflineOrder,
} from "../offline/retailOfflineQueue";
import { syncRetailOfflineQueue } from "../offline/retailOfflineSync";
import type {
  RetailOrderResult,
  RetailPaymentInput,
  RetailProduct,
  RetailSettings,
  RetailScope,
} from "../types";
import { retailSettingsApi } from "../api/retailSettings.api";
import { toast } from "../../../pages/Toast";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";

type PosCategoryTab = "popular" | "phones" | "tablets" | "accessories" | "all";

const receiptStagingWidth = (paperSize: RetailSettings["invoicePaperSize"]) =>
  paperSize === "58mm" || paperSize === "80mm" ? paperSize : paperSize === "A5" ? "148mm" : "210mm";

type LocalConfirmationOptions = { title: string; description: string; confirmLabel?: string; tone?: "warning" | "danger" };
const requestConfirmation = ({ title, description, confirmLabel }: LocalConfirmationOptions) =>
  Promise.resolve(window.confirm(`${title}\n\n${description}${confirmLabel ? `\n\n${confirmLabel}` : ""}`));

export interface RetailPosPageProps {
  posSessionId?: string;
  onCloseShift?: () => void;
  canLeavePos?: boolean;
  onLeavePos?: () => void;
  onLogout?: () => void;
}

export default function RetailPosPage({
  posSessionId,
  onCloseShift,
  canLeavePos,
  onLeavePos,
  onLogout,
}: RetailPosPageProps = {}) {
  const { fullscreen, toggleFullscreen } = useRetailFullscreen();
  const { scope, userProfile, branchName, activeBranch } = useRetailScope() as any;
  const branchDisplayName =
    branchName ||
    activeBranch?.name ||
    userProfile?.branchName ||
    (scope?.branchId && !/^[0-9a-fA-F]{24}$/.test(scope.branchId) ? scope.branchId : "");
  const recoveryKey = `retail-pos-cart:v1:${JSON.stringify([scope?.companyCode, scope?.branchId, userProfile?.uid])}`;
  const [recovered] = React.useState(() => readPosCart(recoveryKey));
  const [recoveryBlocked, setRecoveryBlocked] = React.useState(Boolean(recovered.error));
  const [cart, dispatch] = React.useReducer(retailCartReducer, recovered.cart);
  const cartRef = React.useRef(cart);
  cartRef.current = cart;
  const defaultTaxRate = React.useRef(0);
  const manualTaxRateChanged = React.useRef(false);
  const [products, setProducts] = React.useState<RetailProduct[]>([]);
  const [officialCategories, setOfficialCategories] = React.useState<RetailOfficialCategory[]>([]);
  const recoveryErrorShown = React.useRef(false);
  React.useLayoutEffect(() => {
    if (recoveryBlocked) return;
    try { savePosCart(recoveryKey, cart); }
    catch { if (!recoveryErrorShown.current) { recoveryErrorShown.current = true; toast.error("Không lưu được giỏ trên thiết bị."); } }
  }, [recoveryKey, cart, recoveryBlocked]);
  const leaveWithCart = async (callback?: () => void, label = "rời POS") => {
    if (!callback || busy) return;
    if (recoveryBlocked) { callback(); return; }
    if (cart.lines.length && !await requestConfirmation({ title: "Rời màn hình bán hàng?", description: `Giỏ chưa thanh toán sẽ được giữ trên máy này. Bạn muốn ${label}?`, confirmLabel: label, tone: "warning" })) return;
    try { savePosCart(recoveryKey, cart); callback(); }
    catch { toast.error("Không lưu được giỏ trên thiết bị."); }
  };
  const [q, setQ] = React.useState("");
  const [selectedL1, setSelectedL1] = React.useState<string>("all");
  const [selectedL2, setSelectedL2] = React.useState<string>("all");
  const [selectedL3, setSelectedL3] = React.useState<string>("all");
  const [busy, setBusy] = React.useState(false);
  const checkoutBusy = React.useRef(false);
  const requestScope = JSON.stringify([scope?.companyCode, scope?.branchId, scope?.terminalId, userProfile?.uid, posSessionId]);
  const scopeToken = React.useMemo(() => ({}), [requestScope]);
  const liveRequestScope = React.useRef(scopeToken);
  liveRequestScope.current = scopeToken;
  React.useEffect(() => { setBusy(false); }, [scopeToken]);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const [paying, setPaying] = React.useState(false);
  const [paymentCode, setPaymentCode] = React.useState("");
  const [billingProfiles, setBillingProfiles] = React.useState<any[]>([]);
  const [scanning, setScanning] = React.useState(false);
  const [pendingProduct, setPendingProduct] = React.useState<RetailProduct | null>(null);
  const [selectedVariantGroup, setSelectedVariantGroup] = React.useState<ProductGroup | null>(null);
  const [completed, setCompleted] = React.useState<RetailOrderResult | null>(
    null,
  );
  const [awaitingPayment, setAwaitingPayment] = React.useState<{ result: RetailOrderResult; amount: number } | null>(null);
  const [invoicePaperSize, setInvoicePaperSize] = React.useState<RetailSettings["invoicePaperSize"]>("80mm");
  const [help, setHelp] = React.useState(false);
  const [scanFeedback, setScanFeedback] = React.useState<{
    kind: ScanFeedbackKind;
    text: string;
  } | null>(null);
  const [reloading, setReloading] = React.useState(false);

  const resetCart = () => dispatch({ type: "reset", taxRate: defaultTaxRate.current });
  const dispatchCartAction = (action: any) => {
    if (action?.type === "orderAdjustments") manualTaxRateChanged.current = true;
    dispatch(action);
  };

  React.useEffect(() => {
    let active = true;
    setInvoicePaperSize("80mm");
    if (scope) {
      void retailSettingsApi.printConfig(scope)
        .then((config) => {
          if (!active) return;
          setInvoicePaperSize(config.invoicePaperSize);
          defaultTaxRate.current = config.defaultTaxRate;
          if (!recovered.cart.lines.length && !cartRef.current.lines.length && !manualTaxRateChanged.current) {
            dispatch({ type: "defaultTaxRate", taxRate: config.defaultTaxRate });
          }
        })
        .catch(() => undefined);
    }
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId]);

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

  const searchRef = React.useRef<HTMLInputElement>(null);
  const [offlineQueue] = React.useState(() =>
    typeof indexedDB === "undefined"
      ? createMemoryRetailOfflineQueue()
      : createIndexedDbRetailOfflineQueue(),
  );
  const queueRef = React.useRef(offlineQueue);
  const [offlineItems, setOfflineItems] = React.useState<RetailOfflineOrder[]>([]);
  const offlineScope =
    scope && userProfile?.uid ? { ...scope, userId: userProfile.uid } : null;

  const openPayment = () => {
    if (recoveryBlocked || !cart.quote || cart.quoteDirty) return;
    setPaymentCode(`AKMP${crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()}`);
    setPaying(true);
  };

  const refreshOffline = React.useCallback(() => {
    if (offlineScope) {
      void queueRef.current
        .list(offlineScope)
        .then((items) => { if (mounted.current && liveRequestScope.current === scopeToken) setOfflineItems(items.filter((item) => item.status !== "synced" && item.status !== "revoked")); }).catch(() => undefined);
    }
  }, [offlineScope?.companyCode, offlineScope?.branchId, offlineScope?.userId]);

  useRetailPosShortcuts(
    React.useMemo(
      () => ({
        focusSearch: () => searchRef.current?.focus(),
        openPayment,
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

  const refreshCatalog = React.useCallback(async () => {
    if (!scope) return;
    setReloading(true);
    try {
      const data = await retailProductsApi.list(scope, { q, limit: 500 });
      setProducts(data.items);
      if (data.categories && data.categories.length > 0) {
        setOfficialCategories(data.categories);
      }
    } catch (error) {
      show(error);
    } finally {
      setReloading(false);
    }
  }, [scope?.companyCode, scope?.branchId, q, show]);

  React.useEffect(() => {
    if (!scope || typeof retailProductsApi.categories !== "function") return;
    void retailProductsApi
      .categories(scope)
      .then((cats) => {
        if (cats && Array.isArray(cats) && cats.length > 0) {
          setOfficialCategories(cats);
        }
      })
      .catch(() => undefined);
  }, [scope?.companyCode, scope?.branchId]);

  React.useEffect(() => {
    if (!scope) return;
    const timer = window.setTimeout(
      () =>
        void retailProductsApi
          .list(scope, { q, limit: 500 })
          .then((data) => {
            setProducts(data.items);
            if (data.categories && data.categories.length > 0) {
              setOfficialCategories(data.categories);
            }
          })
          .catch(show),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [scope?.companyCode, scope?.branchId, q, show]);

  React.useEffect(() => {
    if (!scope || !cart.lines.length || !cart.quoteDirty) return;
    let current = true;
    const timer = window.setTimeout(
      () =>
        void retailOrdersApi
          .quote(scope, buildRetailOrderInput(cart))
          .then((quote) => {
            if (current) dispatch({ type: "quote", quote });
          })
          .catch((error) => {
            if (current) {
              dispatch({ type: "quoteFailed" });
              show(error);
            }
          }),
      180,
    );
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [scope, cart, show]);

  React.useEffect(() => {
    if (!scope || !cart.customer?._id) {
      setBillingProfiles([]);
      dispatch({ type: "billingProfile", billingProfile: null });
      return;
    }
    void customerApi
      .billingProfiles(cart.customer._id, scope.companyCode)
      .then((items) => {
        const active = items.filter((item) => item.status === "active");
        setBillingProfiles(active);
        const selected =
          active.find((item) => item._id === cart.billingProfile?._id) ||
          active.find((item) => item.isDefault) ||
          null;
        dispatch({ type: "billingProfile", billingProfile: selected });
      })
      .catch(() => {
        setBillingProfiles([]);
        dispatch({ type: "billingProfile", billingProfile: null });
      });
  }, [scope?.companyCode, cart.customer?._id]);

  React.useEffect(() => {
    refreshOffline();
  }, [refreshOffline]);

  if (!scope) return <PosNotice />;

  const scan = async (barcode: string) => {
    try {
      const warranty = await retailWarrantyService.lookup(barcode);
      if (warranty.found && warranty.status === "sold") {
        const soldDate = warranty.sold?.at
          ? new Date(warranty.sold.at).toLocaleDateString("vi-VN")
          : "không rõ ngày";
        const endDate = warranty.customerWarranty?.endAt
          ? new Date(warranty.customerWarranty.endAt).toLocaleDateString("vi-VN")
          : "không xác định";
        setScanFeedback({
          kind: "warning",
          text: `Máy đã bán ngày ${soldDate} — còn bảo hành khách đến ${endDate}`,
        });
        playScanTone("warning");
        return;
      }
      if (
        warranty.found &&
        warranty.status === "in_stock" &&
        (warranty.gapMonths || 0) > 0
      ) {
        setScanFeedback({
          kind: "warning",
          text: `Cảnh báo: bảo hành nhà cung cấp ngắn hơn cam kết khách ${warranty.gapMonths} tháng — shop sẽ chịu phần chênh lệch`,
        });
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
      if (product.trackingMode === "serial") {
        addProductToCart(product, true);
        return;
      }
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
    const current =
      cart.lines.find((line) => line.product._id === product._id)?.quantity || 0;
    if (product.stock <= current) {
      toast.error(`${product.name} không còn đủ tồn khả dụng.`);
      return;
    }
    if (product.trackingMode === "serial") {
      setPendingProduct(product);
    } else {
      dispatch({ type: "add", product });
    }
    if (clearSearch) setQ("");
  };

  const checkout = async (payments: RetailPaymentInput[], dueDate?: string) => {
    if (recoveryBlocked || !cart.quote || cart.quoteDirty || checkoutBusy.current) return;
    if (!posSessionId) { toast.error("Phiên POS chưa mở. Hãy mở phiên trước khi thanh toán."); return; }
    const current = () => mounted.current && liveRequestScope.current === scopeToken;
    checkoutBusy.current = true;
    setBusy(true);
    try {
    if (!scope || !offlineScope || typeof indexedDB === "undefined") throw new Error("Không có bộ nhớ bền để lưu yêu cầu thanh toán. Chưa gửi thanh toán.");
      const pendingTransferAmount = payments.reduce((sum, payment) => sum + (payment.method === "transfer" ? payment.amount : 0), 0);
      const transferCode = pendingTransferAmount > 0 ? paymentCode : undefined;
      const confirmedPayments = payments.filter((payment) => payment.method !== "transfer");
      const result = await checkoutWithPersistedIntent(offlineScope, queueRef.current, { ...buildRetailOrderInput(cart), dueDate }, confirmedPayments, cart.quote.grandTotal, posSessionId, undefined, transferCode, pendingTransferAmount);
      if (current()) {
        if (pendingTransferAmount > 0) {
          resetCart();
          setAwaitingPayment({ result, amount: pendingTransferAmount });
          setPaying(false);
          void refreshCatalog();
        } else {
          finish(result);
          setPaying(false);
          await printCheckoutInvoice(result, current);
        }
      }
    } catch (error) {
      if (current()) {
        if (error instanceof PendingCheckoutError) {
          resetCart();
          setPaying(false);
          toast.info("Đã giữ yêu cầu thanh toán. Xử lý tại mục đồng bộ trước khi tạo giao dịch mới.");
        }
        show(error);
      }
    } finally {
      checkoutBusy.current = false;
      if (current()) {
        setBusy(false);
        refreshOffline();
      }
    }
  };

  const finish = (result: RetailOrderResult) => {
    setCompleted(result);
    resetCart();
    void refreshCatalog();
  };

  const printCheckoutInvoice = async (result: RetailOrderResult, isCurrent: () => boolean) => {
    if (!scope) return;
    try {
      await retailInvoicesApi.registerPosPrint(scope, result.invoice._id);
      if (isCurrent()) window.requestAnimationFrame(() => { if (isCurrent()) window.print(); });
    } catch {
      if (isCurrent()) toast.error("Đơn đã thanh toán nhưng chưa in được hóa đơn. Vui lòng nhờ quản lý in lại.");
    }
  };

  const completeAwaitingPayment = async (paymentStatus: import("../types").RetailOrderPaymentStatus) => {
    if (!scope || !awaitingPayment) return;
    const current = () => mounted.current && liveRequestScope.current === scopeToken;
    const order = { ...awaitingPayment.result.order, ...paymentStatus };
    const latestInvoice = await retailInvoicesApi.detail(scope, awaitingPayment.result.invoice._id).catch(() => awaitingPayment.result.invoice);
    if (!current()) return;
    const invoice = {
      ...latestInvoice,
      snapshot: {
        ...latestInvoice.snapshot,
        paidAmount: paymentStatus.paidAmount,
        dueAmount: paymentStatus.dueAmount,
        paymentStatus: paymentStatus.paymentStatus,
        payments: paymentStatus.payments,
      },
    };
    const result = { order, invoice };
    setAwaitingPayment(null);
    setCompleted(result);
    await printCheckoutInvoice(result, current);
  };

  const newOrder = () => {
    resetCart();
    setCompleted(null);
  };

  const resolvePendingCheckout = async (id: string, revoke: boolean) => {
    if (!offlineScope) return;
    if (revoke && !await requestConfirmation({ title: "Thu hồi yêu cầu thanh toán?", description: "Yêu cầu chưa ghi nhận sẽ bị khóa; đơn đã thanh toán không bị hủy hoặc hoàn tiền.", confirmLabel: "Thu hồi yêu cầu", tone: "danger" })) return;
    try {
      const result = await resolveCheckoutIntent(offlineScope, queueRef.current, id, revoke);
      if (mounted.current && liveRequestScope.current === scopeToken) {
        toast.info(result?.message || "Chưa đủ bằng chứng. Giữ nguyên yêu cầu để đối chiếu.");
        refreshOffline();
      }
    } catch (error) { if (mounted.current && liveRequestScope.current === scopeToken) show(error); }
  };

  const syncOffline = async (activeScope: OfflineScope, options: { automatic?: boolean } = {}, retryId?: string) => {
    try {
      if (!retryId) {
        const queued = await queueRef.current.list(activeScope);
        if (!queued.some((item) => item.status === "pending" || item.status === "syncing")) return [];
      }
      return await withRetailCheckoutLock(activeScope, activeScope.userId, async () => {
        if (retryId) {
          const item = (await queueRef.current.list(activeScope)).find(row => row.id === retryId);
          if (!item || item.status === "synced" || item.status === "revoked") return [];
          await queueRef.current.update(retryId, { status: "syncing", lastError: undefined });
        }
        return syncRetailOfflineQueue(queueRef.current, activeScope, {
          check: (_key, item) => resolveCheckoutIntentLocked(activeScope, queueRef.current, item),
          send: item => confirmOfflineOrderLocked(activeScope, item, queueRef.current),
        });
      });
    } catch (error) {
      const automaticLockConflict = options.automatic && error instanceof RetailCheckoutLockBusyError;
      if (!automaticLockConflict && mounted.current && liveRequestScope.current === scopeToken) show(error);
      return [];
    }
    finally { if (mounted.current && liveRequestScope.current === scopeToken) refreshOffline(); }
  };

  // Official Category Hierarchy: Level 1 (Mức 1) -> Level 2 (Mức 2) -> Level 3 (Mức 3)
  const categoryByCode = React.useMemo(() => {
    const map = new Map<string, RetailOfficialCategory>();
    for (const cat of officialCategories) {
      map.set(cat.code, cat);
    }
    return map;
  }, [officialCategories]);

  // Helper to resolve official path for a category code or name from the category tree
  const resolveOfficialPath = React.useCallback(
    (codeOrName: string): RetailOfficialCategory[] => {
      if (!codeOrName || categoryByCode.size === 0) return [];
      let cat = categoryByCode.get(codeOrName);
      if (!cat) {
        cat = officialCategories.find((c) => c.name === codeOrName);
      }
      if (!cat) return [];

      const path: RetailOfficialCategory[] = [];
      const visited = new Set<string>();
      let cur: string | undefined = cat.code;
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        const item = categoryByCode.get(cur);
        if (!item) break;
        path.unshift(item);
        cur = item.parentCode;
      }
      return path;
    },
    [categoryByCode, officialCategories],
  );

  // Extract hierarchy [L1, L2, L3] directly from official data
  const getProductHierarchy = React.useCallback(
    (p: RetailProduct): [string, string | undefined, string | undefined] => {
      // 1. Direct from official categoryPath attached by server
      if (p.categoryPath && p.categoryPath.length > 0) {
        const l1 = p.categoryPath[0]?.name || "Chưa phân loại";
        const l2 = p.categoryPath[1]?.name || (p.brand && p.brand !== "Chưa phân loại" ? p.brand : undefined);
        const l3 = p.categoryPath[2]?.name;
        return [l1, l2, l3];
      }

      // 2. Direct from official category tree lookup
      const target = (p as any).categoryCode || p.category;
      if (target) {
        const path = resolveOfficialPath(target);
        if (path.length > 0) {
          const l1 = path[0]?.name || "Chưa phân loại";
          const l2 = path[1]?.name || (p.brand && p.brand !== "Chưa phân loại" ? p.brand : undefined);
          const l3 = path[2]?.name;
          return [l1, l2, l3];
        }
      }

      // 3. Fallback for test fixtures or unmapped items
      const l1 = p.category || "Chưa phân loại";
      const l2 = p.brand && p.brand !== "Chưa phân loại" ? p.brand : undefined;
      return [l1, l2, undefined];
    },
    [resolveOfficialPath],
  );

  const matchesL1 = React.useCallback(
    (p: RetailProduct, l1: string) => {
      if (l1 === "all") return true;
      const [prodL1] = getProductHierarchy(p);
      return prodL1 === l1;
    },
    [getProductHierarchy],
  );

  // Level 1 Tabs for Bottom Bar (Chỉ bao gồm danh mục cấp 1 chính thức)
  const bottomBarL1Tabs = React.useMemo(() => {
    const getCatIcon = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("điện thoại") || lower.includes("phone")) {
        return <Smartphone className="h-5 w-5" />;
      }
      if (lower.includes("máy tính bảng") || lower.includes("tablet") || lower.includes("ipad")) {
        return <Tablet className="h-5 w-5" />;
      }
      if (lower.includes("phụ kiện") || lower.includes("tai nghe") || lower.includes("âm thanh")) {
        return <Headphones className="h-5 w-5" />;
      }
      if (lower.includes("linh kiện")) {
        return <Package className="h-5 w-5" />;
      }
      return <Folder className="h-5 w-5" />;
    };

    const tabs: { key: string; name: string; icon: React.ReactNode }[] = [];
    const seen = new Set<string>();

    // 1. Level 1 from official category tree (chỉ lấy danh mục gốc: !c.parentCode)
    const rootOfficial = officialCategories.filter((c) => !c.parentCode);
    for (const cat of rootOfficial) {
      if (!seen.has(cat.name)) {
        seen.add(cat.name);
        tabs.push({ key: cat.name, name: cat.name, icon: getCatIcon(cat.name) });
      }
    }

    // 2. Chỉ fallback khi hoàn toàn không có danh mục chính thức từ server (e.g. test fixtures)
    if (tabs.length === 0) {
      for (const p of products) {
        const [l1] = getProductHierarchy(p);
        if (l1 && l1 !== "Chưa phân loại" && !seen.has(l1)) {
          seen.add(l1);
          tabs.push({ key: l1, name: l1, icon: getCatIcon(l1) });
        }
      }
    }

    // 3. Fallback danh mục mặc định nếu hệ thống hoàn toàn trống dữ liệu
    if (tabs.length === 0) {
      for (const standard of ["Điện thoại", "Máy tính bảng", "Phụ kiện"]) {
        if (!seen.has(standard)) {
          seen.add(standard);
          tabs.push({ key: standard, name: standard, icon: getCatIcon(standard) });
        }
      }
    }

    return tabs;
  }, [officialCategories, products, getProductHierarchy]);

  // Level 2 Options (Mức 2: Hãng / Dòng con dưới Mức 1)
  const level2Options = React.useMemo(() => {
    const counts = new Map<string, number>();

    for (const p of products) {
      if (selectedL1 !== "all" && !matchesL1(p, selectedL1)) continue;
      const [, l2] = getProductHierarchy(p);
      if (l2) {
        counts.set(l2, (counts.get(l2) || 0) + 1);
      }
    }

    // If Level 1 is selected, also include official Level 2 child categories from DB
    if (selectedL1 !== "all") {
      const rootCat = officialCategories.find((c) => !c.parentCode && c.name === selectedL1);
      if (rootCat) {
        const childCats = officialCategories.filter((c) => c.parentCode === rootCat.code);
        for (const cat of childCats) {
          if (!counts.has(cat.name)) {
            counts.set(cat.name, 0);
          }
        }
      }
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products, selectedL1, matchesL1, officialCategories, getProductHierarchy]);

  // Level 3 Options (Mức 3: Đời máy / Phân loại con dưới Mức 2)
  const level3Options = React.useMemo(() => {
    if (selectedL2 === "all") return [];
    const counts = new Map<string, number>();

    for (const p of products) {
      if (selectedL1 !== "all" && !matchesL1(p, selectedL1)) continue;
      const [, l2, l3] = getProductHierarchy(p);
      if (l2 === selectedL2 && l3) {
        counts.set(l3, (counts.get(l3) || 0) + 1);
      }
    }

    // If Level 2 is selected, also include official Level 3 child categories from DB
    const parentL2Cat = officialCategories.find((c) => c.name === selectedL2);
    if (parentL2Cat) {
      const childL3Cats = officialCategories.filter((c) => c.parentCode === parentL2Cat.code);
      for (const cat of childL3Cats) {
        if (!counts.has(cat.name)) {
          counts.set(cat.name, 0);
        }
      }
    }

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [products, selectedL1, selectedL2, matchesL1, officialCategories, getProductHierarchy]);

  // Filtered Products strictly following the 3-level official hierarchy
  const displayProducts = React.useMemo(() => {
    if (q.trim()) {
      const query = q.trim().toLowerCase();
      return products.filter((p) => {
        const text = `${p.name} ${p.sku} ${p.category} ${p.categoryPath?.map((c) => c.name).join(" ") || ""}`.toLowerCase();
        return text.includes(query);
      });
    }

    return products.filter((p) => {
      if (selectedL1 !== "all" && !matchesL1(p, selectedL1)) return false;
      const [, l2, l3] = getProductHierarchy(p);

      if (selectedL2 !== "all") {
        if (l2 !== selectedL2) return false;
      }

      if (selectedL3 !== "all") {
        if (l3 !== selectedL3) return false;
      }

      return true;
    });
  }, [products, q, selectedL1, selectedL2, selectedL3, matchesL1, getProductHierarchy]);

  const displayProductGroups = React.useMemo(
    () => groupProductsBySku(displayProducts),
    [displayProducts],
  );

  const shouldRenderInventoryFolderTree = React.useMemo(() => {
    if (selectedL1 !== "all" || selectedL2 !== "all" || selectedL3 !== "all" || q.trim()) {
      return false;
    }
    return products.some(
      (p) =>
        p.category === "A" ||
        p.categoryPath?.some((c) => c.name === "Hàng hóa" || c.name === "Quần áo"),
    );
  }, [products, selectedL1, selectedL2, selectedL3, q]);

  const categoryTitle = React.useMemo(() => {
    if (q.trim()) return `Kết quả tìm kiếm cho "${q.trim()}"`;
    if (selectedL3 !== "all") return selectedL3;
    if (selectedL2 !== "all") return selectedL2;
    if (selectedL1 !== "all") return selectedL1;
    return "Tất cả sản phẩm";
  }, [q, selectedL1, selectedL2, selectedL3]);

  return (
    <section
      className={`flex flex-col bg-[#f3f6ff] text-slate-900 ${
        fullscreen ? "fixed inset-0 z-[45] h-dvh overflow-hidden" : "h-dvh max-h-screen overflow-hidden"
      }`}
    >
      {recoveryBlocked && <div role="alert" className="z-[95] rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>{recovered.error}</p><button type="button" className="mt-2 rounded-lg border px-3 py-2" onClick={async () => {
        if (!await requestConfirmation({ title: "Bỏ giỏ lỗi và tạo giỏ mới?", description: "Bản gốc sẽ được sao lưu trên máy này.", confirmLabel: "Tạo giỏ mới", tone: "danger" })) return;
        try { const raw = localStorage.getItem(recoveryKey); if (raw) localStorage.setItem(`${recoveryKey}:backup:${Date.now()}`, raw); localStorage.removeItem(recoveryKey); resetCart(); setRecoveryBlocked(false); }
        catch { toast.error("Không sao lưu được giỏ. Hãy kiểm tra bộ nhớ trình duyệt."); }
      }}>Sao lưu giỏ lỗi và bắt đầu giỏ mới</button></div>}
      <HidScannerListener onScan={(value) => void scan(value)} />
      {offlineScope && (
        <OnlineRetailSync scope={offlineScope} sync={syncOffline} />
      )}

      {/* TOP HEADER BAR */}
      <PosHeader
        searchRef={searchRef}
        searchQuery={q}
        onSearchChange={setQ}
        onSearchKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const product = displayProducts[0] || products[0];
          if (product) addProductToCart(product, true);
        }}
        onScanClick={() => setScanning(true)}
        userProfile={userProfile}
        branchDisplayName={branchDisplayName}
        fullscreen={fullscreen}
        onToggleFullscreen={() => void toggleFullscreen()}
        onOpenShortcuts={() => setHelp(true)}
        onRefreshCatalog={() => void refreshCatalog()}
        reloading={reloading}
        onCloseShift={() => { void leaveWithCart(onCloseShift, "Đóng phiên"); }}
        canLeavePos={canLeavePos}
        onLeavePos={() => { void leaveWithCart(onLeavePos); }}
        onLogout={() => { void leaveWithCart(onLogout, "Đăng xuất"); }}
      />

      {/* MAIN BODY: Product Catalog on LEFT, Cart & Payment on RIGHT */}
      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_450px] overflow-hidden">
        {/* LEFT COLUMN: Product Catalog & Bottom Category bar */}
        <main className="flex flex-col min-h-0 border-r border-[#dce9ff] overflow-hidden bg-[#f5f8ff]">
          {scanFeedback && (
            <div className="px-4 pt-2">
              <ScanFeedback {...scanFeedback} />
            </div>
          )}

          {/* Catalog Section Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-1 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {categoryTitle}
              </h2>
              <span className="rounded-full bg-[#e7efff] px-2.5 py-0.5 text-[11px] font-semibold text-[#476393]">
                {displayProducts.length} món
              </span>
            </div>
          </div>

          {/* CATEGORY DRILL-DOWN: LEVEL 2 & LEVEL 3 PILLS + BREADCRUMBS (ABOVE PRODUCTS) */}
          <PosCategoryDrilldown
            selectedL1={selectedL1}
            selectedL2={selectedL2}
            selectedL3={selectedL3}
            setSelectedL1={setSelectedL1}
            setSelectedL2={setSelectedL2}
            setSelectedL3={setSelectedL3}
            level2Options={level2Options}
            level3Options={level3Options}
            products={products}
            officialCategories={officialCategories}
            getProductHierarchy={getProductHierarchy}
          />

          {/* Product Cards Grid / Category Tree */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-3 pt-1">
            {shouldRenderInventoryFolderTree ? (
              <ProductGrid
                key={`${scope.companyCode}:${scope.branchId}:${q}:${selectedL1}:${selectedL2}:${selectedL3}`}
                products={displayProducts}
                onAdd={addProductToCart}
                onOpenVariantSelector={setSelectedVariantGroup}
                searchQuery={q}
              />
            ) : displayProductGroups.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#c2d7ff] bg-white p-8 text-center text-slate-500 shadow-2xs">
                <Store className="mb-2 h-10 w-10 text-[#0866f5]" />
                <p className="text-sm font-medium text-slate-700">Không tìm thấy sản phẩm nào trong danh mục này.</p>
                <p className="text-xs text-slate-400">Hãy thử chọn phân loại khác hoặc xóa bộ lọc.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {displayProductGroups.map((group) => (
                  <ProductCard
                    key={group.key}
                    group={group}
                    onAdd={addProductToCart}
                    onOpenVariantSelector={setSelectedVariantGroup}
                  />
                ))}
              </div>
            )}
          </div>

          {/* LEVEL 1 BOTTOM BAR (Single Row) */}
          <PosBottomTabs
            selectedL1={selectedL1}
            setSelectedL1={setSelectedL1}
            setSelectedL2={setSelectedL2}
            setSelectedL3={setSelectedL3}
            tabs={bottomBarL1Tabs}
          />
        </main>

        {/* RIGHT COLUMN: Cart & Checkout Panel */}
        <CartPanel
          scope={scope}
          cart={cart}
          billingProfiles={billingProfiles}
          busy={busy}
          canPay={!recoveryBlocked}
          dispatch={dispatchCartAction}
          onPay={openPayment}
        />
      </div>

      <RetailOfflineQueuePanel
        items={offlineItems}
        onRetry={(id) => {
          if (offlineScope) void syncOffline(offlineScope, {}, id);
        }}
        onRemove={() => undefined}
        onReconcile={(id) => void resolvePendingCheckout(id, false)}
        onRevoke={(id) => void resolvePendingCheckout(id, true)}
      />

      {paying && cart.quote && (
        <PaymentDialog
          total={cart.quote.grandTotal}
          installment={cart.installment}
          busy={busy}
          customerId={cart.customer?._id}
          transferContent={paymentCode}
          deferTransferQr
          onClose={() => setPaying(false)}
          onSubmit={checkout}
        />
      )}

      {awaitingPayment && scope && (
        <SePayPaymentPendingDialog
          scope={scope}
          orderId={awaitingPayment.result.order._id}
          orderCode={awaitingPayment.result.order.orderCode || awaitingPayment.result.invoice.orderCode}
          paymentCode={awaitingPayment.result.order.paymentCode || paymentCode}
          amount={awaitingPayment.amount}
          paidAmountBeforeTransfer={awaitingPayment.result.order.paidAmount}
          onPaid={completeAwaitingPayment}
          onDismiss={() => {
            setAwaitingPayment(null);
            toast.info("Đơn vẫn được lưu và chờ thanh toán. Có thể theo dõi trạng thái trong danh sách đơn hàng.");
          }}
        />
      )}

      {pendingProduct && (
        <AddSerialToCartDialog
          scope={scope}
          product={pendingProduct}
          excluded={cart.lines.flatMap((line) => line.serialNumbers || [])}
          onClose={() => setPendingProduct(null)}
          onConfirm={(serialNumber) => {
            const line = cart.lines.find((item) => item.product._id === pendingProduct._id);
            if ((line?.quantity || 0) >= pendingProduct.stock) {
              toast.error(`${pendingProduct.name} không còn đủ tồn khả dụng.`);
              return;
            }
            dispatch({ type: "add", product: pendingProduct });
            dispatch({
              type: "serials",
              productId: pendingProduct._id,
              serialNumbers: [...(line?.serialNumbers || []), serialNumber],
            });
            setPendingProduct(null);
          }}
        />
      )}

      {scanning && (
        <BarcodeScannerDialog
          onScan={(value) => void scan(value)}
          onClose={() => setScanning(false)}
        />
      )}

      {selectedVariantGroup && (
        <ProductVariantSelectorModal
          isOpen={true}
          group={selectedVariantGroup}
          onClose={() => setSelectedVariantGroup(null)}
          onAdd={(variant) => {
            setSelectedVariantGroup(null);
            addProductToCart(variant);
          }}
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
      {completed && createPortal(
        <div className="retail-print-staging" style={{ position: "fixed", left: "-10000px", top: 0, width: receiptStagingWidth(invoicePaperSize), visibility: "hidden" }}>
          <ReceiptPrintView invoice={completed.invoice} paperSize={invoicePaperSize} printTarget />
        </div>,
        document.body,
      )}

      {help && <PosShortcutHelp onClose={() => setHelp(false)} />}
    </section>
  );
}
