import { cn } from "../../modules/student-management/lib/utils";

const integer = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

export function OverviewKpiDelta({ value, previous, unit = "đ" }: { value: number | null | undefined; previous: number | null | undefined; unit?: string }) {
  if (value == null || previous == null) return <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 text-on-surface-variant" aria-label="Chưa có dữ liệu kỳ so sánh">—</p>;
  const amount = value - previous;
  if (amount === 0) return <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 tabular-nums text-change-flat" aria-label="Không thay đổi so với kỳ trước">–</p>;
  const up = amount > 0;
  const label = `${up ? "Tăng" : "Giảm"} ${integer(Math.abs(amount))}${unit ? ` ${unit}` : ""} so với kỳ trước`;
  const percent = previous === 0 ? " · kỳ trước: 0" : ` (${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(Math.abs(amount / previous) * 100)}%)`;
  return <p className={cn("finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 tabular-nums", up ? "text-change-up" : "text-change-down")} aria-label={label}>
    {up ? "▲" : "▼"} {integer(Math.abs(amount))}{unit ? ` ${unit}` : ""}{percent}
  </p>;
}
