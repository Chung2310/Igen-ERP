import type { ReactNode } from "react";
import { cn } from "../../modules/student-management/lib/utils";

export type HrStatDotTone = "blue" | "green" | "amber" | "rose" | "violet" | "slate";

export interface HrStatCardItem {
  dot?: HrStatDotTone;
  count?: ReactNode;
  label: ReactNode;
}

const DOT_CLASSES: Record<HrStatDotTone, string> = {
  blue: "bg-[#2196F3]",
  green: "bg-[#18C93A]",
  amber: "bg-[#F5D610]",
  rose: "bg-[#F44336]",
  violet: "bg-[#8B5CF6]",
  slate: "bg-slate-300",
};

interface HrStatCardProps {
  title: string;
  value: ReactNode;
  unit?: string;
  items?: HrStatCardItem[];
  compactValue?: boolean;
  className?: string;
  active?: boolean;
  activeTone?: "primary" | "rose";
  onClick?: () => void;
  ariaLabel?: string;
  footer?: ReactNode;
  srOnlyNote?: string;
}

export function HrStatCard({
  title,
  value,
  unit,
  items = [],
  compactValue = false,
  className,
  active = false,
  activeTone = "primary",
  onClick,
  ariaLabel,
  footer,
  srOnlyNote,
}: HrStatCardProps) {
  const interactive = Boolean(onClick);
  const rootClassName = cn(
    "hr-stat-card flex min-w-0 flex-col overflow-hidden rounded-[4px] border bg-white text-left text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors",
    interactive && "cursor-pointer focus-visible:outline-2 focus-visible:outline-primary",
    active
      ? activeTone === "rose"
        ? "border-rose-400 bg-rose-50/40 ring-1 ring-rose-200"
        : "border-[#2563EB] bg-sky-50/40 ring-1 ring-[#2563EB]/20"
      : interactive
        ? activeTone === "rose"
          ? "border-slate-200/90 hover:border-rose-300 hover:bg-rose-50/20"
          : "border-slate-200/90 hover:border-sky-300 hover:bg-slate-50/60"
        : "border-slate-200/90",
    className,
  );

  const content = (
    <>
      <div className="border-b border-slate-100 px-3.5 py-2">
        <p className="truncate text-[13px] font-semibold leading-5 text-slate-900" title={title}>
          {title}
        </p>
      </div>
      <div className="flex flex-1 items-center gap-3.5 px-3.5 py-3">
        <div
          className={cn(
            "shrink-0 leading-none tracking-tight tabular-nums text-slate-900",
            compactValue ? "text-lg font-medium sm:text-xl" : "text-[28px] font-normal",
          )}
        >
          {value}
        </div>
        {(unit || items.length > 0) && (
          <div className="min-w-0 flex-1 space-y-1">
            {unit && (
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {unit}
              </p>
            )}
            {items.length > 0 && (
              <div className="space-y-0.5">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-slate-600"
                  >
                    <span
                      className={cn("size-2 shrink-0 rounded-full", DOT_CLASSES[item.dot || "blue"])}
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {item.count !== undefined && (
                        <strong className="mr-1 font-semibold tabular-nums text-slate-900">
                          {item.count}
                        </strong>
                      )}
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {footer && <div className="px-3.5 pb-2.5">{footer}</div>}
      {srOnlyNote && <span className="sr-only">{srOnlyNote}</span>}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={rootClassName}>
        {content}
      </button>
    );
  }

  return <div className={rootClassName}>{content}</div>;
}
