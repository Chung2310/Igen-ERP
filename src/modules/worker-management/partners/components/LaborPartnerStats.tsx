import type { LucideIcon } from "lucide-react";
import { cn } from "../../../student-management/lib/utils";

type Stat = {
  label: string;
  value: string;
  Icon: LucideIcon;
  tone: "total" | "active" | "employees" | "without-manager";
};

export function LaborPartnerStats({ items }: { items: Stat[] }) {
  return (
    <dl className={cn("labor-partner-stats grid grid-cols-1 gap-3 sm:grid-cols-2", items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {items.map(({ label, value, Icon, tone }) => (
        <div key={label} className={`labor-partner-stat-card labor-partner-stat-card--${tone} flex min-w-0 items-center justify-between gap-3 rounded-xl p-3 text-on-primary`}>
          <div className="min-w-0">
            <dt className="truncate text-xs font-medium" title={label}>{label}</dt>
            <dd className="truncate tabular-nums text-lg font-semibold leading-tight sm:text-xl" title={value}>{value}</dd>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-on-primary/15">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        </div>
      ))}
    </dl>
  );
}
