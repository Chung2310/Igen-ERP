import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Eye, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { ProductItem, StockLog, StockLogPurpose } from "../../types";
import { inventoryReceivingService, type InventoryBalance, type Warehouse } from "../../services/inventoryReceivingService";
import { inventorySerialService, type InventorySerialUnit } from "../../services/inventorySerialService";
import { StockOutCustomerPicker } from "./StockOutCustomerPicker";
import { StockOperatorPicker } from "./StockOperatorPicker";
import { toast } from "../../pages/Toast";
import { parseFirebaseError } from "../../utils/firebaseErrorParser";
import { StyledSelect } from "../common/StyledSelect";
import "./inventory-ui.css";


/**
 * Khoá định danh một dòng phiếu theo sản phẩm + SKU thay vì theo vị trí trong mảng:
 * xoá một dòng ở giữa sẽ làm lệch chỉ số của các dòng sau và tra nhầm cache đơn vị.
 * Form đã chặn trùng (productId, sku) nên khoá này là duy nhất.
 */
const lineUnitKey = (line: { productId: string; sku?: string }) => `${line.productId}::${line.sku || ""}`;

type DraftLine = {
  productId: string;
  variantId?: string;
  sku?: string;
  productName?: string;
  quantity: string;
  unitIdentifiers?: string[];
  serialNumbers?: string[];
};

type TransactionStatus = "Đang chờ" | "Đang xử lý" | "Hoàn thành";

type DraftPayload = {
  id?: string;
  type: "nhập" | "xuất";
  purpose?: StockLogPurpose;
  customerId?: string;
  customerName?: string;
  title: string;
  operatorName: string;
  notes: string;
  status: TransactionStatus;
  items: Array<{ productId: string; variantId?: string; sku?: string; productName?: string; quantity: number; unitIdentifiers?: string[]; serialNumbers?: string[] }>;
  warehouseId?: string;
};

type StockLogPanelProps = {
  products: ProductItem[];
  searchLog: string;
  setSearchLog: (value: string) => void;
  stockLogs: StockLog[];
  isLoading?: boolean;
  onExportExcel: () => void;
  onImportExcel: () => void;
  isImporting?: boolean;
  onNavigateToCreateProduct: () => void;
  onCreateTransaction: (payload: DraftPayload) => Promise<void>;
  onUpdateTransaction: (payload: DraftPayload) => Promise<void>;
  onUpdateStatus?: (logId: string, status: TransactionStatus) => Promise<void>;
  onDeleteTransaction?: (logId: string) => Promise<void>;
  readOnly?: boolean;
  outboundOnly?: boolean;
  hideExcelActions?: boolean;
  initialWarehouseId?: string;
  initialSku?: string;
  openOnMountKey?: number;
  renderReversal?: (log: StockLog) => React.ReactNode;
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function getLogStatus(log: StockLog): TransactionStatus {
  const status = String(log.status);
  if (status === "Đang chờ" || status === "Đang xử lý" || status === "Hoàn thành") {
    return status;
  }
  return status === "Thành công" ? "Hoàn thành" : "Đang xử lý";
}

function getStatusTone(status: TransactionStatus) {
  if (status === "Hoàn thành") return "bg-emerald-50 text-emerald-700";
  if (status === "Đang xử lý") return "bg-orange-50 text-orange-700";
  return "bg-slate-100 text-slate-700";
}

function getStatusKey(status: TransactionStatus) {
  const normalized = String(status).toLowerCase();
  if (normalized.startsWith("h")) return "completed";
  if (normalized.includes("x")) return "processing";
  return "pending";
}

function getTypeKey(type: StockLog["type"]) {
  return String(type).toLowerCase().startsWith("x") ? "outbound" : "inbound";
}

function getLogItems(log: StockLog): Array<{ productId?: string; variantId?: string; sku: string; productName: string; quantity: number; unitCode?: string; unitIdentifiers?: string[]; serialNumbers?: string[] }> {
  const typedLog = log as StockLog & {
    items?: Array<{ productId?: string; variantId?: string; sku: string; productName: string; quantity: number; unitIdentifiers?: string[]; serialNumbers?: string[] }>;
  };

  if (typedLog.items?.length) {
    return typedLog.items;
  }

  const legacyLog = log as any;
  return [{ sku: log.sku, productName: log.productName, quantity: log.quantity, unitIdentifiers: legacyLog.unitIdentifiers }];
}

function getLogTitle(log: StockLog) {
  const typedLog = log as StockLog & { title?: string };
  if (typedLog.title) return typedLog.title;
  return `${log.type === "nhập" ? "Nhập kho" : "Xuất kho"}: ${log.productName}`;
}

export function StockLogPanel({
  products,
  searchLog,
  setSearchLog,
  stockLogs,
  isLoading = false,
  onExportExcel,
  onImportExcel,
  isImporting = false,
  onNavigateToCreateProduct,
  onCreateTransaction,
  onUpdateTransaction,
  onUpdateStatus,
  onDeleteTransaction,
  readOnly = false,
  outboundOnly = false,
  hideExcelActions = false,
  initialWarehouseId,
  initialSku,
  openOnMountKey,
  renderReversal,
}: StockLogPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<StockLog | null>(null);
  const detailHasUnits = Boolean(selectedLog && getLogItems(selectedLog).some((item) => item.serialNumbers?.length || item.unitIdentifiers?.length));
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<"nhập" | "xuất">(outboundOnly ? "xuất" : "nhập");
  const [draftPurpose, setDraftPurpose] = useState<StockLogPurpose>("bán");
  const [draftCustomerId, setDraftCustomerId] = useState<string | undefined>(undefined);
  const [draftCustomerName, setDraftCustomerName] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftOperator, setDraftOperator] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftStatus, setDraftStatus] = useState<TransactionStatus>("Đang chờ");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([{ productId: "", quantity: "1" }]);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "inbound" | "outbound">(outboundOnly ? "outbound" : "all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "completed">("all");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [warehouseBalances, setWarehouseBalances] = useState<InventoryBalance[]>([]);
  const [warehouseProductsLoading, setWarehouseProductsLoading] = useState(false);
  const [unitPickerIndex, setUnitPickerIndex] = useState<number | null>(null);
  const [unitPickerItems, setUnitPickerItems] = useState<InventorySerialUnit[]>([]);
  const [unitItemsByLine, setUnitItemsByLine] = useState<Record<string, InventorySerialUnit[]>>({});
  const [unitPickerLoading, setUnitPickerLoading] = useState(false);
  const [unitPickerQuery, setUnitPickerQuery] = useState("");

  const selectedLineForPicker = unitPickerIndex !== null ? draftLines[unitPickerIndex] : null;
  const selectedUnitsForPicker = selectedLineForPicker?.unitIdentifiers || [];
  const requiredUnitCount = Math.max(1, Number(selectedLineForPicker?.quantity) || 1);
  const unitPickerQueryNormalized = unitPickerQuery.trim().toLowerCase();
  const filteredPickerItems = useMemo(
    () =>
      unitPickerItems.filter((item) =>
        unitPickerQueryNormalized
          ? (item.internalBarcode || "").toLowerCase().includes(unitPickerQueryNormalized) ||
            (item.normalizedSerialNumber || "").toLowerCase().includes(unitPickerQueryNormalized) ||
            (item.serialNumber || "").toLowerCase().includes(unitPickerQueryNormalized)
          : true,
      ),
    [unitPickerItems, unitPickerQueryNormalized]
  );

  useEffect(() => {
    if (!outboundOnly) return;
    let active = true;
    const loadWarehouses = async () => {
      setWarehouseProductsLoading(true);
      try {
        const nextWarehouses = await inventoryReceivingService.listWarehouses();
        if (!active) return;
        setWarehouses(nextWarehouses);
        setSourceWarehouseId((current) => current && nextWarehouses.some((warehouse) => warehouse._id === current) ? current : nextWarehouses.find((warehouse) => warehouse.isDefault)?._id || nextWarehouses[0]?._id || "");
      } catch {
        if (active) { setWarehouses([]); setSourceWarehouseId(""); }
      } finally {
        if (active) setWarehouseProductsLoading(false);
      }
    };
    void loadWarehouses();
    return () => { active = false; };
  }, [outboundOnly]);

  useEffect(() => {
    if (!outboundOnly || !sourceWarehouseId) { setWarehouseBalances([]); return; }
    let active = true;
    const loadBalances = async () => {
      setWarehouseProductsLoading(true);
      try {
        const nextBalances = await inventoryReceivingService.listBalances(sourceWarehouseId);
        if (active) setWarehouseBalances(nextBalances);
      } catch {
        if (active) setWarehouseBalances([]);
      } finally {
        if (active) setWarehouseProductsLoading(false);
      }
    };
    void loadBalances();
    return () => { active = false; };
  }, [outboundOnly, sourceWarehouseId]);

  const selectableProducts = useMemo(() => {
    if (!outboundOnly) return products;
    const availableBySku = new Map(warehouseBalances.filter((balance) => balance.quantity - balance.reservedQuantity > 0).map((balance) => [balance.sku, balance]));
    const legacyProductsInWarehouse = products
      .filter((product) => availableBySku.has(product.sku))
      .map((product) => ({ ...product, stock: Math.max(0, (availableBySku.get(product.sku)?.quantity || 0) - (availableBySku.get(product.sku)?.reservedQuantity || 0)) }));
    if (legacyProductsInWarehouse.length > 0) return legacyProductsInWarehouse;

    // Kho mới lưu tồn theo SKU/biến thể; vẫn hiển thị được các SKU này khi danh mục cũ chưa đồng bộ.
    return warehouseBalances
      .filter((balance) => balance.quantity - balance.reservedQuantity > 0)
      .map((balance) => ({
        id: balance.productId,
        sku: balance.sku,
        name: balance.productName || balance.sku,
        category: "",
        unit: "",
        stock: Math.max(0, balance.quantity - balance.reservedQuantity),
        minStockAlert: 0,
        price: 0,
        status: "Active" as const,
        demandForecast: "Ổn định" as const,
        imageUrl: balance.variantMediaUrl || balance.productMediaUrl || "",
      }));
  }, [outboundOnly, products, warehouseBalances]);

  const warehouseProductGroups = useMemo(() => {
    const groups = new Map<string, { productId: string; name: string; variants: InventoryBalance[] }>();
    warehouseBalances
      .filter((balance) => balance.quantity - balance.reservedQuantity > 0)
      .forEach((balance) => {
        const current = groups.get(balance.productId) || { productId: balance.productId, name: balance.productName || balance.sku, variants: [] };
        current.variants.push(balance);
        groups.set(balance.productId, current);
      });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [warehouseBalances]);

  const filteredLogs = useMemo(
    () =>
      stockLogs.filter((log) => {
        const keyword = searchLog.toLowerCase();
        const itemText = getLogItems(log)
          .map((item) => `${item.productName} ${item.sku}`)
          .join(" ")
          .toLowerCase();

        const matchesType = outboundOnly ? getTypeKey(log.type) === "outbound" : typeFilter === "all" || getTypeKey(log.type) === typeFilter;
        const matchesStatus = statusFilter === "all" || getStatusKey(getLogStatus(log)) === statusFilter;
        const matchesKeyword =
          log.id.toLowerCase().includes(keyword) ||
          getLogTitle(log).toLowerCase().includes(keyword) ||
          itemText.includes(keyword);

        return matchesType && matchesStatus && matchesKeyword;
      }),
    [outboundOnly, searchLog, statusFilter, stockLogs, typeFilter]
  );

  const resetDraft = () => {
    setEditingLogId(null);
    setDraftType(outboundOnly ? "xuất" : "nhập");
    setDraftPurpose("bán");
    setDraftCustomerId(undefined);
    setDraftCustomerName("");
    setDraftTitle("");
    setDraftOperator("");
    setDraftNotes("");
    setDraftStatus("Đang chờ");
    setDraftLines([{ productId: "", quantity: "1" }]);
    setUnitPickerIndex(null);
    setUnitPickerItems([]);
    setUnitPickerQuery("");
  };

  const openCreateModal = () => {
    resetDraft();
    setShowCreateModal(true);
  };

  useEffect(() => {
    if (!openOnMountKey || !outboundOnly) return;
    resetDraft();
    setSourceWarehouseId(initialWarehouseId || "");
    setShowCreateModal(true);
  }, [initialWarehouseId, openOnMountKey, outboundOnly]);

  useEffect(() => {
    if (!showCreateModal || !outboundOnly || !initialSku || !openOnMountKey) return;
    const product = selectableProducts.find((item) => item.sku === initialSku);
    if (product) setDraftLines([{ productId: product.id, sku: initialSku, quantity: "1" }]);
  }, [initialSku, openOnMountKey, outboundOnly, selectableProducts, showCreateModal]);

  const openEditModal = (log: StockLog) => {
    const items = getLogItems(log);
    setEditingLogId(log.id);
    setDraftType(log.type as "nhập" | "xuất");
    setDraftPurpose(log.purpose || "bán");
    setDraftCustomerId((log as StockLog & { customerId?: string }).customerId || undefined);
    setDraftCustomerName(log.customerName || "");
    setDraftTitle(getLogTitle(log));
    setDraftOperator(log.operatorName);
    setDraftNotes(log.notes);
    setDraftStatus(getLogStatus(log));
    const savedWarehouseId = (log as StockLog & { warehouseId?: string }).warehouseId;
    if (savedWarehouseId) setSourceWarehouseId(savedWarehouseId);
    setDraftLines(
      items.map((item) => {
        const matchedProduct = products.find((product) => product.sku === item.sku);
        return {
          productId: matchedProduct?.id || item.productId || "",
          variantId: item.variantId,
          sku: item.sku,
          productName: item.productName || matchedProduct?.name || "",
          quantity: String(item.quantity),
          unitIdentifiers: item.unitIdentifiers || [],
          serialNumbers: item.serialNumbers || [],
        };
      })
    );
    setShowCreateModal(true);
  };

  const addDraftLine = () => {
    setDraftLines((current) => [...current, { productId: "", quantity: "1" }]);
  };

  const updateDraftLine = (index: number, nextLine: DraftLine) => {
    setDraftLines((current) => current.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const quantity = Math.max(0, Number(nextLine.quantity) || 0);
      return { ...nextLine, unitIdentifiers: nextLine.unitIdentifiers?.slice(0, quantity), serialNumbers: nextLine.serialNumbers?.slice(0, quantity) };
    }));
  };

  const removeDraftLine = (index: number) => {
    setDraftLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  };

  const requiresUnitSelection = (line: DraftLine) => {
    const balance = warehouseBalances.find((item) => item.productId === line.productId && (line.variantId ? item.variantId === line.variantId : item.sku === line.sku));
    if (balance?.trackingMode) return balance.trackingMode === "serial" || balance.trackingMode === "unit_barcode";
    return Boolean(line.unitIdentifiers?.length || line.serialNumbers?.length);
  };

  const openUnitPicker = async (index: number) => {
    const line = draftLines[index];
    if (!line?.productId || !line.sku || !requiresUnitSelection(line)) return;
    setUnitPickerIndex(index);
    setUnitPickerQuery("");
    setUnitPickerLoading(true);
    try {
      // Phiếu cũ lưu mã sản phẩm cha thay vì SKU biến thể; lọc theo mã đó sẽ không ra đơn vị nào,
      // nên khi SKU không thuộc danh sách biến thể của kho thì chỉ lọc theo sản phẩm để còn chọn lại được.
      const knownVariant = (warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).some((variant) => variant.sku === line.sku);
      const result = await inventorySerialService.list({ warehouseId: sourceWarehouseId, productId: line.productId, ...(knownVariant ? { sku: line.sku } : {}), status: "in_stock", barcodes: line.unitIdentifiers, limit: 100 });
      setUnitPickerItems(result.items);
      setUnitItemsByLine((current) => ({ ...current, [lineUnitKey(line)]: result.items }));
    } finally {
      setUnitPickerLoading(false);
    }
  };

  const submitDraft = async (event: React.FormEvent) => {
    event.preventDefault();

    if (outboundOnly && !sourceWarehouseId) {
      toast.error("Vui lòng chọn kho xuất.");
      return;
    }

    if (outboundOnly && draftStatus === "Hoàn thành") {
      const invalidLine = draftLines.find((line) => {
        const identifiers = line.unitIdentifiers?.length ? line.unitIdentifiers : line.serialNumbers || [];
        return requiresUnitSelection(line) && identifiers.length !== Number(line.quantity);
      });
      if (invalidLine) {
        toast.error("Vui lòng chọn đủ mã đơn vị cho từng sản phẩm quản lý theo đơn vị.");
        return;
      }
    }

    const normalizedItems = draftLines
      .map((line) => {
        const matchedProduct = selectableProducts.find((p) => p.id === line.productId);
        return {
          productId: line.productId,
          variantId: line.variantId,
          sku: line.sku || matchedProduct?.sku || "",
          productName: matchedProduct?.name || line.sku || "",
          quantity: Number(line.quantity),
          unitIdentifiers: line.unitIdentifiers,
          serialNumbers: (() => {
            const selected = line.unitIdentifiers?.map((identifier) => unitItemsByLine[lineUnitKey(line)]?.find((unit) => unit.normalizedInternalBarcode === identifier)?.serialNumber).filter(Boolean) || [];
            return selected.length ? selected : line.serialNumbers;
          })(),
        };
      })
      .filter((line, index) => line.productId && (!outboundOnly || Boolean(draftLines[index]?.sku)) && Number.isFinite(line.quantity) && line.quantity > 0);

    if (!draftTitle.trim() || !draftOperator.trim() || normalizedItems.length === 0) {
      toast.error("Vui lòng nhập tên phiếu, chọn người phụ trách và thêm ít nhất một sản phẩm.");
      return;
    }

    setSubmitting(true);

    const payload: DraftPayload = {
      id: editingLogId || undefined,
      type: draftType,
      purpose: draftType === "xuất" ? draftPurpose : undefined,
      customerId: draftType === "xuất" && draftPurpose === "bán" ? draftCustomerId : undefined,
      customerName: draftType === "xuất" && (draftPurpose === "bán" || draftPurpose === "nội bộ") ? draftCustomerName.trim() : undefined,
      title: draftTitle.trim(),
      operatorName: draftOperator.trim(),
      notes: draftNotes.trim(),
      status: draftStatus,
      items: normalizedItems,
      warehouseId: sourceWarehouseId || undefined,
    };

    try {
      if (editingLogId) {
        await onUpdateTransaction(payload);
      } else {
        await onCreateTransaction(payload);
      }
      setShowCreateModal(false);
      resetDraft();
    } catch (error) {
      console.error("Lỗi khi lưu phiếu:", error);
      toast.error(parseFirebaseError(error, "Không thể lưu phiếu. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inventory-ui space-y-5" id="stock_transactions_list">
      <div className="rounded-2xl border border-[#DCE7F4] bg-white px-4 py-3" id="log_filters_bar">
        <div className="flex flex-wrap items-end gap-3">

          {/* ── Bộ lọc ── */}
          <div className="relative min-w-48 flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm mọi phiếu, sản phẩm..."
              className="h-10 w-full rounded-xl border border-[#DCE7F4] bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400"
              value={searchLog}
              onChange={(event) => setSearchLog(event.target.value)}
            />
          </div>

          {!outboundOnly && <div className="flex w-40 shrink-0 flex-col gap-1">
            <span className="px-0.5 text-xs text-slate-500">Loại phiếu</span>
            <StyledSelect ariaLabel="Lọc loại phiếu" value={typeFilter} onChange={(value) => setTypeFilter(value as "all" | "inbound" | "outbound")} options={[{ value: "all", label: "Tất cả phiếu" }, { value: "inbound", label: "Phiếu nhập" }, { value: "outbound", label: "Phiếu xuất" }]} />
          </div>}

          <div className="flex w-44 shrink-0 flex-col gap-1">
            <span className="px-0.5 text-xs text-slate-500">Trạng thái</span>
            <StyledSelect ariaLabel="Lọc trạng thái phiếu" value={statusFilter} onChange={(value) => setStatusFilter(value as "all" | "pending" | "processing" | "completed")} options={[{ value: "all", label: "Tất cả trạng thái" }, { value: "pending", label: "Đang chờ" }, { value: "processing", label: "Đang xử lý" }, { value: "completed", label: "Hoàn thành" }]} />
          </div>

          {/* ── Ngăn cách ── */}
          <div className="hidden h-7 w-px shrink-0 bg-gray-200 sm:block" />

          {/* ── Hành động ── */}
          <div className="flex shrink-0 items-center gap-2">
            {!readOnly && !hideExcelActions && <button
              type="button"
              onClick={onImportExcel}
              disabled={isImporting}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {isImporting ? "Đang nhập..." : "Nhập Excel"}
            </button>}
            {!readOnly && !hideExcelActions && <button
              type="button"
              onClick={onExportExcel}
              className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" />
              Xuất Excel
            </button>}
            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#00ADFC] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0097dc]"
            >
              <Plus className="h-4 w-4" />
              {outboundOnly ? "Tạo phiếu xuất" : "Tạo phiếu"}
            </button>
          </div>

        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white">
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse flex flex-col gap-4 rounded-2xl border border-gray-150 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="h-12 w-12 rounded-2xl bg-gray-200 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-1/3 bg-gray-200 rounded" />
                      <div className="h-3.5 w-1/2 bg-gray-200 rounded" />
                      <div className="h-3 w-1/4 bg-gray-200 rounded" />
                    </div>
                  </div>
                  <div className="flex items-end gap-2 flex-col sm:items-end">
                    <div className="h-8 w-20 bg-gray-200 rounded" />
                    <div className="h-8 w-44 bg-gray-200 rounded mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.map((log) => {
            const items = getLogItems(log);
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            const units = new Set(items.map((item) => item.unitCode || 'đơn vị'));
            const mixedUnits = units.size > 1;
            const previewText = items.map((item) => item.productName).join(", ");
            const isInbound = log.type === "nhập";
            const status = getLogStatus(log);

            return (
              <div key={log.id} className="flex flex-col gap-3 border-b border-[#E7EFF7] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5 hover:bg-[#F8FBFF]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isInbound ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {isInbound ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-slate-800">{getLogTitle(log)}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isInbound ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{isInbound ? "Nhập kho" : "Xuất kho"}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-600">{previewText}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{log.operatorName || "Chưa rõ người tạo"}</span><span>•</span><span>{new Date(log.createdAt).toLocaleString("vi-VN")}</span>
                      {!readOnly && status !== "Hoàn thành" && onUpdateStatus ? (
                        <div className="w-36">
                          <StyledSelect
                            ariaLabel={`Trạng thái ${log.id}`}
                            value={status}
                            disabled={statusUpdatingId === log.id}
                            onChange={async (value) => {
                              const nextStatus = value as TransactionStatus;
                              if (nextStatus === status) return;
                              try {
                                setStatusUpdatingId(log.id);
                                await onUpdateStatus(log.id, nextStatus);
                              } catch (error) {
                                console.error("Lỗi khi cập nhật trạng thái:", error);
                                toast.error(parseFirebaseError(error, "Không thể cập nhật trạng thái."));
                              } finally {
                                setStatusUpdatingId(null);
                              }
                            }}
                            options={[{ value: "Đang chờ", label: "Đang chờ" }, { value: "Đang xử lý", label: "Đang xử lý" }, { value: "Hoàn thành", label: "Hoàn thành" }]}
                            className="h-8 text-xs"
                          />
                        </div>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${getStatusTone(status)}`}>{status}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <div className={`text-right text-xl font-medium ${isInbound ? "text-emerald-600" : "text-rose-600"}`}>
                    {!mixedUnits && (isInbound ? "+" : "-")}
                    {formatNumber(mixedUnits ? items.length : totalQuantity)}
                    <span className="ml-1 text-sm font-semibold text-gray-400">{mixedUnits ? 'dòng hàng' : [...units][0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!readOnly && renderReversal?.(log)}
                    {!readOnly && status !== "Hoàn thành" && <button
                      type="button"
                      onClick={() => openEditModal(log)}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <Pencil className="h-4 w-4" />
                      Sửa phiếu
                    </button>}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetailModal(true);
                      }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-cyan-700"
                      title="Xem chi tiết"
                    >
                      <Eye className="h-4 w-4" />
                      Xem chi tiết
                    </button>
                    {!readOnly && status !== "Hoàn thành" && onDeleteTransaction && (
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(log.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <p className="font-bold text-gray-700">Chưa có phiếu phù hợp</p>
              <p className="mt-1 text-sm text-gray-500">Tạo phiếu mới hoặc thử đổi từ khóa tìm kiếm.</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div className="inventory-popup max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_24px_70px_rgba(11,65,99,0.18)]">
            <div className="flex items-start justify-between border-b border-[#E7EFF7] px-6 py-4">
              <div>
                <h3 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium text-slate-900">{editingLogId ? "Chỉnh sửa phiếu xuất kho" : outboundOnly ? "Tạo phiếu xuất kho" : "Tạo phiếu nhập xuất kho"}</h3>
                <p className="mt-1 text-sm text-slate-500">{outboundOnly ? "Khai báo thông tin và danh sách hàng cần xuất." : "Chọn loại phiếu, trạng thái xử lý và danh sách sản phẩm."}</p>
              </div>
              <button type="button" aria-label="Đóng phiếu" onClick={() => setShowCreateModal(false)} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form noValidate className="space-y-5 p-6" onSubmit={submitDraft}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {!outboundOnly && <button
                  type="button"
                  onClick={() => setDraftType("nhập")}
                  className={`rounded-2xl border px-4 py-3 text-left ${draftType === "nhập" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
                >
                  <div className="text-sm font-bold text-slate-800">Phiếu nhập hàng</div>
                  <div className="mt-1 text-xs text-gray-500">Cộng tồn kho cho sản phẩm được chọn.</div>
                </button>}
                {outboundOnly ? (
                  <div className="rounded-xl border border-[#DCE7F4] bg-[#F5FAFE] px-4 py-3">
                    <div className="text-sm font-medium text-slate-800">Phiếu xuất hàng</div>
                    <div className="mt-1 text-xs leading-5 text-slate-600">Tồn kho được trừ khi phiếu hoàn thành.</div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDraftType("xuất")}
                    className={`rounded-xl border px-4 py-3 text-left ${draftType === "xuất" ? "border-rose-200 bg-rose-50" : "border-gray-200 bg-white"}`}
                  >
                    <div className="text-sm font-bold text-slate-800">Phiếu xuất hàng</div>
                    <div className="mt-1 text-xs text-gray-500">Trừ tồn kho theo từng sản phẩm trong phiếu.</div>
                  </button>
                )}
                <div className={`space-y-1.5 ${outboundOnly ? "md:col-span-3" : "md:col-span-2"}`}>
                  <span className="text-sm text-slate-600">Trạng thái phiếu</span>
                  <StyledSelect ariaLabel="Trạng thái phiếu" value={draftStatus} onChange={(value) => setDraftStatus(value as TransactionStatus)} options={[{ value: "Đang chờ", label: "Đang chờ" }, { value: "Đang xử lý", label: "Đang xử lý" }, { value: "Hoàn thành", label: "Hoàn thành" }]} />
                </div>
              </div>

              <section className="rounded-xl border border-[#DCE7F4] bg-[#F8FBFF] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-[#00ADFC]" />
                  <h4 className="text-base font-medium text-slate-800">Thông tin phiếu</h4>
                </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {outboundOnly && (
                  <div className="space-y-1.5 md:col-span-2">
                    <span className="text-sm text-slate-600">Xuất từ kho</span>
                    <StyledSelect ariaLabel="Xuất từ kho" value={sourceWarehouseId} onChange={(warehouseId) => {
                      if (warehouseId === sourceWarehouseId) return;
                      setSourceWarehouseId(warehouseId);
                      setDraftLines((current) => current.map((line) => ({ ...line, unitIdentifiers: [], serialNumbers: [] })));
                      setUnitItemsByLine({}); setUnitPickerItems([]); setUnitPickerIndex(null);
                    }} options={[{ value: "", label: "Chọn kho xuất" }, ...warehouses.map((warehouse) => ({ value: warehouse._id, label: `${warehouse.name}${warehouse.isDefault ? " (mặc định)" : ""}` }))]} />
                    <span className="block text-xs text-slate-500">Chỉ hiển thị SKU còn tồn khả dụng tại kho đã chọn.</span>
                  </div>
                )}
                {draftType === "xuất" && (
                  <div className="space-y-1.5 md:col-span-2">
                    <span className="text-sm text-slate-600">Mục đích xuất kho</span>
                    <StyledSelect
                      ariaLabel="Mục đích xuất kho"
                      value={draftPurpose}
                      onChange={(value) => {
                        setDraftPurpose(value as StockLogPurpose);
                        setDraftCustomerId(undefined);
                        setDraftCustomerName("");
                      }}
                      options={[{ value: "bán", label: "Bán hàng" }, { value: "nội bộ", label: "Sử dụng nội bộ" }, { value: "hủy", label: "Hủy / hàng hỏng" }]}
                    />
                  </div>
                )}
                {draftType === "xuất" && (draftPurpose === "bán" || draftPurpose === "nội bộ") && (
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-sm text-on-surface-variant">{draftPurpose === "nội bộ" ? "Người / bộ phận nhận hàng" : "Khách hàng"}</span>
                    {draftPurpose === "bán" ? (
                      <StockOutCustomerPicker
                        customerId={draftCustomerId}
                        customerName={draftCustomerName}
                        onChange={(next) => {
                          setDraftCustomerId(next.customerId);
                          setDraftCustomerName(next.customerName);
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={draftCustomerName}
                        onChange={(event) => setDraftCustomerName(event.target.value)}
                        required
                        placeholder="Ví dụ: Bộ phận vận hành"
                        className="h-11 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
                      />
                    )}
                  </label>
                )}
                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Tên phiếu</span>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder={draftType === "nhập" ? "Ví dụ: Nhập hàng từ nhà cung cấp A" : "Ví dụ: Xuất kho cho đại lý Hà Nội"}
                    className="h-11 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Người phụ trách</span>
                  <StockOperatorPicker value={draftOperator} onChange={setDraftOperator} />
                </label>
              </div>

              <label className="mt-4 block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Ghi chú</span>
                <textarea
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  placeholder="Mô tả ngắn nội dung phiếu hoặc lưu ý vận hành"
                  rows={3}
                  className="w-full rounded-xl border border-[#DCE7F4] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15"
                />
              </label>
              </section>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Danh sách sản phẩm trong phiếu</h4>
                  <button type="button" onClick={addDraftLine} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    Thêm dòng
                  </button>
                </div>

                {draftType === "nhập" && (
                  <div className="mb-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                    Chưa có sản phẩm cần nhập?
                    <button
                      type="button"
                      onClick={onNavigateToCreateProduct}
                      className="ml-2 font-bold underline underline-offset-2"
                    >
                      Chuyển sang Danh mục để khai báo sản phẩm
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {draftLines.map((line, index) => (
                    <div key={`${index}-${line.productId}-${line.sku || ""}`} className={`grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-slate-50 p-3 ${outboundOnly ? "md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_44px]" : "md:grid-cols-[1fr_140px_44px]"}`}>
                      <div className="space-y-1.5">
                        <span className="text-sm text-slate-600">Sản phẩm</span>
                        <StyledSelect
                          ariaLabel={`Sản phẩm dòng ${index + 1}`}
                          value={line.productId}
                          onChange={(productId) => {
                            if (productId === line.productId) return;
                            const firstVariant = outboundOnly ? warehouseProductGroups.find((group) => group.productId === productId)?.variants[0] : undefined;
                            const firstSku = outboundOnly ? firstVariant?.sku || "" : undefined;
                            setDraftLines((current) => {
                              const duplicateIndex = outboundOnly ? current.findIndex((item, itemIndex) => itemIndex !== index && item.productId === productId && item.sku === firstSku) : -1;
                              if (duplicateIndex < 0) return current.map((item, itemIndex) => itemIndex === index ? { ...item, productId, sku: firstSku, variantId: firstVariant?.variantId, unitIdentifiers: [], serialNumbers: [] } : item);

                              const increment = Math.max(1, Number(line.quantity) || 0);
                              return current
                                .map((item, itemIndex) => itemIndex === duplicateIndex ? { ...item, quantity: String((Number(item.quantity) || 0) + increment) } : item)
                                .filter((_, itemIndex) => itemIndex !== index);
                            });
                          }}
                          options={[
                            { value: "", label: "Chọn sản phẩm" },
                            ...(outboundOnly && line.productId && !warehouseProductGroups.some((group) => group.productId === line.productId) ? [{ value: line.productId, label: `${line.productName || line.sku || "Sản phẩm đã lưu"} (hết tồn)` }] : []),
                            ...(outboundOnly ? warehouseProductGroups.map((product) => ({ value: product.productId, label: product.name })) : selectableProducts.map((product) => ({ value: product.id, label: `${product.name} - ${product.sku} (${formatNumber(product.stock)})` }))),
                          ]}
                        />
                      </div>

                      {outboundOnly && (
                        <div className="space-y-1.5">
                          <span className="text-sm text-slate-600">SKU / biến thể</span>
                          <StyledSelect
                            ariaLabel={`SKU / biến thể dòng ${index + 1}`}
                            value={line.sku || ""}
                            disabled={!line.productId}
                            onChange={(sku) => {
                              if (sku === line.sku) return;
                              const variantId = (warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).find((variant) => variant.sku === sku)?.variantId;
                              setDraftLines((current) => {
                                const duplicateIndex = current.findIndex((item, itemIndex) => itemIndex !== index && item.productId === line.productId && item.sku === sku);
                                if (duplicateIndex < 0) return current.map((item, itemIndex) => itemIndex === index ? { ...item, sku, variantId, unitIdentifiers: [], serialNumbers: [] } : item);

                                const increment = Math.max(1, Number(line.quantity) || 0);
                                return current
                                  .map((item, itemIndex) => itemIndex === duplicateIndex ? { ...item, quantity: String((Number(item.quantity) || 0) + increment) } : item)
                                  .filter((_, itemIndex) => itemIndex !== index);
                              });
                            }}
                            options={[
                              { value: "", label: "Chọn SKU / biến thể" },
                              ...(line.sku && !(warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).some((variant) => variant.sku === line.sku) ? [{ value: line.sku, label: `${line.sku} (hết tồn)` }] : []),
                              ...(warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []).map((variant) => ({ value: variant.sku, label: `${variant.sku}${variant.variantName ? ` - ${variant.variantName}` : ""} (tồn ${formatNumber(variant.quantity - variant.reservedQuantity)})` })),
                            ]}
                          />
                        </div>
                      )}

                      <label className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Số lượng</span>
                        <input
                          type="number"
                          min={1}
                          max={outboundOnly ? Math.max(0, (warehouseProductGroups.find((group) => group.productId === line.productId)?.variants.find((variant) => variant.sku === line.sku)?.quantity || 0) - (warehouseProductGroups.find((group) => group.productId === line.productId)?.variants.find((variant) => variant.sku === line.sku)?.reservedQuantity || 0)) : undefined}
                          value={line.quantity}
                          onChange={(event) => updateDraftLine(index, { ...line, quantity: event.target.value })}
                          placeholder={warehouseProductsLoading && outboundOnly ? "Đang tải tồn kho..." : "0"}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                        />
                        {outboundOnly && line.sku && requiresUnitSelection(line) && <button type="button" onClick={() => void openUnitPicker(index)} className="mt-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900">{line.unitIdentifiers?.length ? `Đã chọn ${line.unitIdentifiers.length} đơn vị` : "Chọn đơn vị hàng"}</button>}
                      </label>

                      <button
                        type="button"
                        onClick={() => removeDraftLine(index)}
                        className="mt-6 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      >
                        <X className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Đóng
                </button>
                <button type="submit" disabled={submitting} className="rounded-xl bg-[#00ADFC] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-60">
                  {submitting ? (editingLogId ? "Đang cập nhật phiếu..." : "Đang tạo phiếu...") : editingLogId ? "Cập nhật phiếu" : "Lưu phiếu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {unitPickerIndex !== null && selectedLineForPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-label="Chọn đơn vị hàng" className="inventory-popup flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_24px_70px_rgba(11,65,99,0.18)]">
            <div className="flex items-start justify-between border-b border-[#E7EFF7] px-5 py-4"><div><h3 className="border-l-[3px] border-[#00ADFC] pl-3 text-lg font-medium text-slate-900">Chọn đơn vị hàng</h3><p className="mt-1 pl-[15px] text-sm text-slate-500">Đã chọn {selectedUnitsForPicker.length} / {requiredUnitCount} đơn vị</p></div><button type="button" aria-label="Đóng chọn đơn vị" onClick={() => setUnitPickerIndex(null)} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600"><X className="h-4 w-4" /></button></div>
            <div className="space-y-3 overflow-y-auto p-5"><input value={unitPickerQuery} onChange={(event) => setUnitPickerQuery(event.target.value)} placeholder="Tìm số sê-ri hoặc mã đơn vị..." className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm" />{unitPickerLoading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải đơn vị tồn kho...</p> : filteredPickerItems.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Không tìm thấy mã đơn vị phù hợp.</p> : <div className="space-y-2">{filteredPickerItems.map((item) => { const value = item.normalizedInternalBarcode; const checked = selectedUnitsForPicker.includes(value); const disabled = !checked && selectedUnitsForPicker.length >= requiredUnitCount; return <label key={item._id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${checked ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-cyan-200"}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => updateDraftLine(unitPickerIndex, { ...selectedLineForPicker, unitIdentifiers: checked ? selectedUnitsForPicker.filter((unit) => unit !== value) : [...selectedUnitsForPicker, value] })} className="h-4 w-4 accent-cyan-700" /><span className="text-sm text-slate-800">{item.internalBarcode}{item.serialNumber ? ` · ${item.serialNumber}` : ""}</span></label>; })}</div>}</div>
            <div className="flex justify-end gap-2 border-t border-[#E7EFF7] px-5 py-4"><button type="button" onClick={() => setUnitPickerIndex(null)} className="rounded-xl border border-[#DCE7F4] px-4 py-2.5 text-sm text-slate-700 hover:bg-[#F5FAFE]">Đóng</button><button type="button" disabled={selectedUnitsForPicker.length !== requiredUnitCount} onClick={() => setUnitPickerIndex(null)} className="rounded-xl bg-[#00ADFC] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0097dc] disabled:cursor-not-allowed disabled:opacity-50">Xác nhận lựa chọn</button></div>
          </div>
        </div>
      )}

      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-label="Chi tiết phiếu kho" className="inventory-popup max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-[#DCE7F4] bg-white p-6 shadow-[0_24px_70px_rgba(11,65,99,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium text-slate-900">{getLogTitle(selectedLog)}</h3>
                <p className="text-sm text-gray-500">
                  {selectedLog.id} • {new Date(selectedLog.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>
              <button type="button" aria-label="Đóng chi tiết" onClick={() => setShowDetailModal(false)} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#DCE7F4] bg-[#F8FBFF] p-4 md:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Loại phiếu</div>
                <div className="mt-1 text-sm text-slate-800">{selectedLog.type === "nhập" ? "Nhập kho" : "Xuất kho"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Phụ trách</div>
                <div className="mt-1 text-sm text-slate-800">{selectedLog.operatorName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Trạng thái</div>
                <div className="mt-1 text-sm text-slate-800">{getLogStatus(selectedLog)}</div>
              </div>
            </div>

            {selectedLog.type === "xuất" ? (
              <section className="mt-4">
                <h4 className="mb-3 text-base font-medium text-slate-800">Hàng xuất</h4>
                <div className="overflow-x-auto rounded-xl border border-[#DCE7F4]">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-[#E8F7FF] text-xs text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3 text-right">SL xuất</th>
                        {detailHasUnits && <th className="px-4 py-3">Số sê-ri / Mã đơn vị</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7EFF7] bg-white">
                      {getLogItems(selectedLog).map((item, index) => (
                        <tr key={`${item.sku}-${index}`}>
                          <td className="px-4 py-3 text-slate-800">{item.productName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.sku}</td>
                          <td className="px-4 py-3 text-right text-rose-600">{formatNumber(item.quantity)}</td>
                          {detailHasUnits && <td className="px-4 py-3 text-sm text-cyan-800">
                            {item.serialNumbers?.length ? item.serialNumbers.join(", ") : item.unitIdentifiers?.length ? <span className="text-slate-600">Mã vạch nội bộ: {item.unitIdentifiers.join(", ")}</span> : <span className="text-slate-400">—</span>}
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <div className="mt-4 space-y-3">
                {getLogItems(selectedLog).map((item, index) => (
                  <div key={`${item.sku}-${index}`} className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3">
                    <div>
                      <div className="font-bold text-slate-800">{item.productName}</div>
                      <div className="mt-1 text-xs text-gray-500">Mã sản phẩm: {item.sku}</div>
                      {item.serialNumbers?.length ? <div className="mt-1 text-xs text-cyan-700">Số sê-ri: {item.serialNumbers.join(", ")}</div> : null}
                      {item.unitIdentifiers?.length ? <div className="mt-1 text-xs text-slate-500">Mã vạch nội bộ: {item.unitIdentifiers.join(", ")}</div> : null}
                    </div>
                    <div className="text-lg font-bold text-emerald-600">+{formatNumber(item.quantity)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-xl border border-[#DCE7F4] p-4 text-sm text-slate-600">
              <div className="font-medium text-slate-800">Ghi chú</div>
              <div className="mt-1">{selectedLog.notes || "Không có ghi chú bổ sung."}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
