import React from "react";
import { motion } from "motion/react";
import { formatDashboardCurrency } from "./dashboardUtils";
import { DASHBOARD_CHART_PALETTE, DASHBOARD_CHART_TRACK } from "./dashboardPalette";

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
  const points = series.slice(-periodWeeks);
  const max = Math.max(0, ...points.map((point) => number(point.value)));

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">Số liệu thực theo tuần trong {periodWeeks} tuần gần nhất</p>
        </div>
        <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DASHBOARD_CHART_PALETTE[0] }} />
          Doanh thu (VNĐ)
        </span>
      </div>
      {loading ? (
        <div className="mt-3 flex h-44 items-center justify-center text-sm text-slate-400 animate-pulse">Đang tải biểu đồ...</div>
      ) : error ? (
        <div className="mt-3 flex h-44 items-center justify-center rounded-xl bg-[#F4FBFF] text-center text-sm text-[#007EB8]">
          Không tải được dữ liệu doanh thu. Hãy thử làm mới.
        </div>
      ) : max === 0 ? (
        <div className="mt-3 flex h-44 items-center justify-center rounded-xl bg-[#F4FBFF] text-center text-sm text-[#007EB8]">
          Chưa có doanh thu trong {periodWeeks} tuần gần nhất.
        </div>
      ) : (
        <div className="relative mt-3 h-48">
          <div className="pointer-events-none absolute inset-x-0 bottom-7 top-0 flex flex-col justify-between">
            {[1, 0.75, 0.5, 0.25, 0].map((tick) => (
              <div key={tick} className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="w-12 shrink-0 text-right font-medium">{formatDashboardCurrency(max * tick, 1, true)}</span>
                <span className="h-px flex-1 border-t border-dashed border-[#D9F3FF]" />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-14 bottom-0 top-0 flex items-end justify-around gap-2 sm:gap-4">
            {points.map((point, index) => {
              const value = number(point.value);
              const targetHeight = value > 0 ? Math.max(3, (value / max) * 100) : 0;
              const isCurrent = index === points.length - 1;
              return (
                <div key={`${point.label}-${index}`} className="group/bar flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <motion.div
                      initial={{ height: 0, opacity: 0.2 }}
                      animate={{ height: `${targetHeight}%`, opacity: 1 }}
                      transition={{
                        duration: 0.75,
                        delay: index * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={{ scaleY: 1.05, filter: "brightness(1.1)" }}
                      className={`w-full max-w-14 cursor-pointer rounded-t-lg origin-bottom transition-all ${
                        isCurrent
                          ? "shadow-md shadow-[#00ADFC]/30 ring-1 ring-[#00ADFC]/40"
                          : "hover:shadow-md hover:shadow-sky-100"
                      }`}
                      style={{
                        backgroundColor: isCurrent ? DASHBOARD_CHART_PALETTE[0] : DASHBOARD_CHART_PALETTE[1 + (index % 3)],
                      }}
                      title={`${point.label}: ${displayValue(value, "money")}`}
                      role="img"
                      aria-label={`${point.label}: ${displayValue(value, "money")}`}
                    />
                  </div>
                  <span
                    className={`w-full truncate text-center text-[10px] transition-colors ${
                      isCurrent ? "font-bold text-[#007EB8]" : "font-medium text-slate-500 group-hover/bar:text-slate-900"
                    }`}
                    title={point.label}
                  >
                    {point.label}
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
