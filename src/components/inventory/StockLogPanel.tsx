import React, { useEffect, useMemo, useState } from "react";
import { ProductItem, StockLog, StockLogPurpose } from "../../types";
import {
  inventoryReceivingService,
  type InventoryBalance,
  type Warehouse,
} from "../../services/inventoryReceivingService";
import {
  inventorySerialService,
  type InventorySerialUnit,
} from "../../services/inventorySerialService";
import { toast } from "../../pages/Toast";
import { parseFirebaseError } from "../../utils/firebaseErrorParser";

import {
  DatePreset,
  DraftLine,
  DraftPayload,
  getLogItems,
  getLogStatus,
  getLogTitle,
  getStatusKey,
  getTypeKey,
  isLogWithinDateRange,
  isPosSalesLog,
  lineUnitKey,
  StockLogStatsData,
  TransactionStatus,
} from "./stock-log/stockLogUtils";
import { StockLogStats } from "./stock-log/StockLogStats";
import { StockLogFilters } from "./stock-log/StockLogFilters";
import { StockLogTable } from "./stock-log/StockLogTable";
import { StockLogDetailModal } from "./stock-log/StockLogDetailModal";
import { StockLogCreateModal } from "./stock-log/StockLogCreateModal";

export type { DraftPayload, TransactionStatus, DraftLine };

export type StockLogPanelProps = {
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
};

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
}: StockLogPanelProps) {
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<StockLog | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Form draft states
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

  // Filter states
  const [typeFilter, setTypeFilter] = useState<"all" | "inbound" | "outbound" | "pos">(
    outboundOnly ? "outbound" : "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "processing" | "completed">("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Warehouses & Balances for outbound line creation
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [warehouseBalances, setWarehouseBalances] = useState<InventoryBalance[]>([]);
  const [warehouseProductsLoading, setWarehouseProductsLoading] = useState(false);

  // Unit / Serial Picker states
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
          : true
      ),
    [unitPickerItems, unitPickerQueryNormalized]
  );

  useEffect(() => {
    let active = true;
    const loadWarehouses = async () => {
      setWarehouseProductsLoading(true);
      try {
        const nextWarehouses = await inventoryReceivingService.listWarehouses();
        if (!active) return;
        setWarehouses(nextWarehouses);
        if (outboundOnly) {
          setSourceWarehouseId((current) =>
            current && nextWarehouses.some((warehouse) => warehouse._id === current)
              ? current
              : nextWarehouses.find((warehouse) => warehouse.isDefault)?._id || nextWarehouses[0]?._id || ""
          );
        }
      } catch {
        if (active) {
          setWarehouses([]);
          setSourceWarehouseId("");
        }
      } finally {
        if (active) setWarehouseProductsLoading(false);
      }
    };
    void loadWarehouses();
    return () => {
      active = false;
    };
  }, [outboundOnly]);

  useEffect(() => {
    if (!outboundOnly || !sourceWarehouseId) {
      setWarehouseBalances([]);
      return;
    }
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
    return () => {
      active = false;
    };
  }, [outboundOnly, sourceWarehouseId]);

  const selectableProducts = useMemo(() => {
    if (!outboundOnly) return products;
    const availableBySku = new Map(
      warehouseBalances
        .filter((balance) => balance.quantity - balance.reservedQuantity > 0)
        .map((balance) => [balance.sku, balance])
    );
    const legacyProductsInWarehouse = products
      .filter((product) => availableBySku.has(product.sku))
      .map((product) => ({
        ...product,
        stock: Math.max(
          0,
          (availableBySku.get(product.sku)?.quantity || 0) -
            (availableBySku.get(product.sku)?.reservedQuantity || 0)
        ),
      }));
    if (legacyProductsInWarehouse.length > 0) return legacyProductsInWarehouse;

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
        const current = groups.get(balance.productId) || {
          productId: balance.productId,
          name: balance.productName || balance.sku,
          variants: [],
        };
        current.variants.push(balance);
        groups.set(balance.productId, current);
      });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [warehouseBalances]);

  // Overall KPI stats (including POS and filtered by time window if active)
  const kpiStats = useMemo<StockLogStatsData>(() => {
    let inboundCount = 0;
    let inboundQty = 0;
    let outboundCount = 0;
    let outboundQty = 0;
    let posSalesCount = 0;
    let posSalesQty = 0;
    let pendingCount = 0;

    const baseLogs =
      datePreset !== "all" || startDate || endDate
        ? stockLogs.filter((log) => isLogWithinDateRange(log.createdAt, datePreset, startDate, endDate))
        : stockLogs;

    for (const log of baseLogs) {
      const items = getLogItems(log);
      const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      const isOutbound = getTypeKey(log.type) === "outbound";
      const isPos = isPosSalesLog(log);

      if (isOutbound) {
        outboundCount += 1;
        outboundQty += totalQty;
        if (isPos) {
          posSalesCount += 1;
          posSalesQty += totalQty;
        }
      } else {
        inboundCount += 1;
        inboundQty += totalQty;
      }

      const statusKey = getStatusKey(getLogStatus(log));
      if (statusKey === "pending" || statusKey === "processing") {
        pendingCount += 1;
      }
    }

    return {
      total: baseLogs.length,
      inboundCount,
      inboundQty,
      outboundCount,
      outboundQty,
      posSalesCount,
      posSalesQty,
      pendingCount,
    };
  }, [stockLogs, datePreset, startDate, endDate]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return stockLogs.filter((log) => {
      const keyword = searchLog.trim().toLowerCase();
      const items = getLogItems(log);
      const itemText = items
        .map(
          (item) =>
            `${item.productName} ${item.sku} ${(item.serialNumbers || []).join(" ")} ${(
              item.unitIdentifiers || []
            ).join(" ")}`
        )
        .join(" ")
        .toLowerCase();

      let matchesType = true;
      if (outboundOnly) {
        matchesType = getTypeKey(log.type) === "outbound";
      } else if (typeFilter === "inbound") {
        matchesType = getTypeKey(log.type) === "inbound";
      } else if (typeFilter === "outbound") {
        matchesType = getTypeKey(log.type) === "outbound";
      } else if (typeFilter === "pos") {
        matchesType = isPosSalesLog(log);
      }

      const matchesStatus =
        statusFilter === "all" || getStatusKey(getLogStatus(log)) === statusFilter;

      const matchesKeyword =
        !keyword ||
        log.id.toLowerCase().includes(keyword) ||
        getLogTitle(log).toLowerCase().includes(keyword) ||
        (log.operatorName && log.operatorName.toLowerCase().includes(keyword)) ||
        (log.notes && log.notes.toLowerCase().includes(keyword)) ||
        ((log as any).customerName && String((log as any).customerName).toLowerCase().includes(keyword)) ||
        itemText.includes(keyword);

      const matchesDate = isLogWithinDateRange(log.createdAt, datePreset, startDate, endDate);

      return matchesType && matchesStatus && matchesKeyword && matchesDate;
    });
  }, [outboundOnly, searchLog, statusFilter, stockLogs, typeFilter, datePreset, startDate, endDate]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchLog, typeFilter, statusFilter, datePreset, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

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
    setDraftLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const quantity = Math.max(0, Number(nextLine.quantity) || 0);
        return { ...nextLine, unitIdentifiers: nextLine.unitIdentifiers?.slice(0, quantity) };
      })
    );
  };

  const removeDraftLine = (index: number) => {
    setDraftLines((current) =>
      current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)
    );
  };

  const openUnitPicker = async (index: number) => {
    const line = draftLines[index];
    if (!line?.productId || !line.sku) return;
    setUnitPickerIndex(index);
    setUnitPickerQuery("");
    setUnitPickerLoading(true);
    try {
      const knownVariant = (
        warehouseProductGroups.find((group) => group.productId === line.productId)?.variants || []
      ).some((variant) => variant.sku === line.sku);
      const result = await inventorySerialService.list({
        productId: line.productId,
        ...(knownVariant ? { sku: line.sku } : {}),
        status: "in_stock",
        barcodes: line.unitIdentifiers,
        limit: 100,
      });
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

    if (outboundOnly) {
      const invalidLine = draftLines.find((line, index) => {
        const availableUnits = unitItemsByLine[index];
        return (
          availableUnits?.length > 0 &&
          (line.unitIdentifiers?.length || 0) !== Number(line.quantity)
        );
      });
      if (invalidLine) {
        toast.error("Vui lòng chọn đủ IMEI / mã vạch cho từng sản phẩm quản lý theo đơn vị.");
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
            const selected =
              line.unitIdentifiers
                ?.map(
                  (identifier) =>
                    unitItemsByLine[lineUnitKey(line)]?.find(
                      (unit) => unit.normalizedInternalBarcode === identifier
                    )?.serialNumber
                )
                .filter(Boolean) || [];
            return selected.length ? selected : line.serialNumbers;
          })(),
        };
      })
      .filter(
        (line, index) =>
          line.productId &&
          (!outboundOnly || Boolean(draftLines[index]?.sku)) &&
          Number.isFinite(line.quantity) &&
          line.quantity > 0
      );

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
      customerName:
        draftType === "xuất" && (draftPurpose === "bán" || draftPurpose === "chuyển kho")
          ? draftCustomerName.trim()
          : undefined,
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

  const handleUpdateStatus = async (logId: string, nextStatus: TransactionStatus) => {
    if (!onUpdateStatus) return;
    try {
      setStatusUpdatingId(logId);
      await onUpdateStatus(logId, nextStatus);
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái:", error);
      toast.error(parseFirebaseError(error, "Không thể cập nhật trạng thái."));
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const resetFilters = () => {
    setSearchLog("");
    if (!outboundOnly) setTypeFilter("all");
    setStatusFilter("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters =
    Boolean(searchLog) ||
    typeFilter !== (outboundOnly ? "outbound" : "all") ||
    statusFilter !== "all" ||
    datePreset !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div className="space-y-5" id="stock_transactions_list">
      {/* ── KPI Strip ── */}
      <StockLogStats
        stats={kpiStats}
        activeTypeFilter={typeFilter}
        onSelectTypeFilter={(t) => {
          setTypeFilter(t);
          setCurrentPage(1);
        }}
        activeStatusFilter={statusFilter}
        onSelectStatusFilter={(s) => {
          setStatusFilter(s);
          setCurrentPage(1);
        }}
      />

      {/* ── Filter Bar ── */}
      <StockLogFilters
        searchLog={searchLog}
        setSearchLog={setSearchLog}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        stats={kpiStats}
        outboundOnly={outboundOnly}
        readOnly={readOnly}
        hideExcelActions={hideExcelActions}
        isImporting={isImporting}
        onImportExcel={onImportExcel}
        onExportExcel={onExportExcel}
        onOpenCreateModal={openCreateModal}
      />

      {/* ── Table & Pagination ── */}
      <StockLogTable
        logs={filteredLogs}
        paginatedLogs={paginatedLogs}
        isLoading={isLoading}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        statusUpdatingId={statusUpdatingId}
        readOnly={readOnly}
        onSelectLog={(log) => {
          setSelectedLog(log);
          setShowDetailModal(true);
        }}
        onEditLog={openEditModal}
        onDeleteLog={onDeleteTransaction}
        onUpdateStatus={handleUpdateStatus}
        onResetFilters={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* ── Detail Modal ── */}
      {showDetailModal && selectedLog && (
        <StockLogDetailModal
          log={selectedLog}
          warehouses={warehouses}
          onClose={() => setShowDetailModal(false)}
          onEdit={() => {
            setShowDetailModal(false);
            openEditModal(selectedLog);
          }}
        />
      )}

      {/* ── Create / Edit Modal ── */}
      <StockLogCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        editingLogId={editingLogId}
        outboundOnly={outboundOnly}
        selectableProducts={selectableProducts}
        warehouseProductGroups={warehouseProductGroups}
        warehouses={warehouses}
        sourceWarehouseId={sourceWarehouseId}
        setSourceWarehouseId={setSourceWarehouseId}
        warehouseProductsLoading={warehouseProductsLoading}
        draftType={draftType}
        setDraftType={setDraftType}
        draftPurpose={draftPurpose}
        setDraftPurpose={setDraftPurpose}
        draftCustomerId={draftCustomerId}
        setDraftCustomerId={setDraftCustomerId}
        draftCustomerName={draftCustomerName}
        setDraftCustomerName={setDraftCustomerName}
        draftTitle={draftTitle}
        setDraftTitle={setDraftTitle}
        draftOperator={draftOperator}
        setDraftOperator={setDraftOperator}
        draftNotes={draftNotes}
        setDraftNotes={setDraftNotes}
        draftStatus={draftStatus}
        setDraftStatus={setDraftStatus}
        draftLines={draftLines}
        submitting={submitting}
        onSubmit={submitDraft}
        onNavigateToCreateProduct={onNavigateToCreateProduct}
        onAddDraftLine={addDraftLine}
        onUpdateDraftLine={updateDraftLine}
        onRemoveDraftLine={removeDraftLine}
        onOpenUnitPicker={openUnitPicker}
        unitPickerIndex={unitPickerIndex}
        setUnitPickerIndex={setUnitPickerIndex}
        unitPickerQuery={unitPickerQuery}
        setUnitPickerQuery={setUnitPickerQuery}
        unitPickerLoading={unitPickerLoading}
        unitPickerItems={unitPickerItems}
        filteredPickerItems={filteredPickerItems}
        selectedUnitsForPicker={selectedUnitsForPicker}
        requiredUnitCount={requiredUnitCount}
      />
    </div>
  );
}
