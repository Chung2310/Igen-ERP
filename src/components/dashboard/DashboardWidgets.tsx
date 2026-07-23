import React from "react";
import { Tone, toneClass, formatDashboardCurrency } from "./dashboardUtils";

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
    <div
      onClick={onClick}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md hover:border-slate-300 cursor-pointer"
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${color.soft} ${color.text} group-hover:scale-105 transition-transform`}>
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
    </div>
  );
}

export function MetricCard({ icon: Icon, label, value, delta, tone = "blue", negative = false }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  const badgeColor = negative ? "bg-rose-50 text-rose-600 ring-rose-500/10" : "bg-emerald-50 text-emerald-600 ring-emerald-500/10";
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm hover:shadow-md transition-all duration-300">
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
    </div>
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
      { label: "Chưa có dữ liệu", value: 100, color: "#cbd5e1", display: "0 bài" }
    ];
    localCenterValue = "0";
  }

  let offset = 0;

  return (
    <div className={compact ? "" : "rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300"}>
      {!compact && title && <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-gray-800">{title}</h3>}

      <div className="flex flex-col items-center gap-5 w-full">
        <div className="relative h-40 w-40 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180" aria-label={title}>
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#f8fafc" strokeWidth="24" />
            {localSegments.map((segment) => {
              const dash = (segment.value / 100) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="24"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${segment.label}: ${segment.display || `${segment.value}%`}`}</title>
                </circle>
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{centerLabel}</span>
            <strong className="font-sans text-xl font-extrabold text-gray-800">{localCenterValue}</strong>
          </div>
        </div>
        <div className="w-full space-y-2.5 text-xs border-t border-slate-100/85 pt-4">
          {localSegments.map((segment) => (
            <Legend key={segment.label} color={segment.color} label={segment.label} value={segment.display || `${segment.value}%`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BarChart({ data = [] }: { data?: Array<{ label: string; value: number }> }) {
  const rawMax = Math.max(...data.map(d => d.value), 0);
  const hasData = rawMax > 0;
  const maxVal = hasData ? rawMax : 1; // only used for bar heights when hasData

  const formatCurrencyShort = (val: number) => {
    if (!hasData) return "₫0";
    return formatDashboardCurrency(val, 1, true);
  };

  return (
    <div className="relative h-[320px]">
      <div className="absolute inset-x-0 bottom-10 top-0 flex flex-col justify-between text-xs font-semibold text-gray-400">
        {[
          formatCurrencyShort(rawMax),
          formatCurrencyShort(rawMax * 2 / 3),
          formatCurrencyShort(rawMax / 3),
          "₫0"
        ].map((y, idx) => (
          <div key={idx} className="flex items-center gap-3 h-0">
            <span className="w-12 shrink-0 text-left">{y}</span>
            <span className="h-px flex-1 border-t border-dashed border-slate-100" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-16 right-4 top-6 flex items-end justify-between gap-4">
        {data.map((item, i) => {
          const h = (item.value / maxVal) * 80; // keep max at 80% to fit neatly
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
              <div
                title={`${item.label}: ${item.value.toLocaleString("vi-VN")} ₫`}
                className={`w-full max-w-16 rounded-t-lg transition-all duration-500 ${
                  i === data.length - 1
                    ? "bg-gradient-to-t from-blue-600 to-indigo-500 shadow-md shadow-blue-500/20"
                    : "bg-gradient-to-t from-slate-200 to-slate-100 hover:from-blue-300 hover:to-blue-200"
                }`}
                style={{ height: `${h}%` }}
              />
              <span
                className={`text-[10px] font-bold mt-1 ${i === data.length - 1 ? "text-blue-600" : "text-gray-450"} truncate max-w-full`}
                title={item.label}
                style={{ visibility: data.length >= 8 && i % 2 !== 0 && i !== data.length - 1 ? "hidden" : "visible" }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
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
          <div key={i} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-64 items-end gap-3">
              <div className="w-7 rounded-t bg-blue-100 ring-1 ring-blue-200" style={{ height: `${human[i]}%` }} />
              <div className="w-7 rounded-t bg-blue-500" style={{ height: `${v}%` }} />
            </div>
            <span className="text-sm text-gray-600">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}</span>
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
    <div className={`rounded-2xl border border-slate-100 border-l-4 ${border} bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow duration-200`}>
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
            className="inline-flex rounded-full bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-2xs hover:shadow-xs cursor-pointer"
          >
            {action}
          </button>
        </div>
      )}
    </div>
  );
}

export function Legend({ color, label, value }: any) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-gray-655">
        <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate font-semibold text-left">{label}</span>
      </span>
      <strong className="font-mono text-gray-800 font-bold shrink-0">{value}</strong>
    </div>
  );
}
