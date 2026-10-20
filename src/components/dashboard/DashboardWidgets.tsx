import React, { useState } from "react";
import { motion } from "motion/react";
import { Tone, toneClass, formatDashboardCurrency } from "./dashboardUtils";
import { DASHBOARD_CHART_PALETTE, DASHBOARD_CHART_TRACK } from "./dashboardPalette";

export function ModuleCard({
  icon: Icon,
  tone,
  title,
  value,
  label,
  footer,
  footerValue,
  alert,
  lowCount,
  onClick,
}: {
  icon: React.ElementType;
  tone: Tone;
  title: string;
  value: string;
  label: string;
  footer: string;
  footerValue: string;
  progress?: number;
  alert?: boolean;
  lowCount?: string;
  onClick?: () => void;
}) {
  const color = toneClass[tone];
  const isAlertActive = alert && lowCount && lowCount !== "0" && lowCount !== "...";
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${color.soft} ${color.text} group-hover:scale-110 transition-transform duration-200`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          </div>
          {isAlertActive && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 ring-1 ring-rose-500/10 animate-pulse">
              Cảnh báo: {lowCount}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="font-sans text-2xl font-black tracking-tight text-slate-800 truncate" title={value}>
            {value}
          </span>
          <span className="text-xs text-slate-400 font-medium truncate">{label}</span>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="text-slate-400 font-medium truncate pr-2">{footer}</span>
        <span className={`font-bold shrink-0 ${color.strong}`}>{footerValue}</span>
      </div>
    </motion.div>
  );
}

export function MetricCard({ icon: Icon, label, value, delta, tone = "blue", negative = false }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  const badgeColor = negative ? "bg-rose-50 text-rose-600 ring-rose-500/10" : "bg-sky-50 text-[#00ADFC] ring-sky-500/10";
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm hover:shadow-md transition-all duration-300"
    >
      <div className="mb-6 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color.soft} ${color.text}`}>
          <Icon className="h-5.5 w-5.5" />
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${badgeColor}`}>
          {delta}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-gray-800 truncate" title={value}>{value}</p>
    </motion.div>
  );
}

export function DonutCard({
  compact = false,
  segments,
  title = "",
  centerLabel = "Tổng số",
  centerValue,
}: {
  compact?: boolean;
  segments?: Array<{ label: string; value: number; color: string; display?: string }>;
  title?: string;
  centerLabel?: string;
  centerValue?: string;
}) {
  const radius = 66;
  const circumference = 2 * Math.PI * radius;

  let localSegments = segments || [];
  let localCenterValue = centerValue || "";

  if (localSegments.length === 0) {
    localSegments = [
      { label: "Chưa có dữ liệu", value: 100, color: DASHBOARD_CHART_TRACK, display: "0 bài" }
    ];
    localCenterValue = "0";
  }

  let cumulativeOffset = 0;

  return (
    <div className={compact ? "" : "rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs hover:shadow-sm transition-all duration-300"}>
      {!compact && title && <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-slate-800">{title}</h3>}

      <div className="flex flex-col items-center gap-5 w-full">
        <div className="relative h-40 w-40 shrink-0">
          <motion.svg
            initial={{ rotate: -90, scale: 0.8, opacity: 0 }}
            animate={{ rotate: -90, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="h-full w-full"
            viewBox="0 0 180 180"
            aria-label={title}
          >
            <circle cx="90" cy="90" r={radius} fill="none" stroke={DASHBOARD_CHART_TRACK} strokeWidth="24" />
            {localSegments.map((segment, idx) => {
              const dash = (segment.value / 100) * circumference;
              const currentOffset = cumulativeOffset;
              cumulativeOffset += dash;

              return (
                <motion.circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="24"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: -currentOffset }}
                  transition={{
                    duration: 0.9,
                    delay: 0.1 + idx * 0.12,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="cursor-pointer transition-opacity hover:opacity-85"
                >
                  <title>{`${segment.label}: ${segment.display || `${segment.value}%`}`}</title>
                </motion.circle>
              );
            })}
          </motion.svg>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          >
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{centerLabel}</span>
            <strong className="font-sans text-xl font-bold text-slate-900">{localCenterValue}</strong>
          </motion.div>
        </div>
        <div className="w-full space-y-2.5 text-xs border-t border-slate-100/85 pt-4">
          {localSegments.map((segment, idx) => (
            <motion.div
              key={segment.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + idx * 0.08 }}
            >
              <Legend color={segment.color} label={segment.label} value={segment.display || `${segment.value}%`} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BarChart({ data = [] }: { data?: Array<{ label: string; value: number }> }) {
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const rawMax = Math.max(...data.map(d => d.value), 0);
  const hasData = rawMax > 0;
  const maxVal = hasData ? rawMax : 1;

  if (!hasData) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#CBEFFF] bg-[#F4FBFF] text-sm font-medium text-[#007EB8]">
        Chưa có dữ liệu doanh thu trong kỳ.
      </div>
    );
  }

  const formatCurrencyShort = (val: number) => {
    return formatDashboardCurrency(val, 1, true);
  };

  const SVG_W = 1000;
  const SVG_H = 220;
  const TOP_Y = 18;
  const BASELINE_Y = 185;
  const PLOT_H = BASELINE_Y - TOP_Y;
  const LEFT_X = 50;
  const RIGHT_X = 950;
  const PLOT_W = RIGHT_X - LEFT_X;

  const coords = data.map((item, i) => {
    const x = data.length === 1 ? 500 : LEFT_X + (i / (data.length - 1)) * PLOT_W;
    const y = BASELINE_Y - (item.value / maxVal) * PLOT_H;
    return { x, y, label: item.label, value: item.value };
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
    <div className="space-y-3">
      {/* Nút chuyển đổi kiểu biểu đồ */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setChartType("line")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              chartType === "line" ? "bg-white text-[#007EB8] shadow-xs font-bold" : "hover:text-slate-900"
            }`}
          >
            Biểu đồ đường
          </button>
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              chartType === "bar" ? "bg-white text-[#007EB8] shadow-xs font-bold" : "hover:text-slate-900"
            }`}
          >
            Cột
          </button>
        </div>
      </div>

      <div className="relative h-[290px]">
        {/* Lưới ngang */}
        <div className="absolute inset-x-0 bottom-8 top-0 flex flex-col justify-between text-xs font-semibold text-slate-400">
          {[
            formatCurrencyShort(rawMax),
            formatCurrencyShort(rawMax * 2 / 3),
            formatCurrencyShort(rawMax / 3),
            "₫0"
          ].map((y, idx) => (
            <div key={idx} className="flex items-center gap-3 h-0">
              <span className="w-12 shrink-0 text-left font-medium">{y}</span>
              <span className="h-px flex-1 border-t border-dashed border-[#D9F3FF]" />
            </div>
          ))}
        </div>

        {chartType === "line" ? (
          <div className="absolute bottom-8 left-16 right-2 top-0">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="widgetRevenueLineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ADFC" stopOpacity="0.30" />
                  <stop offset="70%" stopColor="#00ADFC" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#00ADFC" stopOpacity="0.00" />
                </linearGradient>
                <filter id="widgetLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#00ADFC" floodOpacity="0.25" />
                </filter>
              </defs>

              {areaPath && (
                <motion.path
                  d={areaPath}
                  fill="url(#widgetRevenueLineGrad)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                />
              )}

              {linePath && (
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="#00ADFC"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#widgetLineGlow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              )}

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

              {coords.map((pt, idx) => {
                const isHovered = hoveredIdx === idx;
                const isLast = idx === coords.length - 1;
                const isSelected = isHovered || (hoveredIdx === null && isLast);

                return (
                  <g
                    key={`dot-${pt.label}-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <circle cx={pt.x} cy={pt.y} r="20" fill="transparent" />

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

                    <motion.circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? "6.5" : "5"}
                      fill="#FFFFFF"
                      stroke="#00ADFC"
                      strokeWidth={isSelected ? "3.5" : "2.5"}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15 + idx * 0.04, type: "spring" }}
                      className="transition-all hover:scale-125"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip khi hover hoặc active */}
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
                    {formatDashboardCurrency(activeCoord.value, 1, false)} ₫
                  </strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute bottom-8 left-16 right-4 top-4 flex items-end justify-between gap-4">
            {data.map((item, i) => {
              const h = (item.value / maxVal) * 80;
              const isCurrent = i === data.length - 1;
              return (
                <div key={i} className="group/bar flex flex-1 flex-col items-center gap-2 h-full justify-end">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <motion.div
                      initial={{ height: 0, opacity: 0.2 }}
                      animate={{ height: `${h}%`, opacity: 1 }}
                      transition={{
                        duration: 0.75,
                        delay: i * 0.05,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{ scaleY: 1.05, filter: "brightness(1.1)" }}
                      title={`${item.label}: ${item.value.toLocaleString("vi-VN")} ₫`}
                      className={`w-full max-w-16 rounded-t-lg origin-bottom cursor-pointer transition-all ${
                        isCurrent ? "shadow-lg shadow-[#00ADFC]/30 ring-1 ring-[#00ADFC]/40" : "hover:shadow-md hover:shadow-sky-100"
                      }`}
                      style={{
                        backgroundColor: isCurrent ? DASHBOARD_CHART_PALETTE[0] : DASHBOARD_CHART_PALETTE[1 + (i % 3)],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Nhãn trục hoành */}
        <div className="absolute bottom-0 left-16 right-2 flex items-center">
          {coords.map((pt, idx) => {
            const isSelected = (hoveredIdx === idx) || (hoveredIdx === null && idx === coords.length - 1);
            return (
              <div
                key={`lbl-${pt.label}-${idx}`}
                className="absolute -translate-x-1/2 cursor-pointer text-center transition-colors"
                style={{ left: `${(pt.x / SVG_W) * 100}%` }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <span
                  className={`text-[10px] tabular-nums transition-all ${
                    isSelected
                      ? "font-bold text-[#007EB8] scale-105"
                      : "font-semibold text-slate-500 hover:text-slate-900"
                  }`}
                  style={{
                    visibility: data.length >= 10 && idx % 2 !== 0 && idx !== data.length - 1 && !isSelected ? "hidden" : "visible"
                  }}
                >
                  {pt.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WorkloadChart() {
  const ai = [56, 66, 78, 70, 82, 39, 31];
  const human = [39, 35, 44, 31, 48, 22, 18];
  return (
    <div className="relative h-[360px] border-t border-gray-100 pt-8">
      <div className="absolute left-0 top-12 flex h-64 flex-col justify-between text-xs text-gray-400">
        <span>10k</span><span>7.5k</span><span>5k</span><span>2.5k</span><span>0</span>
      </div>
      <div className="ml-12 flex h-72 items-end justify-between gap-5">
        {ai.map((v, i) => (
          <div key={i} className="group/workload flex flex-1 flex-col items-center gap-3">
            <div className="flex h-64 items-end gap-3">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${human[i]}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
                whileHover={{ scaleY: 1.05 }}
                className="w-7 rounded-t bg-sky-100 ring-1 ring-sky-200 origin-bottom cursor-pointer hover:bg-sky-200 transition-colors"
                title={`Thủ công: ${human[i]}%`}
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${v}%` }}
                transition={{ duration: 0.7, delay: i * 0.05 + 0.1, ease: "easeOut" }}
                whileHover={{ scaleY: 1.05 }}
                className="w-7 rounded-t bg-[#00ADFC] shadow-sm shadow-sky-400/30 origin-bottom cursor-pointer hover:brightness-110 transition-all"
                title={`AI xử lý: ${v}%`}
              />
            </div>
            <span className="text-sm font-semibold text-gray-600 group-hover/workload:text-slate-900 transition-colors">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AiInsightCard({ icon: Icon, title, body, action, color, onAction }: any) {
  const border = color === "red" ? "border-l-red-500" : color === "amber" ? "border-l-amber-500" : "border-l-blue-500";
  const text = color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : "text-blue-600";
  const bg = color === "red" ? "bg-red-50" : color === "amber" ? "bg-amber-50" : "bg-blue-50";
  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`rounded-2xl border border-slate-100 border-l-4 ${border} bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow duration-200`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-4.5 w-4.5 ${text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-gray-850 truncate">{title}</h4>
          <p className="mt-2 text-xs leading-relaxed text-gray-655">{body}</p>
        </div>
      </div>
      {action && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onAction}
            className="inline-flex rounded-full bg-[#00ADFC] hover:bg-[#0095d9] text-white px-3.5 py-1.5 text-xs font-bold transition shadow-2xs hover:shadow-xs cursor-pointer"
          >
            {action}
          </button>
        </div>
      )}
    </motion.div>
  );
}

export function Legend({ color, label, value }: any) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 text-xs group/legend">
      <span className="flex min-w-0 items-center gap-2 text-slate-600">
        <i className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover/legend:scale-125" style={{ backgroundColor: color }} />
        <span className="truncate font-medium text-left group-hover/legend:text-slate-900 transition-colors">{label}</span>
      </span>
      <strong className="font-mono text-slate-800 font-bold shrink-0">{value}</strong>
    </div>
  );
}
