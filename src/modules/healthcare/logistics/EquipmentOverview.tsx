import { Activity, AlertTriangle, CheckCircle2, Clock, Monitor, Wrench } from "lucide-react";
import type { HealthcareApi } from "../api";
import { cn } from "../../student-management/lib/utils";
import { Feedback, useHealthcareQuery } from "../ui";

const metricCards = [
  {
    key: "total",
    label: "Tổng thiết bị",
    icon: Monitor,
    iconTone: "logistics-kpi-icon--primary",
    filterKey: null,
    filterValue: "",
  },
  {
    key: "available",
    label: "Sẵn sàng",
    icon: CheckCircle2,
    iconTone: "logistics-kpi-icon--success",
    filterKey: "status",
    filterValue: "available",
  },
  {
    key: "inUse",
    label: "Đang sử dụng",
    icon: Activity,
    iconTone: "logistics-kpi-icon--info",
    filterKey: "status",
    filterValue: "in-use",
  },
  {
    key: "maintenance",
    label: "Bảo dưỡng",
    icon: Wrench,
    iconTone: "logistics-kpi-icon--warning",
    filterKey: "status",
    filterValue: "maintenance",
  },
  {
    key: "overdue",
    label: "Quá hạn kiểm định",
    icon: AlertTriangle,
    iconTone: "logistics-kpi-icon--danger",
    filterKey: "inspectionStatus",
    filterValue: "overdue",
  },
  {
    key: "dueSoon",
    label: "Đến hạn 30 ngày",
    icon: Clock,
    iconTone: "logistics-kpi-icon--warning",
    filterKey: "inspectionStatus",
    filterValue: "soon",
  },
] as const;

export default function EquipmentOverview({
  api,
  filters,
  onToggleFilter,
  onResetFilters,
}: {
  api: HealthcareApi;
  filters: Record<string, string>;
  onToggleFilter: (key: string, value: string) => void;
  onResetFilters: () => void;
}) {
  const stats = useHealthcareQuery<Record<string, number>>(api, "/logistics/overview/equipment");

  if (stats.loading && !stats.data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-busy="true" aria-label="Đang tải thống kê thiết bị">
        {metricCards.map(({ key }) => (
          <div
            key={key}
            className="h-[74px] rounded-lg border border-outline-variant bg-surface-container-lowest p-3.5"
          >
            <div className="h-3 w-20 rounded bg-surface-container" />
            <div className="mt-2.5 h-6 w-10 rounded bg-surface-container" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats.data && !stats.error) return null;

  return (
    <div className="space-y-2">
      <Feedback error={stats.error} onRetry={stats.refresh} />
      {stats.data && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {metricCards.map(({ key, label, icon: Icon, iconTone, filterKey, filterValue }) => {
            const count = stats.data![key] ?? 0;
            const active = filterKey ? filters[filterKey] === filterValue : false;
            const isOverdueAlert = key === "overdue" && count > 0;
            return (
              <div key={key}>
                <button
                  type="button"
                  aria-pressed={filterKey ? active : undefined}
                  onClick={() => {
                    if (!filterKey) {
                      onResetFilters();
                    } else {
                      onToggleFilter(filterKey, active ? "" : filterValue);
                    }
                  }}
                  className={cn(
                    "flex h-full w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg border bg-surface-container-lowest px-3.5 py-3 text-left shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-outline-variant hover:border-primary/40 hover:bg-surface-container-low/50",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <dt className="truncate text-xs text-on-surface-variant" title={label}>
                      {label}
                    </dt>
                    <dd
                      className={cn(
                        "text-xl font-semibold leading-tight tabular-nums",
                        isOverdueAlert ? "text-error" : "text-on-surface",
                      )}
                    >
                      {count.toLocaleString("vi-VN")}
                    </dd>
                  </div>
                  <span
                    className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", iconTone)}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                </button>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
