import React, { useState } from "react";
import { motion } from "motion/react";
import { formatDashboardCurrency } from "./dashboardUtils";
import { DASHBOARD_CHART_PALETTE, DASHBOARD_CHART_TRACK } from "./dashboardPalette";
import { TrendingDown, TrendingUp } from "./DashboardIcons";

export type OverviewChartItem = {
  label: string;
  value: number;
  color: string;
};

const number = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

function displayValue(value: number, unit: "money" | "count") {
  return unit === "money"
    ? `${formatDashboardCurrency(value, 1, false)} ₫`
    : value.toLocaleString("vi-VN");
}

export function OverviewComparisonChart({
  title,
  items,
  unit = "count",
  loading = false,
}: {
  title: string;
  items: OverviewChartItem[];
  unit?: "money" | "count";
  loading?: boolean;
}) {
  const max = Math.max(0, ...items.map((item) => number(item.value)));

  return (
    <div className="min-w-0 rounded-xl border border-[#D9F3FF] bg-[#FBFEFF] p-3 shadow-xs transition-shadow hover:shadow-sm" role="group" aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#007EB8]">{title}</h4>
        <span className="text-[10px] font-medium text-slate-400">{unit === "money" ? "VNĐ" : "Số lượng"}</span>
      </div>
      {loading ? (
        <p className="py-6 text-center text-xs text-slate-400 animate-pulse">Đang tải số liệu...</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const value = number(item.value);
            const targetWidth = max ? (value / max) * 100 : 0;
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="group/item -m-1 rounded-lg p-1 transition-colors hover:bg-sky-50/60"
              >
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium text-slate-600 transition-colors group-hover/item:text-slate-900" title={item.label}>
                    {item.label}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-800">{displayValue(value, unit)}</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100"
                  style={{ backgroundColor: DASHBOARD_CHART_TRACK }}
                  role="img"
                  aria-label={`${item.label}: ${displayValue(value, unit)}`}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${targetWidth}%` }}
                    transition={{
                      duration: 0.8,
                      delay: idx * 0.1,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="h-full rounded-full transition-transform hover:brightness-110"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </motion.div>
            );
          })}
          {max === 0 && <p className="pt-1 text-xs text-slate-400">Chưa có số liệu phát sinh.</p>}
        </div>
      )}
    </div>
  );
}

export function OverviewShareChart({
  title,
  value,
  total,
  label,
  color,
  loading = false,
}: {
  title: string;
  value: number;
  total: number;
  label: string;
  color: string;
  loading?: boolean;
}) {
  const safeTotal = number(total);
  const safeValue = Math.min(number(value), safeTotal);
  const percent = safeTotal ? Math.round((safeValue / safeTotal) * 100) : 0;

  return (
    <div className="min-w-0 rounded-xl border border-[#D9F3FF] bg-[#FBFEFF] p-3 shadow-xs transition-shadow hover:shadow-sm" role="group" aria-label={title}>
      <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-[#007EB8]">{title}</h4>
      {loading ? (
        <p className="py-6 text-center text-xs text-slate-400 animate-pulse">Đang tải số liệu...</p>
      ) : (
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ scale: 0.65, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.1 }}
            whileHover={{ scale: 1.08 }}
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full shadow-xs cursor-pointer transition-transform"
            style={{
              background: safeTotal
                ? `conic-gradient(${color} ${percent}%, ${DASHBOARD_CHART_TRACK} 0)`
                : DASHBOARD_CHART_TRACK,
            }}
            role="img"
            aria-label={`${label}: ${safeValue} trên ${safeTotal}, ${percent}%`}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, type: "spring" }}
              className="grid h-[54px] w-[54px] place-items-center rounded-full bg-white text-sm font-bold text-slate-800 shadow-2xs"
            >
              {percent}%
            </motion.div>
          </motion.div>
          <div className="min-w-0 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">{label}</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {safeValue.toLocaleString("vi-VN")} / {safeTotal.toLocaleString("vi-VN")}
            </p>
            {safeTotal === 0 && <p className="mt-2 text-slate-400">Chưa có số liệu phát sinh.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function OverviewAttendanceChart({
  checkedIn,
  late,
  approvedLeave,
  absent,
  total,
  loading = false,
}: {
  checkedIn: number;
  late: number;
  approvedLeave: number;
  absent: number;
  total: number;
  loading?: boolean;
}) {
  const safeCheckedIn = number(checkedIn);
  const safeLate = Math.min(number(late), safeCheckedIn);
  const items: OverviewChartItem[] = [
    { label: "Đi làm đúng giờ", value: safeCheckedIn - safeLate, color: DASHBOARD_CHART_PALETTE[0] },
    { label: "Đi muộn", value: safeLate, color: DASHBOARD_CHART_PALETTE[1] },
    { label: "Nghỉ phép", value: number(approvedLeave), color: DASHBOARD_CHART_PALETTE[2] },
    { label: "Nghỉ không phép", value: number(absent), color: DASHBOARD_CHART_PALETTE[3] },
  ];
  const denominator = Math.max(number(total), items.reduce((sum, item) => sum + item.value, 0));

  return (
    <div className="min-w-0 rounded-xl border border-[#D9F3FF] bg-[#FBFEFF] p-3 shadow-xs transition-shadow hover:shadow-sm" role="group" aria-label="Cơ cấu chấm công hôm nay">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#007EB8]">Cơ cấu chấm công hôm nay</h4>
        <span className="text-[10px] font-semibold text-slate-400">{denominator.toLocaleString("vi-VN")} người</span>
      </div>
      {loading ? (
        <p className="py-6 text-center text-xs text-slate-400 animate-pulse">Đang tải số liệu...</p>
      ) : (
        <>
          <div
            className="flex h-3 overflow-hidden rounded-full shadow-2xs"
            style={{ backgroundColor: DASHBOARD_CHART_TRACK }}
            role="img"
            aria-label={items.map((item) => `${item.label}: ${item.value}`).join(", ")}
          >
            {items.map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ width: 0 }}
                animate={{ width: `${denominator ? (item.value / denominator) * 100 : 0}%` }}
                transition={{
                  duration: 0.8,
                  delay: idx * 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="h-full cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: item.color }}
                title={`${item.label}: ${item.value}`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {items.map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + idx * 0.08 }}
                className="flex min-w-0 items-center gap-2 rounded-md p-1 text-xs transition-colors hover:bg-white hover:shadow-xs"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 flex-1 truncate text-slate-600">{item.label}</span>
                <strong className="font-semibold tabular-nums text-slate-800">{item.value.toLocaleString("vi-VN")}</strong>
              </motion.div>
            ))}
          </div>
          {denominator === 0 && <p className="mt-3 text-xs text-slate-400">Chưa có số liệu phát sinh.</p>}
        </>
      )}
    </div>
  );
}

export function OverviewTimelineChart({
  title,
  series,
  periodWeeks = 8,
  loading = false,
  error = false,
}: {
  title: string;
  series: Array<{ label: string; value: number }>;
  periodWeeks?: number;
  loading?: boolean;
  error?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = series.slice(-periodWeeks);
  const values = points.map((point) => number(point.value));
  const max = Math.max(0, ...values);

  // Tính toán biến động tăng/giảm giữa 2 kỳ gần nhất
  const lastIdx = values.length - 1;
  const lastVal = values[lastIdx] ?? 0;
  const prevVal = values[lastIdx - 1] ?? 0;
  const hasDiff = values.length >= 2;
  const diffVal = lastVal - prevVal;
  const percentChange = prevVal > 0 ? ((diffVal / prevVal) * 100).toFixed(1) : null;

  // Tính tọa độ điểm trên khung SVG
  const SVG_W = 1000;
  const SVG_H = 180;
  const TOP_Y = 18;
  const BASELINE_Y = 152;
  const PLOT_H = BASELINE_Y - TOP_Y;
  const LEFT_X = 40;
  const RIGHT_X = 960;
  const PLOT_W = RIGHT_X - LEFT_X;

  const coords = points.map((pt, i) => {
    const val = number(pt.value);
    const x = points.length === 1 ? 500 : LEFT_X + (i / (points.length - 1)) * PLOT_W;
    const y = max > 0 ? BASELINE_Y - (val / max) * PLOT_H : BASELINE_Y;
    return { x, y, label: pt.label, value: val };
  });

  const getSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (pts.length === 2) {
      return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = Math.min(BASELINE_Y, Math.max(TOP_Y, p1.y + (p2.y - p0.y) / 5));
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = Math.min(BASELINE_Y, Math.max(TOP_Y, p2.y - (p3.y - p1.y) / 5));

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = getSmoothPath(coords);
  const areaPath = coords.length > 1
    ? `${linePath} L ${coords[coords.length - 1].x} ${BASELINE_Y} L ${coords[0].x} ${BASELINE_Y} Z`
    : "";

  const activeIdx = hoveredIdx !== null ? hoveredIdx : (coords.length > 0 ? coords.length - 1 : null);
  const activeCoord = activeIdx !== null ? coords[activeIdx] : null;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            {hasDiff && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  diffVal >= 0
                    ? "bg-[#E8F7FF] text-[#007EB8]"
                    : "bg-rose-50 text-rose-600"
                }`}
                title={`Biến động so với tuần trước: ${diffVal >= 0 ? "+" : ""}${formatDashboardCurrency(diffVal, 1, false)} ₫`}
              >
                {diffVal >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {diffVal >= 0 ? "Tăng +" : "Giảm "}
                {percentChange ? `${percentChange}%` : formatDashboardCurrency(Math.abs(diffVal), 1, true)}
                <span className="font-normal opacity-80 text-[10px]">so với tuần trước</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Số liệu thực theo tuần trong {periodWeeks} tuần gần nhất</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-[#00ADFC]" />
            <span className="h-2.5 w-2.5 rounded-full border-2 border-[#00ADFC] bg-white -ml-3 shadow-2xs" />
          </div>
          <span>Doanh thu (VNĐ)</span>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 flex h-48 items-center justify-center text-sm text-slate-400 animate-pulse">Đang tải biểu đồ đường...</div>
      ) : error ? (
        <div className="mt-3 flex h-48 items-center justify-center rounded-xl bg-[#F4FBFF] text-center text-sm text-[#007EB8]">
          Không tải được dữ liệu doanh thu. Hãy thử làm mới.
        </div>
      ) : max === 0 ? (
        <div className="mt-3 flex h-48 items-center justify-center rounded-xl bg-[#F4FBFF] text-center text-sm text-[#007EB8]">
          Chưa có doanh thu trong {periodWeeks} tuần gần nhất.
        </div>
      ) : (
        <div className="relative mt-3 h-52">
          {/* Lưới tọa độ ngang */}
          <div className="pointer-events-none absolute inset-x-0 bottom-8 top-0 flex flex-col justify-between">
            {[1, 0.75, 0.5, 0.25, 0].map((tick) => (
              <div key={tick} className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="w-12 shrink-0 text-right font-medium">{formatDashboardCurrency(max * tick, 1, true)}</span>
                <span className="h-px flex-1 border-t border-dashed border-[#D9F3FF]" />
              </div>
            ))}
          </div>

          {/* SVG Biểu đồ đường & diện tích */}
          <div className="absolute bottom-8 left-14 right-2 top-0">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revenueLineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ADFC" stopOpacity="0.32" />
                  <stop offset="65%" stopColor="#00ADFC" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#00ADFC" stopOpacity="0.00" />
                </linearGradient>
                <filter id="revenueLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#00ADFC" floodOpacity="0.28" />
                </filter>
              </defs>

              {/* Vùng đổ bóng bên dưới đường (Area) */}
              {areaPath && (
                <motion.path
                  d={areaPath}
                  fill="url(#revenueLineGradient)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                />
              )}

              {/* Đường biểu diễn (Line) */}
              {linePath && (
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="#00ADFC"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#revenueLineGlow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                />
              )}

              {/* Đường dóng dọc khi hover */}
              {activeCoord && (
                <line
                  x1={activeCoord.x}
                  y1={TOP_Y}
                  x2={activeCoord.x}
                  y2={BASELINE_Y}
                  stroke="#00ADFC"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  opacity="0.8"
                />
              )}

              {/* Các điểm mốc (Data Points) */}
              {coords.map((pt, idx) => {
                const isHovered = hoveredIdx === idx;
                const isLast = idx === coords.length - 1;
                const isSelected = isHovered || (hoveredIdx === null && isLast);

                return (
                  <g
                    key={`${pt.label}-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Vùng nhận cảm ứng hover rộng rãi */}
                    <circle cx={pt.x} cy={pt.y} r="20" fill="transparent" />

                    {/* Vòng lan tỏa khi active/hover */}
                    {isSelected && (
                      <motion.circle
                        cx={pt.x}
                        cy={pt.y}
                        r="12"
                        fill="#00ADFC"
                        initial={{ opacity: 0.2, scale: 0.8 }}
                        animate={{ opacity: [0.2, 0.45, 0.2], scale: [0.9, 1.35, 0.9] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}

                    {/* Điểm tròn trắng viền xanh thương hiệu */}
                    <motion.circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? "6.5" : "5"}
                      fill="#FFFFFF"
                      stroke="#00ADFC"
                      strokeWidth={isSelected ? "3.5" : "2.5"}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 + idx * 0.06, type: "spring" }}
                      className="transition-all hover:scale-125"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip hiển thị giá trị tăng/giảm nổi phía trên điểm active */}
            {activeCoord && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-2 transition-all duration-150"
                style={{
                  left: `${(activeCoord.x / SVG_W) * 100}%`,
                  top: `${(activeCoord.y / SVG_H) * 100}%`,
                }}
              >
                <div className="rounded-xl border border-[#B5E8FF] bg-white/95 px-3 py-1.5 shadow-lg shadow-sky-100/60 backdrop-blur-xs text-center min-w-[120px]">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{activeCoord.label}</p>
                  <strong className="block text-xs font-bold text-slate-900 tabular-nums">
                    {displayValue(activeCoord.value, "money")}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Nhãn trục hoành (Tuần) đặt thẳng hàng dưới các mốc điểm */}
          <div className="absolute bottom-0 left-14 right-2 flex items-center">
            {coords.map((pt, idx) => {
              const isSelected = (hoveredIdx === idx) || (hoveredIdx === null && idx === coords.length - 1);
              return (
                <div
                  key={`label-${pt.label}-${idx}`}
                  className="absolute -translate-x-1/2 cursor-pointer text-center transition-colors"
                  style={{ left: `${(pt.x / SVG_W) * 100}%` }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <span
                    className={`text-[11px] tabular-nums transition-all ${
                      isSelected
                        ? "font-black text-[#007EB8] scale-105"
                        : "font-semibold text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function OverviewDonutPanel({
  title,
  total,
  highlighted,
  highlightedLabel,
  remainderLabel,
  loading = false,
}: {
  title: string;
  total: number;
  highlighted: number;
  highlightedLabel: string;
  remainderLabel: string;
  loading?: boolean;
}) {
  const safeTotal = number(total);
  const safeHighlighted = Math.min(number(highlighted), safeTotal);
  const remainder = Math.max(0, safeTotal - safeHighlighted);
  const percentage = safeTotal ? (safeHighlighted / safeTotal) * 100 : 0;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm" aria-label={title}>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400 animate-pulse">Đang tải biểu đồ...</div>
      ) : (
        <>
          <div className="flex items-center gap-4 py-3">
            <motion.div
              initial={{ scale: 0.65, opacity: 0, rotate: -25 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 17, delay: 0.1 }}
              whileHover={{ scale: 1.06 }}
              className="grid h-28 w-28 shrink-0 place-items-center rounded-full shadow-xs cursor-pointer transition-transform duration-300"
              style={{
                background: safeTotal
                  ? `conic-gradient(${DASHBOARD_CHART_PALETTE[0]} ${percentage}%, ${DASHBOARD_CHART_PALETTE[4]} 0)`
                  : DASHBOARD_CHART_TRACK,
              }}
              role="img"
              aria-label={`${highlightedLabel}: ${safeHighlighted}; ${remainderLabel}: ${remainder}`}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: "spring" }}
                className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-white shadow-2xs"
              >
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Tổng số</span>
                <strong className="text-2xl font-bold tabular-nums text-slate-900">{safeTotal.toLocaleString("vi-VN")}</strong>
                <span className="text-[10px] text-slate-500">học viên</span>
              </motion.div>
            </motion.div>
            <div className="min-w-0 flex-1 space-y-2 text-xs">
              {[
                { label: highlightedLabel, value: safeHighlighted, color: DASHBOARD_CHART_PALETTE[0] },
                { label: remainderLabel, value: remainder, color: DASHBOARD_CHART_PALETTE[4] },
              ].map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + idx * 0.1 }}
                  className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-slate-50"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1 text-slate-600">{item.label}</span>
                  <strong className="font-semibold tabular-nums text-slate-800">
                    {item.value.toLocaleString("vi-VN")} ({safeTotal ? Math.round((item.value / safeTotal) * 100) : 0}%)
                  </strong>
                </motion.div>
              ))}
              {safeTotal === 0 && <p className="pt-1 text-slate-400">Chưa có số liệu phát sinh.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
