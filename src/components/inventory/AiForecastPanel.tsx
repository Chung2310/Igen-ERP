import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, PackageSearch, RefreshCw, TrendingUp } from "lucide-react";
import { InventoryForecastItem, InventoryForecastRecommendation, InventoryForecastSummary } from "../../types";
import { toast } from "../../pages/Toast";

type AiForecastPanelProps = {
  forecast: InventoryForecastSummary;
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function formatDemand(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

function getRiskStyles(level: InventoryForecastItem["riskLevel"]) {
  if (level === "high") {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      card: "border-red-150 bg-red-50/35",
      line: "#DC2626",
    };
  }

  if (level === "medium") {
    return {
      badge: "border-orange-200 bg-orange-50 text-orange-700",
      card: "border-orange-150 bg-orange-50/35",
      line: "#F97316",
    };
  }

  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    card: "border-emerald-150 bg-emerald-50/35",
    line: "#10B981",
  };
}

function getRecommendationStyles(tone: InventoryForecastRecommendation["tone"]) {
  if (tone === "danger") return "border-red-100 bg-red-50";
  if (tone === "warning") return "border-orange-100 bg-orange-50";
  return "border-blue-100 bg-blue-50";
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

export function AiForecastPanel({ forecast }: AiForecastPanelProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const selectedItem = useMemo(
    () => forecast.items.find((item) => item.productId === selectedProductId) || forecast.items[0] || null,
    [forecast.items, selectedProductId]
  );

  useEffect(() => {
    if (!forecast.items.length) {
      setSelectedProductId("");
      return;
    }

    if (!selectedProductId || !forecast.items.some((item) => item.productId === selectedProductId)) {
      setSelectedProductId(forecast.warningItems[0]?.productId || forecast.items[0].productId);
    }
  }, [forecast.items, forecast.warningItems, selectedProductId]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" id="ai_demand_forecast_tab">
      <div className="flex flex-col justify-between rounded-2xl border border-gray-150 bg-gray-55/35 p-6" id="stock_short_warnings">
        <div>
          <h4 className="flex items-center gap-1.5 font-sans text-sm font-bold uppercase tracking-wide text-gray-800">
            <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
            Cảnh báo tồn kho tự động
          </h4>
          <p className="mt-1 text-xs leading-snug text-gray-400">Theo dõi mã sản phẩm sắp chạm ngưỡng cảnh báo hoặc đang có tốc độ xuất cao trong 30 ngày gần nhất.</p>

          <div className="mt-5 space-y-4">
            {!forecast.hasHistoricalDemand ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center text-sm font-semibold text-blue-800">
                Chưa đủ dữ liệu phiếu xuất hoàn thành để tạo dự báo nhu cầu.
              </div>
            ) : forecast.warningItems.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center text-sm font-semibold text-green-800">
                AI chưa phát hiện mã sản phẩm nào có rủi ro cạn kho trong 30 ngày tới.
              </div>
            ) : (
              forecast.warningItems.slice(0, 6).map((item) => {
                const styles = getRiskStyles(item.riskLevel);
                return (
                  <button
                    key={item.productId}
                    type="button"
                    onClick={() => setSelectedProductId(item.productId)}
                    className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-sm ${styles.card} ${selectedItem?.productId === item.productId ? "ring-2 ring-slate-800/10" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="font-sans font-bold text-gray-800">{item.name}</h5>
                        <p className="mt-1 font-mono text-[10px] text-gray-400">Mã sản phẩm: {item.sku} • Tồn hiện tại {formatNumber(item.currentStock)}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${styles.badge}`}>
                        {item.riskLevel === "high" ? "Nguy cơ cao" : "Theo dõi"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                      <div className="rounded-lg bg-white/75 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Nhu cầu/ngày</p>
                        <p className="mt-1 font-bold text-gray-800">{formatDemand(item.averageDailyDemand)}</p>
                      </div>
                      <div className="rounded-lg bg-white/75 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Đủ dùng</p>
                        <p className="mt-1 font-bold text-gray-800">{item.daysOfCover === null ? "Ổn định" : `${formatDemand(item.daysOfCover)} ngày`}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => toast.success(`Đã đánh dấu ${forecast.warningItems.length} cảnh báo để ưu tiên xử lý nhập hàng.`)}
          className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-center text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!forecast.warningItems.length}
        >
          <RefreshCw className="h-4 w-4" />
          Xử lý cảnh báo hàng loạt
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

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid flex-1 grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard label="Nhu cầu 7 ngày" value={selectedItem ? formatNumber(selectedItem.last7DaysDemand) : "--"} />
              <MetricCard label="Nhu cầu 30 ngày" value={selectedItem ? formatNumber(selectedItem.last30DaysDemand) : "--"} />
              <MetricCard label="Dự báo 30 ngày" value={selectedItem ? formatNumber(selectedItem.forecast30Days) : "--"} />
              <MetricCard label="Đề xuất nhập" value={selectedItem ? formatNumber(selectedItem.suggestedReorderQty) : "--"} />
            </div>
            <div className="w-full md:w-72">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Sản phẩm theo dõi</label>
              <select
                className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm text-gray-700"
                value={selectedItem?.productId || ""}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {forecast.items.map((item) => (
                  <option key={item.productId} value={item.productId}>
                    {item.sku} - {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!forecast.items.length || !selectedItem ? (
          <div className="my-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm font-semibold text-gray-500">
            Chưa có sản phẩm để tạo dashboard dự báo.
          </div>
        ) : (
          <>
            <Chart item={selectedItem} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InsightCard
                icon={PackageSearch}
                label="Mức phủ hàng"
                value={selectedItem.daysOfCover === null ? "Ổn định" : `${formatDemand(selectedItem.daysOfCover)} ngày`}
                hint={`Min alert: ${formatNumber(selectedItem.minStockAlert)}`}
              />
              <InsightCard
                icon={TrendingUp}
                label="Nhu cầu bình quân/ngày"
                value={formatDemand(selectedItem.averageDailyDemand)}
                hint={`${formatNumber(selectedItem.currentStock)} sản phẩm đang có trong kho`}
              />
              <InsightCard
                icon={BrainCircuit}
                label="Tín hiệu AI"
                value={selectedItem.riskLevel === "high" ? "Cần xử lý sớm" : selectedItem.riskLevel === "medium" ? "Đang cần theo dõi" : "Ổn định"}
                hint={selectedItem.overstockDays && selectedItem.overstockDays > 0 ? `Tồn dư khoảng ${formatDemand(selectedItem.overstockDays)} ngày` : "Không phát hiện dư tồn đáng kể"}
              />
            </div>
          </>
        )}

        <div className="mt-6 border-t border-gray-150 pt-4" id="forecast_recommendations_grid">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-gray-500">Đề xuất tối ưu hóa tồn kho AI Co-pilot</span>
          {forecast.recommendations.length === 0 ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              Chưa có khuyến nghị nổi bật. Hệ thống sẽ tự động đề xuất khi phát hiện nguy cơ thiếu hoặc dư tồn từ phiếu xuất hoàn thành.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3.5 text-xs md:grid-cols-3">
              {forecast.recommendations.map((recommendation) => (
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
