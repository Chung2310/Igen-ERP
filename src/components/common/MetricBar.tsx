import React from "react";

export type MetricBarTone = "default" | "emerald" | "blue" | "rose" | "amber" | "indigo" | "purple";

export interface MetricBarItem {
  id?: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  subtext?: React.ReactNode;
  tone?: MetricBarTone;
  isActive?: boolean;
  onClick?: () => void;
  valueClassName?: string;
  className?: string;
}

export interface MetricBarProps {
  items: MetricBarItem[];
  columns?: 2 | 3 | 4;
  className?: string;
  id?: string;
}

const toneStyles: Record<MetricBarTone, { active: string; hover: string; defaultValue: string; defaultSubtext?: string }> = {
  default: {
    active: "bg-slate-50/80",
    hover: "hover:bg-slate-50/50",
    defaultValue: "text-slate-900",
  },
  emerald: {
    active: "bg-emerald-50/60",
    hover: "hover:bg-emerald-50/30",
    defaultValue: "text-emerald-700",
    defaultSubtext: "text-emerald-600",
  },
  blue: {
    active: "bg-blue-50/60",
    hover: "hover:bg-blue-50/30",
    defaultValue: "text-blue-700",
    defaultSubtext: "text-blue-600",
  },
  rose: {
    active: "bg-rose-50/60",
    hover: "hover:bg-rose-50/30",
    defaultValue: "text-rose-700",
    defaultSubtext: "text-rose-600",
  },
  amber: {
    active: "bg-amber-50/60",
    hover: "hover:bg-amber-50/30",
    defaultValue: "text-amber-700",
    defaultSubtext: "text-amber-600",
  },
  indigo: {
    active: "bg-indigo-50/60",
    hover: "hover:bg-indigo-50/30",
    defaultValue: "text-indigo-700",
    defaultSubtext: "text-indigo-600",
  },
  purple: {
    active: "bg-purple-50/60",
    hover: "hover:bg-purple-50/30",
    defaultValue: "text-purple-700",
    defaultSubtext: "text-purple-600",
  },
};

export function MetricBar({ items, columns = 4, className = "", id }: MetricBarProps) {
  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-2 lg:grid-cols-4";

  return (
    <div
      id={id}
      className={`grid ${colClass} rounded-xl border border-slate-200 bg-white shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-hidden ${className}`}
    >
      {items.map((item, index) => {
        const tone = item.tone || "default";
        const toneStyle = toneStyles[tone] || toneStyles.default;
        const isClickable = Boolean(item.onClick);
        const activeClass = item.isActive ? toneStyle.active : "";
        const hoverClass = isClickable && !item.isActive ? toneStyle.hover : "";
        const valueColor = item.valueClassName || toneStyle.defaultValue;

        return (
          <div
            key={item.id ?? index}
            tabIndex={isClickable ? 0 : undefined}
            onClick={item.onClick}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                item.onClick?.();
              }
            }}
            className={`p-3.5 transition-colors ${isClickable ? "cursor-pointer select-none" : ""} ${activeClass} ${hoverClass} ${item.className || ""}`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
              {item.label}
            </span>
            <p className={`mt-1 text-lg font-black tabular-nums leading-none ${valueColor}`}>
              {item.value}{" "}
              {item.unit ? (
                <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
              ) : null}
            </p>
            {item.subtext ? (
              <span className={`text-[11px] font-medium block mt-1 ${typeof item.subtext === "string" ? "text-slate-400" : ""}`}>
                {item.subtext}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
