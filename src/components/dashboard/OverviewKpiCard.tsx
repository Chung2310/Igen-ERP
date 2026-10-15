import React from "react";
import { motion } from "motion/react";
import { DASHBOARD_CHART_PALETTE, DASHBOARD_CHART_TRACK } from "./dashboardPalette";

export function OverviewKpiCard({
  icon: Icon,
  label,
  value,
  unit,
  detail,
  progress,
  emphasis = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  progress?: number;
  emphasis?: boolean;
}) {
  const safeProgress = progress == null || !Number.isFinite(progress) ? null : Math.max(0, Math.min(100, progress));

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={`flex min-w-0 flex-col justify-between rounded-2xl border bg-white px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md ${emphasis ? "border-[#B5E8FF]" : "border-slate-200/80"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`min-w-0 text-xs font-medium leading-5 ${emphasis ? "text-[#007EB8]" : "text-slate-500"}`}>{label}</p>
        <Icon className={`h-4 w-4 shrink-0 transition-transform hover:scale-110 ${emphasis ? "text-[#00ADFC]" : "text-slate-400"}`} />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <strong className="min-w-0 truncate text-xl font-black tabular-nums tracking-tight text-slate-900" title={value}>{value}</strong>
        {unit && <span className="shrink-0 text-[10px] font-medium text-slate-400">{unit}</span>}
      </div>
      {safeProgress != null ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ backgroundColor: DASHBOARD_CHART_TRACK }} role="img" aria-label={`${label}: ${safeProgress}%`}>
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: emphasis ? DASHBOARD_CHART_PALETTE[0] : DASHBOARD_CHART_PALETTE[1] }}
            initial={{ width: 0 }}
            animate={{ width: `${safeProgress}%` }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      ) : (
        <div className="mt-2 h-1" />
      )}
      <p className="mt-1.5 min-h-4 truncate text-[10px] font-medium text-slate-500" title={detail}>{detail || ""}</p>
    </motion.article>
  );
}
