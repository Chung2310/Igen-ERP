import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Package,
  PackageCheck,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  InventoryForecastItem,
  InventoryForecastRecommendation,
  InventoryForecastSummary,
  StockLog,
} from "../../types";
import { toast } from "../../pages/Toast";
import {
  inventoryReceivingService,
  type InventoryBalance,
} from "../../services/inventoryReceivingService";
import { buildWarehouseInventoryForecast } from "../../utils/inventoryForecast";
import { MetricBar, MetricBarItem } from "../common/MetricBar";

type AiForecastPanelProps = {
  forecast: InventoryForecastSummary;
  stockLogs?: StockLog[];
  onNavigateToReceiving?: (sku?: string, qty?: number) => void;
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDemand(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function getRecommendationStyles(tone: InventoryForecastRecommendation["tone"]) {
  if (tone === "danger") return "border-rose-200 bg-rose-50/60 text-rose-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50/60 text-amber-900";
  return "border-blue-200 bg-blue-50/60 text-blue-900";
}

export type AdjustmentLevel = "out" | "shortage" | "excess" | "overstock" | "balanced";

export function getAdjustment(item: InventoryForecastItem): {
  level: AdjustmentLevel;
  label: string;
  action: string;
  badgeClass: string;
} {
  if (item.currentStock === 0) {
    return {
      level: "out",
      label: "Hết hàng",
      action: "Ưu tiên tạo phiếu nhập hoặc điều chuyển về kho ngay.",
      badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
    };
  }
  if (item.currentStock < item.minStockAlert || (item.daysOfCover !== null && item.daysOfCover <= 7)) {
    return {
      level: "shortage",
      label: "Thiếu hàng",
      action: `Nên bổ sung ${formatNumber(item.suggestedReorderQty)} sp để đảm bảo an toàn.`,
      badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    };
  }
  const noDemandButHighStock =
    item.forecast30Days === 0 && item.currentStock > Math.max(item.minStockAlert * 2, 1);
  if (noDemandButHighStock || (item.overstockDays !== null && item.overstockDays > 30)) {
    return {
      level: "overstock",
      label: "Dư tồn cao",
      action: "Cân nhắc điều chuyển, giảm giá hoặc tạm dừng kế hoạch nhập thêm.",
      badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
    };
  }
  if (item.overstockDays !== null && item.overstockDays > 14) {
    return {
      level: "excess",
      label: "Tồn cao",
      action: "Theo dõi sát tốc độ xuất bán; ưu tiên giảm kế hoạch nhập tới.",
      badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };
  }
  return {
    level: "balanced",
    label: "Ổn định",
    action: "Tồn kho trong ngưỡng an toàn, đáp ứng tốt nhu cầu dự báo.",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: number) {
  if (points.length === 0) return "";
  const head = points[0];
  const tail = points[points.length - 1];
  return `M ${head.x} ${baseline} L ${head.x} ${head.y} ${points
    .slice(1)
    .map((point) => `L ${point.x} ${point.y}`)
    .join(" ")} L ${tail.x} ${baseline} Z`;
}

/** Biểu đồ trực quan nhu cầu thực tế 30 ngày + dự báo 30 ngày tới của SKU */
function ForecastChart({ item }: { item: InventoryForecastItem }) {
  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 24, bottom: 28, left: 24 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;

  const history = item.series.filter((point) => point.period === "history");
  const future = item.series.filter((point) => point.period === "forecast");
  const totalPoints = Math.max(1, item.series.length - 1);

  const maxValue = Math.max(
    1,
    ...item.series.map((point) => Math.max(point.actual, point.forecast))
  );

  const toPoints = (values: number[], offset: number) =>
    values.map((value, index) => ({
      x:
        padding.left +
        offset +
        (values.length === 1 ? 0 : (index * chartWidth) / totalPoints),
      y: padding.top + chartHeight - (value / maxValue) * chartHeight,
    }));

  const historyPoints = toPoints(
    history.map((point) => point.actual),
    0
  );
  const futurePoints = toPoints(
    future.map((point) => point.forecast),
    (history.length * chartWidth) / totalPoints
  );
  const baseline = padding.top + chartHeight;

  const historyStartLabel = history[0]?.label || "";
  const historyEndLabel = history[history.length - 1]?.label || "";
  const futureEndLabel = future[future.length - 1]?.label || "";
  const splitX = padding.left + (history.length * chartWidth) / totalPoints;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-3 shadow-2xs">
      {/* Top Labels */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Thực xuất 30 ngày
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Dự báo 30 ngày tới
          </span>
        </div>
        <span className="font-mono text-[10px] font-medium text-slate-400">
          Đỉnh: {maxValue} sp/ngày
        </span>
      </div>

      {/* SVG Canvas */}
      <svg
        className="h-44 w-full"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Biểu đồ xu hướng xuất và dự báo cho ${item.sku}`}
      >
        {/* Horizontal grid lines */}
        {[0, 0.33, 0.66, 1].map((tick) => {
          const y = padding.top + chartHeight - chartHeight * tick;
          return (
            <line
              key={tick}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#F1F5F9"
              strokeDasharray="3 4"
            />
          );
        })}

        {/* Baseline */}
        <line
          x1={padding.left}
          y1={baseline}
          x2={width - padding.right}
          y2={baseline}
          stroke="#CBD5E1"
        />

        {/* Divider at Today */}
        <line
          x1={splitX}
          y1={padding.top}
          x2={splitX}
          y2={baseline}
          stroke="#6366F1"
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />

        {/* Area for historical demand */}
        <path
          d={buildAreaPath(historyPoints, baseline)}
          fill="rgba(16, 185, 129, 0.12)"
        />

        {/* Historical line */}
        <path
          d={buildLinePath(historyPoints)}
          fill="none"
          stroke="#10B981"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Future forecast line */}
        {futurePoints.length > 0 && (
          <path
            d={buildLinePath([
              {
                x: splitX,
                y: historyPoints[historyPoints.length - 1]?.y || baseline,
              },
              ...futurePoints,
            ])}
            fill="none"
            stroke="#6366F1"
            strokeWidth={2.5}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        )}

        {/* Today circle marker */}
        {historyPoints[historyPoints.length - 1] && (
          <circle
            cx={historyPoints[historyPoints.length - 1].x}
            cy={historyPoints[historyPoints.length - 1].y}
            r={4.5}
            fill="#FFFFFF"
            stroke="#10B981"
            strokeWidth={2.5}
          />
        )}
      </svg>

      {/* Axis dates */}
      <div className="mt-1 flex items-center justify-between px-2 text-[10px] font-mono text-slate-400">
        <span>{historyStartLabel || "-30d"}</span>
        <span className="font-bold text-indigo-600">Hôm nay</span>
        <span>{futureEndLabel || "+30d"}</span>
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  onApply,
}: {
  recommendation: InventoryForecastRecommendation;
  onApply?: () => void;
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs transition-all hover:shadow-xs ${getRecommendationStyles(
        recommendation.tone
      )}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h5 className="font-semibold text-xs leading-snug">{recommendation.title}</h5>
          <span className="rounded-md border border-slate-200/80 bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 shrink-0">
            {recommendation.sku}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500 line-clamp-1">
          {recommendation.productName}
        </p>
        <p className="mt-2 text-xs leading-relaxed opacity-90">{recommendation.body}</p>
      </div>

      {onApply && (
        <button
          type="button"
          onClick={onApply}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <PackagePlus className="h-3.5 w-3.5 text-teal-600" />
          Tạo phiếu nhập SKU này
        </button>
      )}
    </div>
  );
}

export function AiForecastPanel({
  forecast,
  stockLogs = [],
  onNavigateToReceiving,
}: AiForecastPanelProps) {
  const [warehouseBalances, setWarehouseBalances] = useState<InventoryBalance[] | null>(null);
  const [warehouseForecastLoading, setWarehouseForecastLoading] = useState(true);

  // Filters & Selection
  const [filterLevel, setFilterLevel] = useState<"all" | "shortage" | "warning" | "excess" | "balanced">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    let active = true;
    void inventoryReceivingService
      .listBalances()
      .then((balances) => {
        if (active) setWarehouseBalances(balances);
      })
      .catch(() => {
        if (active) setWarehouseBalances(null);
      })
      .finally(() => {
        if (active) setWarehouseForecastLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const effectiveForecast = useMemo(
    () =>
      warehouseBalances?.length
        ? buildWarehouseInventoryForecast(warehouseBalances, stockLogs)
        : forecast,
    [forecast, stockLogs, warehouseBalances]
  );

  // Grouped items with adjustment calculation
  const allItemsWithAdjustment = useMemo(() => {
    return effectiveForecast.items.map((item) => ({
      item,
      adjustment: getAdjustment(item),
    }));
  }, [effectiveForecast.items]);

  // Overall KPI metrics
  const stats = useMemo(() => {
    const totalItems = allItemsWithAdjustment.length;
    const totalDemand30 = allItemsWithAdjustment.reduce((acc, { item }) => acc + item.forecast30Days, 0);
    const shortageCount = allItemsWithAdjustment.filter(
      ({ adjustment }) => adjustment.level === "out" || adjustment.level === "shortage"
    ).length;
    const warningCount = allItemsWithAdjustment.filter(
      ({ item, adjustment }) =>
        adjustment.level !== "out" &&
        (item.currentStock <= item.minStockAlert || (item.daysOfCover !== null && item.daysOfCover <= 14))
    ).length;
    const excessCount = allItemsWithAdjustment.filter(
      ({ adjustment }) => adjustment.level === "excess" || adjustment.level === "overstock"
    ).length;
    const balancedCount = allItemsWithAdjustment.filter(
      ({ adjustment }) => adjustment.level === "balanced"
    ).length;

    return {
      totalItems,
      totalDemand30,
      shortageCount,
      warningCount,
      excessCount,
      balancedCount,
    };
  }, [allItemsWithAdjustment]);

  // Filtered items based on search and selected filterLevel
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allItemsWithAdjustment.filter(({ item, adjustment }) => {
      if (filterLevel === "shortage") {
        if (adjustment.level !== "out" && adjustment.level !== "shortage") return false;
      } else if (filterLevel === "warning") {
        const isWarning =
          adjustment.level !== "out" &&
          (item.currentStock <= item.minStockAlert ||
            (item.daysOfCover !== null && item.daysOfCover <= 14));
        if (!isWarning) return false;
      } else if (filterLevel === "excess") {
        if (adjustment.level !== "excess" && adjustment.level !== "overstock") return false;
      } else if (filterLevel === "balanced") {
        if (adjustment.level !== "balanced") return false;
      }

      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query))
      );
    });
  }, [allItemsWithAdjustment, filterLevel, searchQuery]);

  // Auto-select first item when selection is null or not found in current filtered items
  useEffect(() => {
    if (filteredItems.length > 0) {
      const exists = filteredItems.some(({ item }) => item.sku === selectedSku);
      if (!exists) {
        setSelectedSku(filteredItems[0].item.sku);
      }
    } else {
      setSelectedSku(null);
    }
  }, [filteredItems, selectedSku]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filterLevel, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  // Currently selected item for chart inspector
  const selectedItemData = useMemo(() => {
    if (!selectedSku) return null;
    return allItemsWithAdjustment.find(({ item }) => item.sku === selectedSku) || null;
  }, [allItemsWithAdjustment, selectedSku]);

  // MetricBar configuration
  const metricItems: MetricBarItem[] = [
    {
      label: "Quy mô & Nhu cầu",
      value: formatNumber(stats.totalItems),
      unit: "SKU",
      subtext: `Nhu cầu 30 ngày: ${formatNumber(stats.totalDemand30)} sp`,
      tone: "default",
      isActive: filterLevel === "all",
      onClick: () => setFilterLevel("all"),
    },
    {
      label: "Hết hàng & Cần nhập",
      value: formatNumber(stats.shortageCount),
      unit: "SKU",
      subtext:
        stats.shortageCount > 0
          ? `Ghi nhận ${stats.shortageCount} SKU cạn kho`
          : "Tồn kho đủ đáp ứng",
      tone: "rose",
      isActive: filterLevel === "shortage",
      onClick: () => setFilterLevel("shortage"),
    },
    {
      label: "Cảnh báo an toàn (≤ 14 ngày)",
      value: formatNumber(stats.warningCount),
      unit: "SKU",
      subtext:
        stats.warningCount > 0
          ? `${stats.warningCount} SKU sắp chạm ngưỡng tồn`
          : "Mức tồn an toàn ổn định",
      tone: "amber",
      isActive: filterLevel === "warning",
      onClick: () => setFilterLevel("warning"),
    },
    {
      label: "Tồn cao & Đọng vốn",
      value: formatNumber(stats.excessCount),
      unit: "SKU",
      subtext:
        stats.excessCount > 0
          ? `${stats.excessCount} SKU cần xả bớt / điều chuyển`
          : "Tồn kho luân chuyển tốt",
      tone: "indigo",
      isActive: filterLevel === "excess",
      onClick: () => setFilterLevel("excess"),
    },
  ];

  const handleCopyReorder = (sku: string, qty: number) => {
    const text = `SKU: ${sku} - Cần nhập: ${qty} cái`;
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép: ${text}`);
  };

  const handleCreateInbound = (sku: string, qty: number) => {
    if (onNavigateToReceiving) {
      onNavigateToReceiving(sku, qty);
    } else {
      handleCopyReorder(sku, qty);
      toast.info("Đã sao chép thông tin. Hãy chuyển sang tab Nhập Hàng để tạo phiếu.");
    }
  };

  return (
    <div className="space-y-5" id="ai_demand_forecast_tab">
      {/* ── 1. Dải KPI Thống nhất (MetricBar) ── */}
      <MetricBar items={metricItems} columns={4} id="forecast_kpi_bar" />

      {/* ── 2. Thanh tìm kiếm & Bộ lọc phân loại rủi ro ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* Segment filter pills */}
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setFilterLevel("all")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              filterLevel === "all"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Tất cả</span>
            <span className="rounded-full bg-slate-200/70 px-1.5 py-0.2 text-[10px] text-slate-700">
              {stats.totalItems}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterLevel("shortage")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              filterLevel === "shortage"
                ? "bg-white text-rose-700 shadow-2xs"
                : "text-slate-600 hover:text-rose-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Cần nhập ngay</span>
            <span className="rounded-full bg-rose-50 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
              {stats.shortageCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterLevel("warning")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              filterLevel === "warning"
                ? "bg-white text-amber-700 shadow-2xs"
                : "text-slate-600 hover:text-amber-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Cảnh báo an toàn</span>
            <span className="rounded-full bg-amber-50 px-1.5 py-0.2 text-[10px] font-bold text-amber-700">
              {stats.warningCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterLevel("excess")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              filterLevel === "excess"
                ? "bg-white text-indigo-700 shadow-2xs"
                : "text-slate-600 hover:text-indigo-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Tồn cao / Dư</span>
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
              {stats.excessCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterLevel("balanced")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
              filterLevel === "balanced"
                ? "bg-white text-emerald-700 shadow-2xs"
                : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Ổn định</span>
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
              {stats.balancedCount}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px] sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo sản phẩm, mã SKU..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8.5 pr-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-100 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Bố cục 2 Cột: Bảng Danh sách SKU (Trái) & Soi Chi tiết + Biểu đồ (Phải) ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Cột trái: Bảng danh sách SKU cần điều chỉnh (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-teal-700" />
                Danh mục điều chỉnh & Tồn kho khả dụng
              </h4>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Click chọn từng dòng để soi biểu đồ xu hướng và phân tích nhu cầu chi tiết
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {filteredItems.length} kết quả
            </span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            {warehouseForecastLoading && !effectiveForecast.items.length ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-500">
                Đang đồng bộ tồn kho và dữ liệu dự báo...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Không tìm thấy sản phẩm nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Sản phẩm / SKU</th>
                    <th className="px-2.5 py-2.5 text-right">Tồn kho</th>
                    <th className="px-2.5 py-2.5 text-right">Nhu cầu/ngày</th>
                    <th className="px-2.5 py-2.5 text-right">Dự báo 30d</th>
                    <th className="px-2.5 py-2.5 text-right">Đủ dùng</th>
                    <th className="px-3 py-2.5">Định hướng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.map(({ item, adjustment }) => {
                    const isSelected = item.sku === selectedSku;
                    return (
                      <tr
                        key={item.productId || item.sku}
                        onClick={() => setSelectedSku(item.sku)}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected
                            ? "bg-teal-50/60 font-medium"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-3.5 py-3">
                          <p
                            className={`font-semibold line-clamp-1 ${
                              isSelected ? "text-teal-900" : "text-slate-800"
                            }`}
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                            <span>{item.sku}</span>
                            {item.category && <span>• {item.category}</span>}
                          </div>
                        </td>

                        <td className="px-2.5 py-3 text-right font-bold tabular-nums text-slate-800">
                          {formatNumber(item.currentStock)}
                        </td>

                        <td className="px-2.5 py-3 text-right font-medium tabular-nums text-slate-600">
                          {formatDemand(item.averageDailyDemand)}
                        </td>

                        <td className="px-2.5 py-3 text-right font-medium tabular-nums text-slate-600">
                          {formatNumber(item.forecast30Days)}
                        </td>

                        <td className="px-2.5 py-3 text-right font-medium tabular-nums text-slate-600">
                          {item.daysOfCover === null
                            ? "—"
                            : `${formatDemand(item.daysOfCover)} ngày`}
                        </td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${adjustment.badgeClass}`}
                          >
                            {adjustment.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
              <span>
                Trang {page} / {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 bg-white p-1 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-200 bg-white p-1 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Chi tiết & Kích hoạt Biểu đồ SVG dự báo (5 cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs space-y-4">
          {selectedItemData ? (
            <>
              {/* Product Header & Quick Badges */}
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                      Mã: {selectedItemData.item.sku}
                    </span>
                    <h3 className="mt-1 font-bold text-sm text-slate-900 leading-snug">
                      {selectedItemData.item.name}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold shrink-0 ${selectedItemData.adjustment.badgeClass}`}
                  >
                    {selectedItemData.adjustment.label}
                  </span>
                </div>
              </div>

              {/* Forecast SVG Chart */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-teal-600" />
                  Biểu đồ nhu cầu & Xu hướng 30 ngày tới
                </p>
                <ForecastChart item={selectedItemData.item} />
              </div>

              {/* 4 Detail Metric Cards */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Tồn khả dụng
                  </span>
                  <span className="mt-0.5 text-base font-black tabular-nums text-slate-800 block">
                    {formatNumber(selectedItemData.item.currentStock)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Báo động: {selectedItemData.item.minStockAlert} sp
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Tốc độ bán
                  </span>
                  <span className="mt-0.5 text-base font-black tabular-nums text-slate-800 block">
                    {formatDemand(selectedItemData.item.averageDailyDemand)}{" "}
                    <span className="text-[11px] font-semibold text-slate-500">sp/ngày</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Xuất 30d: {selectedItemData.item.last30DaysDemand} sp
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Độ phủ tồn kho
                  </span>
                  <span className="mt-0.5 text-base font-black tabular-nums text-slate-800 block">
                    {selectedItemData.item.daysOfCover !== null
                      ? `${formatDemand(selectedItemData.item.daysOfCover)} ngày`
                      : "—"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Dự kiến đủ dùng
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {selectedItemData.item.suggestedReorderQty > 0
                      ? "Đề xuất bổ sung"
                      : "Dự báo 30 ngày"}
                  </span>
                  <span
                    className={`mt-0.5 text-base font-black tabular-nums block ${
                      selectedItemData.item.suggestedReorderQty > 0
                        ? "text-rose-600"
                        : "text-slate-800"
                    }`}
                  >
                    {selectedItemData.item.suggestedReorderQty > 0
                      ? `+${formatNumber(selectedItemData.item.suggestedReorderQty)} sp`
                      : `${formatNumber(selectedItemData.item.forecast30Days)} sp`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {selectedItemData.item.suggestedReorderQty > 0
                      ? "Để đạt mức an toàn"
                      : "Nhu cầu tháng tới"}
                  </span>
                </div>
              </div>

              {/* Actionable Explanation Box */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
                  <BrainCircuit className="h-4 w-4 text-teal-600" />
                  Định hướng từ AI Co-pilot
                </div>
                <p>{selectedItemData.adjustment.action}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {selectedItemData.item.suggestedReorderQty > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleCreateInbound(
                          selectedItemData.item.sku,
                          selectedItemData.item.suggestedReorderQty
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-2.5 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-teal-800 transition-colors cursor-pointer"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      Tạo phiếu nhập (+{formatNumber(selectedItemData.item.suggestedReorderQty)} sp)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyReorder(
                          selectedItemData.item.sku,
                          selectedItemData.item.suggestedReorderQty
                        )
                      }
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Sao chép SKU và số lượng"
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      Sao chép
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedItemData.item.sku);
                      toast.success(`Đã sao chép mã SKU: ${selectedItemData.item.sku}`);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    Sao chép mã SKU
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400">
              <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              Chọn một sản phẩm từ bảng danh sách bên trái để soi biểu đồ xu hướng.
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Khối Khuyến nghị Tối ưu hóa Tồn kho AI Co-pilot (Dưới cùng) ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs" id="forecast_recommendations_grid">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-500" />
            <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800">
              Đề xuất tối ưu hóa tồn kho AI Co-pilot
            </h4>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            Hồi quy nhu cầu 30 ngày (Trọng số 65% tuần gần nhất)
          </span>
        </div>

        {effectiveForecast.recommendations.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
            Chưa có khuyến nghị khẩn cấp. Hệ thống sẽ tự động đề xuất khi phát hiện rủi ro thiếu hoặc dư tồn vượt ngưỡng.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {effectiveForecast.recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onApply={() => {
                  const target = allItemsWithAdjustment.find(
                    (entry) => entry.item.sku === recommendation.sku
                  );
                  if (target) {
                    setSelectedSku(target.item.sku);
                    if (target.item.suggestedReorderQty > 0) {
                      handleCreateInbound(target.item.sku, target.item.suggestedReorderQty);
                    } else {
                      toast.info(`Đã chọn SKU: ${target.item.sku}`);
                    }
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
