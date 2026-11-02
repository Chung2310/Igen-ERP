import { Banknote, CreditCard, QrCode, Smartphone, TrendingUp, Wallet } from "lucide-react";
import type { RetailReport } from "../../types";

type RetailSalesChartsProps = { report: RetailReport };

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const paymentConfig: Record<
  RetailReport["paymentMix"][number]["method"],
  { label: string; icon: typeof Banknote; gradient: string; textColor: string; bgBadge: string }
> = {
  cash: {
    label: "Tiền mặt",
    icon: Banknote,
    gradient: "from-emerald-500 to-teal-500",
    textColor: "text-emerald-700",
    bgBadge: "bg-emerald-50",
  },
  card: {
    label: "Thẻ",
    icon: CreditCard,
    gradient: "from-violet-500 to-purple-500",
    textColor: "text-violet-700",
    bgBadge: "bg-violet-50",
  },
  transfer: {
    label: "Chuyển khoản",
    icon: QrCode,
    gradient: "from-cyan-500 to-blue-500",
    textColor: "text-cyan-700",
    bgBadge: "bg-cyan-50",
  },
  ewallet: {
    label: "Ví điện tử",
    icon: Smartphone,
    gradient: "from-amber-500 to-orange-500",
    textColor: "text-amber-700",
    bgBadge: "bg-amber-50",
  },
};

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatShortDate(value: string): string {
  if (!value) return "";
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value;
}

const CHART_PADDING = {
  left: 55,
  right: 15,
  top: 14,
  bottom: 24,
};
const SVG_WIDTH = 700;
const SVG_HEIGHT = 210;
const plotWidth = SVG_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const plotHeight = SVG_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
const baselineY = CHART_PADDING.top + plotHeight;

function getCoord(index: number, total: number, value: number, maxValue: number) {
  const x = total <= 1 ? CHART_PADDING.left + plotWidth / 2 : CHART_PADDING.left + (index / (total - 1)) * plotWidth;
  const clamped = Math.max(0, value);
  const y = baselineY - (clamped / maxValue) * plotHeight;
  return { x, y };
}

function linePath(values: number[], maxValue: number): string {
  if (!values.length) return "";
  return values
    .map((val, idx) => {
      const { x, y } = getCoord(idx, values.length, val, maxValue);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(values: number[], maxValue: number): string {
  if (!values.length) return "";
  const points = values.map((val, idx) => {
    const { x, y } = getCoord(idx, values.length, val, maxValue);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const firstX = getCoord(0, values.length, 0, maxValue).x.toFixed(1);
  const lastX = getCoord(values.length - 1, values.length, 0, maxValue).x.toFixed(1);
  return `M${firstX},${baselineY} L${points.join(" L")} L${lastX},${baselineY} Z`;
}

function getXAxisTicks(total: number): number[] {
  if (total <= 1) return [0];
  if (total <= 6) return Array.from({ length: total }, (_, i) => i);
  const count = 5;
  const step = (total - 1) / (count - 1);
  const set = new Set<number>();
  for (let i = 0; i < count; i++) {
    set.add(Math.round(i * step));
  }
  return Array.from(set).sort((a, b) => a - b);
}

export default function RetailSalesCharts({ report }: RetailSalesChartsProps) {
  const actualTrendMaximum = Math.max(
    0,
    ...report.timeSeries.flatMap((row) => [row.netSales, row.collectedAmount, row.refunds])
  );
  const trendScaleMaximum = Math.max(1, actualTrendMaximum);
  const totalPaymentAmount = report.paymentMix.reduce((sum, row) => sum + (row.amount || 0), 0);
  const paymentMaximum = Math.max(1, ...report.paymentMix.map((row) => row.amount));
  const firstDay = report.timeSeries[0]?.businessDate || report.range.from;
  const lastDay = report.timeSeries.at(-1)?.businessDate || report.range.to;

  const yTicks = [1.0, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    y: baselineY - ratio * plotHeight,
    label:
      ratio === 0
        ? "0"
        : actualTrendMaximum > 0
        ? compactMoneyFormatter.format(ratio * actualTrendMaximum)
        : "",
  }));

  const xAxisTicks = getXAxisTicks(report.timeSeries.length);

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      {/* Revenue Trend Chart */}
      <article className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Xu hướng doanh thu</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(report.range.from)} – {formatDate(report.range.to)}
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50/80 p-2 text-xs font-semibold text-slate-600 border border-slate-100"
            aria-label="Chú giải biểu đồ"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-xs" />
              Doanh thu thuần
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs" />
              Đã thu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400 shadow-xs" />
              Hoàn tiền
            </span>
          </div>
        </div>

        {report.timeSeries.length > 0 ? (
          <div className="min-w-0">
            <svg
              role="img"
              aria-label="Xu hướng doanh thu theo ngày"
              viewBox="0 0 700 210"
              preserveAspectRatio="none"
              className="h-64 w-full overflow-visible"
            >
              <title>Xu hướng doanh thu theo ngày</title>
              <defs>
                <linearGradient id="retailNetSalesArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines & Y-axis labels */}
              {yTicks.map((tick) => (
                <g key={tick.ratio}>
                  <line
                    x1={CHART_PADDING.left}
                    x2={CHART_PADDING.left + plotWidth}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray={tick.ratio === 0 ? undefined : "3 3"}
                  />
                  {tick.label ? (
                    <text
                      x={CHART_PADDING.left - 8}
                      y={tick.y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[9.5px] select-none"
                    >
                      {tick.label}
                    </text>
                  ) : null}
                </g>
              ))}

              {/* X-axis ticks & date markers */}
              {xAxisTicks.map((idx) => {
                const item = report.timeSeries[idx];
                if (!item) return null;
                const { x } = getCoord(idx, report.timeSeries.length, 0, 1);
                const isFirst = idx === 0;
                const isLast = idx === report.timeSeries.length - 1;
                return (
                  <g key={`x-${item.businessDate || idx}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={baselineY}
                      y2={baselineY + 4}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={baselineY + 16}
                      textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                      className="fill-slate-400 text-[10px] select-none font-medium"
                    >
                      {formatShortDate(item.businessDate)}
                    </text>
                  </g>
                );
              })}

              {/* Area fill under net sales */}
              <path
                d={areaPath(
                  report.timeSeries.map((row) => row.netSales),
                  trendScaleMaximum
                )}
                fill="url(#retailNetSalesArea)"
              />

              {/* Net Sales Line - Thin elegant stroke */}
              <path
                d={linePath(
                  report.timeSeries.map((row) => row.netSales),
                  trendScaleMaximum
                )}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Collected Amount Line - Thin elegant stroke */}
              <path
                d={linePath(
                  report.timeSeries.map((row) => row.collectedAmount),
                  trendScaleMaximum
                )}
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Refunds Line - Subtle dashed thin stroke */}
              <path
                d={linePath(
                  report.timeSeries.map((row) => row.refunds),
                  trendScaleMaximum
                )}
                fill="none"
                stroke="#fb7185"
                strokeWidth="1.25"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />

              {/* Peak highlight dots for non-zero netSales */}
              {report.timeSeries.map((row, idx) => {
                if (row.netSales <= 0) return null;
                const { x, y } = getCoord(idx, report.timeSeries.length, row.netSales, trendScaleMaximum);
                return (
                  <g key={`dot-${row.businessDate || idx}`} className="cursor-pointer">
                    <circle
                      cx={x}
                      cy={y}
                      r="3"
                      fill="#ffffff"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                    />
                    <title>{`${formatDate(row.businessDate)}: Doanh thu thuần ${moneyFormatter.format(row.netSales)}`}</title>
                  </g>
                );
              })}
            </svg>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="font-medium text-slate-500">
                Khoảng: <span className="font-semibold text-slate-700">{formatDate(firstDay)} – {formatDate(lastDay)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
                Cao nhất: {compactMoneyFormatter.format(actualTrendMaximum)} ₫
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center text-xs text-slate-400">
            Chưa có dữ liệu xu hướng trong khoảng này.
          </div>
        )}
      </article>

      {/* Payment Mix Breakdown */}
      <article className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cơ cấu thanh toán</h2>
              <p className="mt-0.5 text-xs text-slate-500">Giá trị thực nhận theo phương thức</p>
            </div>
            {totalPaymentAmount > 0 && (
              <span className="text-xs font-mono font-bold text-slate-900">
                {compactMoneyFormatter.format(totalPaymentAmount)} ₫
              </span>
            )}
          </div>

          {report.paymentMix.length > 0 ? (
            <div className="mt-5 space-y-4">
              {report.paymentMix.map((row) => {
                const conf = paymentConfig[row.method] || {
                  label: row.method,
                  icon: Wallet,
                  gradient: "from-slate-500 to-slate-700",
                  textColor: "text-slate-700",
                  bgBadge: "bg-slate-50",
                };
                const Icon = conf.icon;
                const percentage =
                  totalPaymentAmount > 0
                    ? ((row.amount / totalPaymentAmount) * 100).toFixed(1)
                    : "0";

                return (
                  <div key={row.method} className="space-y-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${conf.bgBadge}`}>
                          <Icon className={`h-4 w-4 ${conf.textColor}`} />
                        </div>
                        <span className="font-semibold text-slate-800">{conf.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">{moneyFormatter.format(row.amount)}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${conf.gradient} transition-all duration-500`}
                        style={{
                          width: `${Math.max(0, Math.min(100, (row.amount / paymentMaximum) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 flex h-52 flex-col items-center justify-center rounded-2xl bg-slate-50 text-center text-xs text-slate-400">
              Chưa có thanh toán trong khoảng này.
            </div>
          )}
        </div>

        {totalPaymentAmount > 0 && (
          <div className="mt-4 rounded-2xl bg-cyan-50/50 p-3 text-[11px] text-cyan-800 font-medium text-center">
            Tổng dòng tiền thực nhận: <strong>{moneyFormatter.format(totalPaymentAmount)}</strong>
          </div>
        )}
      </article>
    </section>
  );
}
