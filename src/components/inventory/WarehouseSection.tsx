import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  inventoryReceivingService,
  type InventoryBalance,
  type Warehouse,
} from "../../services/inventoryReceivingService";
import { toast } from "../../pages/Toast";
import { Dropdown, type DropdownOption } from "../common/Dropdown";
import { TableFilterToolbar } from "../common/TableFilterToolbar";
import { MetricBar } from "../common/MetricBar";
import { InventoryCountingModal } from "./InventoryCountingSection";
import { WarehouseSerialDetailModal } from "./WarehouseSerialDetailModal";
import { useBranch } from "../../context/BranchContext";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { tiktokShopApi, type TikTokShopStatus } from "../../services/tiktokShopService";
import TikTokProductPublishDialog from "../settings/TikTokProductPublishDialog";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Math.round(value || 0)) + " ₫";
const number = (value: number) => Number(value || 0).toLocaleString("vi-VN");

type ProductBalanceGroup = {
  productId: string;
  productName: string;
  productMediaUrl?: string;
  items: InventoryBalance[];
  quantity: number;
  reservedQuantity: number;
  value: number;
};

type StockFilterType = "all" | "in_stock" | "low_stock" | "out_of_stock";

export function WarehouseSection() {
  const { activeBranchId } = useBranch();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilterType>("all");
  const [page, setPage] = useState(1);
  const [countingOpen, setCountingOpen] = useState(false);
  const [detailBalance, setDetailBalance] = useState<InventoryBalance | null>(null);
  const [thresholdBalance, setThresholdBalance] = useState<InventoryBalance | null>(null);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<TikTokShopStatus | null>(null);
  const [tiktokBusy, setTiktokBusy] = useState("");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const pageSize = 12;

  // Load warehouses & initial balances
  const load = async () => {
    setLoading(true);
    try {
      const nextWarehouses = await inventoryReceivingService.listWarehouses();
      setWarehouses(nextWarehouses);
      const selected = warehouseId && nextWarehouses.some((item) => item._id === warehouseId)
        ? warehouseId
        : nextWarehouses[0]?._id || "";
      setWarehouseId(selected);
      if (selected) {
        setBalances(await inventoryReceivingService.listBalances(selected, true));
      } else {
        setBalances(await inventoryReceivingService.listBalances(undefined, true));
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải số dư kho.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const loadTikTokStatus = useCallback(async () => {
    setTiktokStatus(await tiktokShopApi.status());
  }, []);

  useEffect(() => {
    void loadTikTokStatus().catch((error) => toast.error(getApiErrorMessage(error, "Không thể tải trạng thái TikTok Shop.")));
  }, [loadTikTokStatus]);

  const runTikTokAction = async (name: string, action: () => Promise<void>) => {
    setTiktokBusy(name);
    try {
      await action();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xử lý yêu cầu TikTok Shop."));
    } finally {
      setTiktokBusy("");
    }
  };

  const syncTikTokProducts = () => runTikTokAction("sync", async () => {
    const result = await tiktokShopApi.syncProducts();
    const summary = `Đã đồng bộ ${result.total} sản phẩm; ghép được ${result.matched} sản phẩm với SKU nội bộ. Chi tiết: đủ ${result.complete}, thiếu ${result.incomplete}, lỗi tải ${result.detailFailed}.`;
    if (result.detailFailed || result.incomplete) toast.error(summary);
    else toast.success(summary);
  });

  const importTikTokProducts = () => runTikTokAction("import", async () => {
    const result = await tiktokShopApi.importProducts(activeBranchId || undefined);
    const summary = `Đã tạo ${result.createdProducts} sản phẩm, ${result.createdVariants} SKU và nhập ${result.importedStock} đơn vị tồn kho.`;
    if (result.failed) toast.error(`${summary} Có ${result.failed} sản phẩm lỗi. ${result.errors[0] || ""}`.trim());
    else toast.success(summary);
    await load();
  });

  const pushTikTokInventoryAndPrices = () => runTikTokAction("push", async () => {
    const result = await tiktokShopApi.syncInventoryAndPrices(activeBranchId || undefined);
    if (result.failed) toast.error(`Đã cập nhật ${result.updated} SKU; ${result.failed} SKU lỗi. Xem chi tiết trong danh sách.`);
    else if (result.pendingReviewSkipped) toast.success(`Đã đẩy giá và tồn kho của ${result.updated} SKU; bỏ qua ${result.pendingReviewSkipped} SKU đang chờ TikTok Shop duyệt.`);
    else toast.success(`Đã đẩy giá và tồn kho của ${result.updated} SKU lên TikTok Shop.`);
  });

  useEffect(() => {
    if (warehouseId) {
      setLoading(true);
      inventoryReceivingService
        .listBalances(warehouseId, true)
        .then(setBalances)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  }, [warehouseId]);

  // Overall KPI Metrics across all balances in this warehouse
  const totalStockUnits = useMemo(
    () => balances.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [balances]
  );
  const totalReservedUnits = useMemo(
    () => balances.reduce((sum, item) => sum + (Number(item.reservedQuantity) || 0), 0),
    [balances]
  );
  const totalAvailableUnits = Math.max(0, totalStockUnits - totalReservedUnits);

  const totalInventoryValue = useMemo(
    () => balances.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.averageCost) || 0)), 0),
    [balances]
  );

  // Group balances by Product ID
  const allGroups = useMemo<ProductBalanceGroup[]>(() => {
    const map: Record<string, ProductBalanceGroup> = {};
    for (const item of balances) {
      const pId = item.productId || item.sku;
      if (!map[pId]) {
        map[pId] = {
          productId: pId,
          productName: item.productName || "Sản phẩm không tên",
          productMediaUrl: item.productMediaUrl,
          items: [],
          quantity: 0,
          reservedQuantity: 0,
          value: 0,
        };
      }
      map[pId].items.push(item);
      map[pId].quantity += item.quantity || 0;
      map[pId].reservedQuantity += item.reservedQuantity || 0;
      map[pId].value += (item.quantity || 0) * (item.averageCost || 0);
    }
    return Object.values(map);
  }, [balances]);

  // Alert counts
  const alertStats = useMemo(() => {
    let outCount = 0;
    let lowCount = 0;
    balances.forEach((item) => {
      const avail = Math.max(0, item.quantity - item.reservedQuantity);
      const min = Number(item.minStock || 0);
      if (avail === 0 && (item.hasMovementHistory || item.quantity > 0 || item.reservedQuantity > 0)) outCount++;
      else if (min > 0 && avail < min) lowCount++;
    });
    return { outCount, lowCount, warningCount: outCount + lowCount };
  }, [balances]);

  // Filter groups and items
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allGroups
      .map((group) => {
        // Filter items within group
        const matchedItems = group.items.filter((item) => {
          const avail = Math.max(0, item.quantity - item.reservedQuantity);
          const min = Number(item.minStock || 0);

          // Stock level filter
          if (stockFilter === "in_stock" && avail <= 0) return false;
          if (stockFilter === "low_stock" && (avail === 0 || min <= 0 || avail >= min)) return false;
          if (stockFilter === "out_of_stock" && (avail > 0 || (!item.hasMovementHistory && item.quantity === 0))) return false;

          // Search term filter
          if (q) {
            const matchName = (item.productName || "").toLowerCase().includes(q);
            const matchSku = (item.sku || "").toLowerCase().includes(q);
            const matchVariant = (item.variantName || "").toLowerCase().includes(q);
            return matchName || matchSku || matchVariant;
          }

          return true;
        });

        if (matchedItems.length === 0) return null;

        const subQuantity = matchedItems.reduce((s, i) => s + i.quantity, 0);
        const subReserved = matchedItems.reduce((s, i) => s + i.reservedQuantity, 0);
        const subValue = matchedItems.reduce((s, i) => s + (i.quantity * i.averageCost), 0);

        return {
          ...group,
          items: matchedItems,
          quantity: subQuantity,
          reservedQuantity: subReserved,
          value: subValue,
        };
      })
      .filter((g): g is ProductBalanceGroup => g !== null);
  }, [allGroups, searchQuery, stockFilter]);

  // Auto-expand all when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedProductIds(filteredGroups.map((g) => g.productId));
    }
  }, [searchQuery, filteredGroups]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleGroup = (id: string) => {
    setExpandedProductIds((curr) =>
      curr.includes(id) ? curr.filter((item) => item !== id) : [...curr, id]
    );
  };

  const expandAll = () => {
    setExpandedProductIds(filteredGroups.map((g) => g.productId));
  };

  const collapseAll = () => {
    setExpandedProductIds([]);
  };

  const currentWarehouse = warehouses.find((w) => w._id === warehouseId);
  const warehouseName = (id: string) => warehouses.find((w) => w._id === id)?.name || id;

  const warehouseOptions: DropdownOption<string>[] = useMemo(() => {
    return warehouses.map((w) => ({
      value: w._id,
      label: `${w.name}${w.isDefault ? " (Mặc định)" : ""}`,
      sublabel: `Mã kho: ${w.code}`,
    }));
  }, [warehouses]);

  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku);
    setCopiedSku(sku);
    toast.success(`Đã sao chép mã SKU: ${sku}`);
    setTimeout(() => setCopiedSku(null), 2000);
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (balances.length === 0) {
      toast.info("Không có dữ liệu tồn kho để xuất.");
      return;
    }
    const headers = [
      "Tên sản phẩm",
      "Mã SKU",
      "Biến thể",
      "Kho hàng",
      "Tồn thực tế",
      "Khả dụng",
      "Đang giữ",
      "Giá vốn bình quân",
      "Tổng giá trị tồn",
      "Tồn tối thiểu",
      "Tồn tối đa",
    ];
    const rows = balances.map((b) => [
      `"${(b.productName || "").replace(/"/g, '""')}"`,
      `"${b.sku}"`,
      `"${(b.variantName || "").replace(/"/g, '""')}"`,
      `"${warehouseName(b.warehouseId)}"`,
      b.quantity,
      Math.max(0, b.quantity - b.reservedQuantity),
      b.reservedQuantity,
      b.averageCost,
      b.quantity * b.averageCost,
      b.minStock ?? "",
      b.maxStock ?? "",
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Bao_cao_ton_kho_${currentWarehouse?.code || "MAIN"}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã xuất file báo cáo tồn kho CSV thành công!");
  };

  // Update threshold
  const handleSaveThreshold = async (balance: InventoryBalance, minStock: number, maxStock?: number) => {
    try {
      await inventoryReceivingService.updateBalanceThresholds(balance._id, { minStock, maxStock });
      setBalances((current) =>
        current.map((item) =>
          item._id === balance._id
            ? { ...item, minStock, ...(maxStock === undefined ? { maxStock: undefined } : { maxStock }) }
            : item
        )
      );
      toast.success(`Đã cập nhật định mức tồn kho cho SKU ${balance.sku}`);
      setThresholdBalance(null);
    } catch (error: any) {
      toast.error(error?.message || "Không thể cập nhật định mức tồn kho.");
      throw error;
    }
  };

  return (
    <section className="space-y-4" aria-label="Kho hàng và Quản lý Tồn kho">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Kho hàng & Số dư tồn kho
            </h3>
            {currentWarehouse && (
              <span className="font-mono text-[11px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                {currentWarehouse.code}
              </span>
            )}
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Warehouse Selector using common Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold text-xs select-none">Kho:</span>
            <Dropdown<string>
              aria-label="Chọn kho lưu trữ"
              value={warehouseId}
              onChange={(val) => setWarehouseId(val)}
              options={warehouseOptions}
              placeholder="Chọn kho..."
              variant="default"
              size="sm"
              triggerClassName="min-w-[190px] max-w-[280px] justify-between font-bold text-slate-800 border-slate-200 shadow-2xs rounded-lg py-1.5"
            />
          </div>

          <button
            type="button"
            disabled={!warehouseId}
            onClick={() => setCountingOpen(true)}
            className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs hover:opacity-90 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
            title={warehouseId ? "Mở kiểm kê kho thực tế" : "Vui lòng chọn kho"}
          >
            Kiểm kê kho
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={balances.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap disabled:opacity-40"
          >
            Xuất Excel
          </button>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs whitespace-nowrap"
            title="Tải lại số dư kho"
          >
            Làm mới
          </button>
        </div>
      </div>

      {tiktokStatus?.connected && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
          <span className="mr-1 text-xs font-bold text-slate-600">TikTok Shop</span>
          <button type="button" disabled={Boolean(tiktokBusy)} onClick={() => void syncTikTokProducts()} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            {tiktokBusy === "sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Đồng bộ sản phẩm
          </button>
          <button type="button" disabled={Boolean(tiktokBusy) || !activeBranchId} onClick={() => void importTikTokProducts()} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50">
            {tiktokBusy === "import" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Nhập vào kho
          </button>
          <button type="button" disabled={Boolean(tiktokBusy)} onClick={() => setPublishDialogOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-700 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Đăng sản phẩm mới
          </button>
          <button type="button" disabled={Boolean(tiktokBusy) || !activeBranchId} onClick={() => void pushTikTokInventoryAndPrices()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {tiktokBusy === "push" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Đẩy giá & tồn kho
          </button>
        </div>
      )}

      {publishDialogOpen && tiktokStatus?.connected && (
        <TikTokProductPublishDialog connections={tiktokStatus.connections} onClose={() => setPublishDialogOpen(false)} onPublished={loadTikTokStatus} />
      )}

      {/* 2. Compact Sleek Metric Bar */}
      <MetricBar
        items={[
          {
            label: "Tổng giá trị tồn kho",
            value: money(totalInventoryValue),
            subtext: "Giá vốn bình quân",
          },
          {
            label: "Tổng số lượng tồn",
            value: number(totalStockUnits),
            unit: "máy",
            valueClassName: "text-cyan-800",
            subtext: (
              <>
                Khả dụng: <b className="text-emerald-700">{number(totalAvailableUnits)}</b> · Giữ: <b>{number(totalReservedUnits)}</b>
              </>
            ),
          },
          {
            label: "Quy mô mặt hàng",
            value: allGroups.length,
            unit: "dòng máy",
            subtext: (
              <>
                Phân bổ trên <b>{balances.length} SKU</b> biến thể
              </>
            ),
          },
          {
            label: "Định mức tồn an toàn",
            value: alertStats.warningCount > 0 ? `${alertStats.warningCount} SKU cần bù` : "An toàn định mức",
            tone: "amber",
            valueClassName: alertStats.warningCount > 0 ? "text-amber-700" : "text-emerald-700",
            subtext: alertStats.outCount > 0
              ? `Hết: ${alertStats.outCount} · Sắp hết: ${alertStats.lowCount}`
              : "Không có SKU dưới mức tối thiểu",
            isActive: stockFilter === "low_stock",
            onClick: alertStats.warningCount > 0
              ? () => setStockFilter((curr) => (curr === "low_stock" ? "all" : "low_stock"))
              : undefined,
          },
        ]}
      />

      {/* 3. Search Bar & Filter Strip */}
      <TableFilterToolbar
        search={{
          value: searchQuery,
          onChange: (val) => {
            setSearchQuery(val);
            setPage(1);
          },
          placeholder: "Tìm theo tên máy, mã SKU, biến thể (16pro, 128GB, Titan, Đen)...",
          ariaLabel: "Tìm kiếm tồn kho",
        }}
        totalCount={filteredGroups.length}
        countLabel="dòng máy"
        hasActiveFilters={Boolean(searchQuery || stockFilter !== "all")}
        onResetFilters={() => {
          setSearchQuery("");
          setStockFilter("all");
          setPage(1);
        }}
        actions={
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:text-primary transition-colors cursor-pointer"
              title="Mở rộng tất cả dòng biến thể"
            >
              Mở tất cả
            </button>
            <span className="text-outline-variant">|</span>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:text-primary transition-colors cursor-pointer"
              title="Thu gọn các dòng"
            >
              Thu gọn
            </button>
          </div>
        }
      >
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "all", label: `Tất cả (${balances.length})` },
            { id: "in_stock", label: `Còn hàng (${balances.filter((b) => b.quantity > 0).length})` },
            { id: "low_stock", label: `Sắp hết (${alertStats.lowCount})` },
            { id: "out_of_stock", label: `Hết hàng (${alertStats.outCount})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => {
                setStockFilter(pill.id as StockFilterType);
                setPage(1);
              }}
              className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                stockFilter === pill.id
                  ? "bg-primary text-on-primary font-bold shadow-xs"
                  : "text-on-surface-variant hover:bg-surface hover:text-primary border border-outline-variant bg-surface-container-lowest"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </TableFilterToolbar>

      {/* 4. Main Inventory Stock Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-[36%] px-4 py-3.5">Sản phẩm & Biến thể SKU</th>
                <th className="w-[18%] px-4 py-3.5">Kho lưu trữ</th>
                <th className="w-[12%] px-4 py-3.5 text-right">Tồn thực tế</th>
                <th className="w-[14%] px-4 py-3.5 text-right">Giá vốn BQ</th>
                <th className="w-[14%] px-4 py-3.5 text-right">Tổng giá trị</th>
                <th className="w-[6%] px-4 py-3.5 text-center">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                    <p className="font-semibold text-sm">Đang tải số dư tồn kho...</p>
                  </td>
                </tr>
              ) : pageGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Không tìm thấy sản phẩm nào phù hợp</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery || stockFilter !== "all"
                        ? "Thử xóa bộ lọc hoặc tìm với từ khóa khác."
                        : "Kho hiện chưa có sản phẩm nào được nhập vào."}
                    </p>
                  </td>
                </tr>
              ) : (
                pageGroups.map((group) => {
                  const isExpanded = expandedProductIds.includes(group.productId);
                  const averageCost = group.quantity ? group.value / group.quantity : 0;
                  const warehouseLabel = warehouseName(group.items[0]?.warehouseId || warehouseId);

                  return (
                    <React.Fragment key={group.productId}>
                      {/* Parent Product Row */}
                      <tr className="hover:bg-slate-50/80 transition-colors bg-white font-medium">
                        {/* Column 1: Product Name & Toggle */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.productId)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-300 bg-white font-mono text-xs font-bold text-slate-600 hover:border-cyan-600 hover:text-cyan-800 transition-colors"
                              title={isExpanded ? "Thu gọn biến thể" : "Xem các biến thể SKU"}
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>

                            <ProductAvatar name={group.productName} url={group.productMediaUrl} size="md" />

                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm truncate" title={group.productName}>
                                {group.productName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-semibold text-[11px] text-cyan-800 bg-cyan-50 px-2 py-0.2 rounded border border-cyan-200">
                                  {group.items.length} SKU / biến thể
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Column 2: Warehouse Name */}
                        <td className="px-4 py-3.5 text-xs text-slate-700">
                          <p className="font-semibold text-slate-800">{warehouseLabel}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Kho lưu trữ chính</p>
                        </td>

                        {/* Column 3: Quantity */}
                        <td className="px-4 py-3.5 text-right tabular-nums">
                          <span className="text-sm font-bold text-slate-900">
                            {number(group.quantity)}
                          </span>
                          <span className="text-xs text-slate-500 font-normal ml-1">máy</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Khả dụng: <b>{number(Math.max(0, group.quantity - group.reservedQuantity))}</b>
                          </p>
                        </td>

                        {/* Column 4: Average Cost */}
                        <td className="px-4 py-3.5 text-right tabular-nums font-mono text-xs font-medium text-slate-700">
                          {money(averageCost)}
                        </td>

                        {/* Column 5: Total Value */}
                        <td className="px-4 py-3.5 text-right tabular-nums font-mono text-sm font-bold text-slate-900">
                          {money(group.value)}
                        </td>

                        {/* Column 6: Action */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.productId)}
                            className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs whitespace-nowrap"
                          >
                            {isExpanded ? "Đóng" : "Chi tiết"}
                          </button>
                        </td>
                      </tr>

                      {/* Subrows: Variants / SKUs */}
                      {isExpanded &&
                        group.items.map((item, itemIdx) => {
                          const itemAvail = Math.max(0, item.quantity - item.reservedQuantity);
                          const itemTotalValue = item.quantity * item.averageCost;
                          const minStock = Number(item.minStock || 0);
                          const isLow = minStock > 0 && itemAvail < minStock;
                          const isOut = itemAvail <= 0;

                          return (
                            <tr
                              key={item._id || `${group.productId}-${itemIdx}`}
                              className="bg-slate-50/70 border-t border-slate-100 hover:bg-slate-100/70 transition-colors text-xs"
                            >
                              {/* Variant Details */}
                              <td className="py-2.5 pl-12 pr-4">
                                <div className="flex items-start gap-2.5">
                                  <span className="text-slate-300 font-mono mt-0.5 select-none font-bold">
                                    ↳
                                  </span>

                                  <ProductAvatar name={item.sku} url={item.variantMediaUrl} size="sm" />

                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-xs truncate">
                                      {item.variantName || "Biến thể tiêu chuẩn"}
                                    </p>

                                    <div className="flex items-center gap-2 mt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleCopySku(item.sku)}
                                        className="font-mono text-[11px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 hover:border-cyan-600 hover:text-cyan-800 transition-colors"
                                        title="Click để sao chép mã SKU"
                                      >
                                        {copiedSku === item.sku ? "Đã chép SKU" : item.sku}
                                      </button>

                                      {!item.hasMovementHistory && item.quantity === 0 ? (
                                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                                          Chưa nhập
                                        </span>
                                      ) : !item.hasMovementHistory && item.quantity > 0 ? (
                                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                          Tồn đầu kỳ
                                        </span>
                                      ) : isOut && item.quantity > 0 ? (
                                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                          Đang giữ hết
                                        </span>
                                      ) : isOut ? (
                                        <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                          Hết hàng
                                        </span>
                                      ) : isLow ? (
                                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                          Sắp hết (Dưới {minStock})
                                        </span>
                                      ) : (
                                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                          Đủ tồn
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Warehouse and Threshold info */}
                              <td className="px-4 py-2.5 text-slate-600">
                                <button
                                  type="button"
                                  onClick={() => setThresholdBalance(item)}
                                  className="text-[11px] text-slate-500 hover:text-cyan-800 hover:underline"
                                  title="Bấm để chỉnh ngưỡng tồn an toàn"
                                >
                                  Định mức: <b>{item.minStock ?? 0}</b> min /{" "}
                                  <b>{item.maxStock ?? "∞"}</b> max
                                </button>
                              </td>

                              {/* Variant Quantity */}
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                <span className={`font-bold text-xs ${isOut ? "text-rose-600" : "text-slate-900"}`}>
                                  {number(item.quantity)} máy
                                </span>
                                {item.reservedQuantity > 0 && (
                                  <p className="text-[10px] text-amber-700 font-medium">
                                    Giữ: {number(item.reservedQuantity)}
                                  </p>
                                )}
                              </td>

                              {/* Unit Cost */}
                              <td className="px-4 py-2.5 text-right tabular-nums font-mono text-slate-700">
                                {money(item.averageCost)}
                              </td>

                              {/* Line Value */}
                              <td className="px-4 py-2.5 text-right tabular-nums font-mono font-bold text-slate-900">
                                {money(itemTotalValue)}
                              </td>

                              {/* Subrow Actions */}
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* View IMEI */}
                                  <button
                                    type="button"
                                    onClick={() => setDetailBalance(item)}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors shadow-2xs whitespace-nowrap"
                                    title="Xem danh sách các mã IMEI/serial của SKU này"
                                  >
                                    Xem IMEI
                                  </button>

                                  {/* Set Threshold */}
                                  <button
                                    type="button"
                                    onClick={() => setThresholdBalance(item)}
                                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs whitespace-nowrap"
                                    title="Chỉnh định mức min/max"
                                  >
                                    Ngưỡng
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Bar */}
        {filteredGroups.length > pageSize && (
          <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs text-slate-500 font-medium">
              Hiển thị{" "}
              <strong className="text-slate-800">
                {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, filteredGroups.length)}
              </strong>{" "}
              trên tổng số{" "}
              <strong className="text-slate-800">{filteredGroups.length} dòng máy</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((c) => Math.max(1, c - 1))}
                disabled={currentPage === 1}
                className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Trước
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                disabled={currentPage === totalPages}
                className="rounded border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Modals */}
      {countingOpen && warehouseId && (
        <InventoryCountingModal
          warehouseId={warehouseId}
          warehouseName={warehouseName(warehouseId)}
          onClose={() => setCountingOpen(false)}
          onApplied={() => void load()}
        />
      )}

      {detailBalance && (
        <WarehouseSerialDetailModal
          balance={detailBalance}
          onClose={() => setDetailBalance(null)}
        />
      )}

      {thresholdBalance && (
        <ThresholdModal
          balance={thresholdBalance}
          onClose={() => setThresholdBalance(null)}
          onSave={(min, max) => handleSaveThreshold(thresholdBalance, min, max)}
        />
      )}
    </section>
  );
}

// Clean fallback avatar / monogram component (0 broken icons)
function ProductAvatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [imageError, setImageError] = useState(false);
  const sizeClass =
    size === "lg" ? "h-11 w-11 text-xs" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-[11px]";

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "SP";

  if (url && !imageError) {
    return (
      <img
        src={url}
        alt={name}
        onError={() => setImageError(true)}
        className={`${sizeClass} rounded-lg object-cover border border-slate-200 bg-white shrink-0`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 tracking-wider select-none`}
    >
      {initials}
    </span>
  );
}

// Clean Threshold Setting Dialog (0 tacky icons)
function ThresholdModal({
  balance,
  onClose,
  onSave,
}: {
  balance: InventoryBalance;
  onClose: () => void;
  onSave: (minStock: number, maxStock?: number) => Promise<void>;
}) {
  const [minStock, setMinStock] = useState(String(balance.minStock ?? 0));
  const [maxStock, setMaxStock] = useState(balance.maxStock === undefined ? "" : String(balance.maxStock));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const min = Number(minStock);
    const max = maxStock.trim() === "" ? undefined : Number(maxStock);
    if (!Number.isFinite(min) || min < 0) {
      toast.error("Mức tồn tối thiểu phải là số nguyên dương.");
      return;
    }
    if (max !== undefined && (!Number.isFinite(max) || max < min)) {
      toast.error("Mức tồn tối đa phải lớn hơn hoặc bằng mức tối thiểu.");
      return;
    }
    setSaving(true);
    try {
      await onSave(min, max);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl border border-slate-200">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <h4 className="text-base font-bold text-slate-900">Thiết lập định mức tồn kho</h4>
            <p className="mt-0.5 text-xs text-slate-500 font-mono">
              SKU: {balance.sku} {balance.variantName ? `· ${balance.variantName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded p-1 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <p>Sản phẩm: <strong className="text-slate-900">{balance.productName}</strong></p>
            <p>Tồn kho hiện tại: <strong className="text-cyan-800">{number(balance.quantity)} máy</strong></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Tồn tối thiểu (Min)
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Cảnh báo khi dưới mức này</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Tồn tối đa (Max)
              </label>
              <input
                type="number"
                min="0"
                value={maxStock}
                onChange={(e) => setMaxStock(e.target.value)}
                placeholder="Không giới hạn"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Để trống nếu không giới hạn</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-cyan-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu định mức"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
