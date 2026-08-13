import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, PackageSearch, RefreshCw, TrendingUp } from "lucide-react";
import { InventoryForecastItem, InventoryForecastRecommendation, InventoryForecastSummary, StockLog } from "../../types";
import { toast } from "../../pages/Toast";
import { inventoryReceivingService, type InventoryBalance } from "../../services/inventoryReceivingService";
import { buildWarehouseInventoryForecast } from "../../utils/inventoryForecast";

type AiForecastPanelProps = {
  forecast: InventoryForecastSummary;
  stockLogs?: StockLog[];
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDemand(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function getRecommendationStyles(tone: InventoryForecastRecommendation["tone"]) {
  if (tone === "danger") return "border-red-100 bg-red-50";
  if (tone === "warning") return "border-orange-100 bg-orange-50";
  return "border-blue-100 bg-blue-50";
}

type AdjustmentLevel = "out" | "shortage" | "excess" | "overstock";
function getAdjustment(item: InventoryForecastItem): { level: AdjustmentLevel; label: string; action: string } | null {
  if (item.currentStock === 0) return { level: "out", label: "Hết hàng", action: "Ưu tiên tạo phiếu nhập hoặc điều chuyển về kho." };
  if (item.currentStock < item.minStockAlert || (item.daysOfCover !== null && item.daysOfCover <= 7)) return { level: "shortage", label: "Thiếu hàng", action: `Nên bổ sung ${formatNumber(item.suggestedReorderQty)} để bảo đảm mức tồn an toàn.` };
  const noDemandButHighStock = item.forecast30Days === 0 && item.currentStock > Math.max(item.minStockAlert * 2, 1);
  if (noDemandButHighStock || (item.overstockDays !== null && item.overstockDays > 30)) return { level: "overstock", label: "Dư tồn cao", action: "Cân nhắc điều chuyển, khuyến mãi hoặc tạm dừng nhập thêm." };
  if (item.overstockDays !== null && item.overstockDays > 14) return { level: "excess", label: "Tồn cao", action: "Theo dõi tốc độ bán; ưu tiên giảm kế hoạch nhập tiếp theo." };
  return null;
}
const adjustmentStyles: Record<AdjustmentLevel, { badge: string; card: string }> = {
  out: { badge: "border-rose-200 bg-rose-50 text-rose-700", card: "border-rose-150 bg-rose-50/35" },
  shortage: { badge: "border-orange-200 bg-orange-50 text-orange-700", card: "border-orange-150 bg-orange-50/35" },
  excess: { badge: "border-amber-200 bg-amber-50 text-amber-700", card: "border-amber-150 bg-amber-50/35" },
  overstock: { badge: "border-violet-200 bg-violet-50 text-violet-700", card: "border-violet-150 bg-violet-50/35" },
};

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

function Chart({ item }: { item: InventoryForecastItem }) {
  const width = 720;
  const height = 260;
  const padding = { top: 16, right: 16, bottom: 28, left: 16 };
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const history = item.series.filter((point) => point.period === "history");
  const future = item.series.filter((point) => point.period === "forecast");
  const maxValue = Math.max(
    1,
    ...item.series.map((point) => Math.max(point.actual, point.forecast))
  );

  const toPoints = (values: number[], offset: number) =>
    values.map((value, index) => ({
      x: padding.left + offset + (values.length === 1 ? 0 : (index * chartWidth) / (item.series.length - 1)),
      y: padding.top + chartHeight - (value / maxValue) * chartHeight,
    }));

  const historyPoints = toPoints(history.map((point) => point.actual), 0);
  const futurePoints = toPoints(future.map((point) => point.forecast), (history.length * chartWidth) / (item.series.length - 1));
  const baseline = padding.top + chartHeight;

  const historyStartLabel = history[0]?.label || "";
  const historyEndLabel = history[history.length - 1]?.label || "";
  const futureEndLabel = future[future.length - 1]?.label || "";
  const splitX = padding.left + (history.length * chartWidth) / (item.series.length - 1);

  return (
    <div className="relative my-6 h-72 rounded-2xl border border-gray-100 bg-gradient-to-b from-slate-50 to-white p-4">
      <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - chartHeight * tick;
          return <line key={tick} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#E5E7EB" strokeDasharray="3 5" />;
        })}
        <line x1={padding.left} y1={baseline} x2={width - padding.right} y2={baseline} stroke="#CBD5E1" />
        <line x1={splitX} y1={padding.top} x2={splitX} y2={baseline} stroke="#6366F1" strokeDasharray="4 4" strokeWidth={2} />
        <path d={buildAreaPath(historyPoints, baseline)} fill="rgba(16, 185, 129, 0.12)" />
        <path d={buildLinePath(historyPoints)} fill="none" stroke="#10B981" strokeWidth={3} strokeLinecap="round" />
        {futurePoints.length > 0 ? <path d={buildLinePath([{ x: splitX, y: historyPoints[historyPoints.length - 1]?.y || baseline }, ...futurePoints])} fill="none" stroke="#6366F1" strokeWidth={3} strokeDasharray="6 5" strokeLinecap="round" /> : null}
        {historyPoints[historyPoints.length - 1] ? (
          <circle
            cx={historyPoints[historyPoints.length - 1].x}
            cy={historyPoints[historyPoints.length - 1].y}
            r={5}
            fill="#FFFFFF"
            stroke="#10B981"
            strokeWidth={3}
          />
        ) : null}
      </svg>

      <div className="pointer-events-none absolute left-5 top-4 rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
        Dữ liệu thực 30 ngày
      </div>
      <div className="pointer-events-none absolute right-5 top-4 rounded-sm border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
        Dự báo 30 ngày
      </div>
      <div className="pointer-events-none absolute left-[50%] top-10 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-sm">
        Hôm nay
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-center justify-between text-[10px] font-medium text-gray-400">
        <span>{historyStartLabel}</span>
        <span>{historyEndLabel}</span>
        <span>{futureEndLabel}</span>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: InventoryForecastRecommendation }) {
  return (
    <div className={`rounded-xl border p-3 text-left ${getRecommendationStyles(recommendation.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-sans font-bold text-gray-800">{recommendation.title}</h5>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{recommendation.productName}</p>
        </div>
        <span className="rounded-md bg-white/80 px-2 py-1 text-[10px] font-bold text-gray-600">{recommendation.sku}</span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-gray-600">{recommendation.body}</p>
    </div>
  );
}

export function AiForecastPanel({ forecast, stockLogs = [] }: AiForecastPanelProps) {
  const [warehouseBalances, setWarehouseBalances] = useState<InventoryBalance[] | null>(null);
  const [warehouseForecastLoading, setWarehouseForecastLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void inventoryReceivingService.listBalances()
      .then((balances) => { if (active) setWarehouseBalances(balances); })
      .catch(() => { if (active) setWarehouseBalances(null); })
      .finally(() => { if (active) setWarehouseForecastLoading(false); });
    return () => { active = false; };
  }, []);

  const effectiveForecast = useMemo(
    () => warehouseBalances?.length ? buildWarehouseInventoryForecast(warehouseBalances, stockLogs) : forecast,
    [forecast, stockLogs, warehouseBalances]
  );
  const adjustmentItems = useMemo(
    () => effectiveForecast.items.map((item) => ({ item, adjustment: getAdjustment(item) })).filter((entry): entry is { item: InventoryForecastItem; adjustment: NonNullable<ReturnType<typeof getAdjustment>> } => Boolean(entry.adjustment)),
    [effectiveForecast.items]
  );
  const overview = useMemo(() => ({
    skuCount: effectiveForecast.items.length,
    shortageCount: adjustmentItems.filter(({ adjustment }) => adjustment.level === "out" || adjustment.level === "shortage").length,
    excessCount: adjustmentItems.filter(({ adjustment }) => adjustment.level === "excess" || adjustment.level === "overstock").length,
    demand30: effectiveForecast.items.reduce((sum, item) => sum + item.forecast30Days, 0),
  }), [adjustmentItems, effectiveForecast.items]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" id="ai_demand_forecast_tab">
      <div className="flex flex-col justify-between rounded-2xl border border-gray-150 bg-gray-55/35 p-6" id="stock_short_warnings">
        <div>
          <h4 className="flex items-center gap-1.5 font-sans text-sm font-bold uppercase tracking-wide text-gray-800">
            <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            Phân loại điều chỉnh tồn kho
          </h4>
          <p className="mt-1 text-xs leading-snug text-gray-400">Xem SKU nào thiếu để bổ sung và SKU nào dư để điều chuyển, khuyến mãi hoặc giảm kế hoạch nhập.</p>

          <div className="mt-5 space-y-4">
            {warehouseForecastLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">Đang đồng bộ tồn kho và dữ liệu dự báo...</div>
            ) : !effectiveForecast.hasHistoricalDemand ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center text-sm font-semibold text-blue-800">
                Chưa đủ dữ liệu phiếu xuất hoàn thành để tạo dự báo nhu cầu.
              </div>
            ) : adjustmentItems.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center text-sm font-semibold text-green-800">
                Tồn kho đang cân bằng; chưa có SKU cần điều chỉnh ưu tiên.
              </div>
            ) : (
              adjustmentItems.slice(0, 6).map(({ item, adjustment }) => {
                const styles = adjustmentStyles[adjustment.level];
                return (
                  <button
                    key={item.productId}
                    type="button"
                    className={`w-full cursor-default rounded-xl border p-4 text-left ${styles.card}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="font-sans font-bold text-gray-800">{item.name}</h5>
                        <p className="mt-1 font-mono text-[10px] text-gray-400">Mã sản phẩm: {item.sku} • Tồn hiện tại {formatNumber(item.currentStock)}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles.badge}`}>{adjustment.label}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                      <div className="rounded-lg bg-white/75 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Nhu cầu/ngày</p>
                        <p className="mt-1 font-bold text-gray-800">{formatDemand(item.averageDailyDemand)}</p>
                      </div>
                      <div className="rounded-lg bg-white/75 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Điều chỉnh</p>
                        <p className="mt-1 font-bold text-gray-800">{adjustment.level === "out" || adjustment.level === "shortage" ? `Nhập ${formatNumber(item.suggestedReorderQty)}` : "Giảm / điều chuyển"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-gray-600">{adjustment.action}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => toast.success(`Đã đánh dấu ${adjustmentItems.length} SKU cần điều chỉnh tồn kho.`)}
          className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-center text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!adjustmentItems.length}
        >
          <RefreshCw className="h-4 w-4" />
          Xem danh sách cần điều chỉnh
        </button>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2" id="ai_demand_chart_container">
        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wide text-gray-800">
                <TrendingUp className="h-4.5 w-4.5 text-blue-500" />
                Dự báo nhu cầu khách hàng 30 ngày tới
              </h4>
              <p className="mt-1 text-xs leading-snug text-gray-400">Forecast dùng phiếu xuất hoàn thành làm tín hiệu nhu cầu thật và ưu tiên trọng số cao hơn cho 7 ngày gần nhất.</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-mono text-[10px] text-emerald-700">
              <BrainCircuit className="h-3.5 w-3.5" />
              Rule-based AI Active
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard label="SKU đang theo dõi" value={formatNumber(overview.skuCount)} />
            <MetricCard label="SKU cần bổ sung" value={formatNumber(overview.shortageCount)} />
            <MetricCard label="SKU cần giảm tồn" value={formatNumber(overview.excessCount)} />
            <MetricCard label="Nhu cầu dự báo 30 ngày" value={formatNumber(overview.demand30)} />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h5 className="font-semibold text-slate-800">Danh sách điều chỉnh tồn kho</h5><p className="mt-0.5 text-xs text-slate-500">Ưu tiên các SKU thiếu hoặc dư tồn để điều chỉnh kế hoạch nhập, xuất và điều chuyển.</p></div>
          <div className="max-h-[390px] overflow-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="sticky top-0 bg-white text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Sản phẩm / SKU</th><th className="px-4 py-3 text-right">Tồn khả dụng</th><th className="px-4 py-3 text-right">Dự báo 30 ngày</th><th className="px-4 py-3 text-right">Đủ dùng</th><th className="px-4 py-3">Định hướng</th></tr></thead><tbody className="divide-y divide-slate-100">{adjustmentItems.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Chưa có SKU cần điều chỉnh tồn kho.</td></tr> : adjustmentItems.map(({ item, adjustment }) => <tr key={item.productId} className="hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-800">{item.name}</p><p className="font-mono text-xs text-slate-500">{item.sku}</p></td><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(item.currentStock)}</td><td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.forecast30Days)}</td><td className="px-4 py-3 text-right tabular-nums">{item.daysOfCover === null ? "—" : `${formatDemand(item.daysOfCover)} ngày`}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${adjustmentStyles[adjustment.level].badge}`}>{adjustment.label}</span><p className="mt-1 text-xs text-slate-500">{adjustment.level === "out" || adjustment.level === "shortage" ? `Bổ sung ${formatNumber(item.suggestedReorderQty)}` : "Giảm nhập / điều chuyển"}</p></td></tr>)}</tbody></table></div>
        </div>

        <div className="mt-6 border-t border-gray-150 pt-4" id="forecast_recommendations_grid">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-gray-500">Đề xuất tối ưu hóa tồn kho AI Co-pilot</span>
          {effectiveForecast.recommendations.length === 0 ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              Chưa có khuyến nghị nổi bật. Hệ thống sẽ tự động đề xuất khi phát hiện nguy cơ thiếu hoặc dư tồn từ phiếu xuất hoàn thành.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3.5 text-xs md:grid-cols-3">
              {effectiveForecast.recommendations.map((recommendation) => (
                <div key={recommendation.id}>
                  <RecommendationCard recommendation={recommendation} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-150 bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-150 bg-gray-50/70 p-4">
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="h-4 w-4 text-blue-500" />
        <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-gray-800">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-gray-500">{hint}</p>
    </div>
  );
}
