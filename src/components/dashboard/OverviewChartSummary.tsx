import type { ReactNode } from "react";

export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous) * 100;
}

export function previousCalendarMonth(now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

export function yesterday(now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function OverviewChartSummary({ value, previous, format, metricLabel, onDetails, detailsHref, action }: {
  value: number | null | undefined;
  previous?: number | null;
  format?: (value: number) => string;
  metricLabel: string;
  onDetails?: () => void;
  detailsHref?: string;
  action?: ReactNode;
}) {
  const change = percentChange(value, previous);
  const comparable = value != null && previous != null && Number.isFinite(value) && Number.isFinite(previous);
  const difference = comparable ? value - previous : null;
  const formatted = value == null ? "—" : format ? format(value) : value.toLocaleString("vi-VN");
  const absoluteDifference = difference == null ? "" : format ? format(Math.abs(difference)) : Math.abs(difference).toLocaleString("vi-VN");
  const delta = difference == null ? "—" : difference === 0 ? "–" : `${difference > 0 ? "▲ " : "▼ "}${change == null ? absoluteDifference : `${Math.abs(change).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`}`;
  const changeLabel = difference == null ? "Chưa có dữ liệu kỳ so sánh" : difference === 0 ? "Không thay đổi so với kỳ trước" : `${difference > 0 ? "Tăng" : "Giảm"} ${change == null ? `${absoluteDifference} so với kỳ trước (0)` : `${Math.abs(change).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% so với kỳ trước`}`;
  return <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-2">
    <div className="flex min-w-0 items-baseline gap-2"><strong className="min-w-0 break-words text-xl font-semibold tabular-nums text-on-surface" aria-label={`${metricLabel}: ${formatted}`}>{formatted}</strong><span className={`shrink-0 text-xs font-semibold tabular-nums ${difference == null ? "text-on-surface-variant" : difference > 0 ? "text-change-up" : difference < 0 ? "text-change-down" : "text-change-flat"}`} aria-label={changeLabel}>{delta}</span></div>
    <div className="flex items-center gap-2">{action}{onDetails ? <button type="button" className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={onDetails}>Chi tiết</button> : detailsHref ? <a className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={detailsHref}>Chi tiết</a> : null}</div>
  </div>;
}
