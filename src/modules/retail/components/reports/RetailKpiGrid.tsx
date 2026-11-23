import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CircleDollarSign,
  HandCoins,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Scale,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { RetailReport } from "../../types";
import AdaptiveMoney from "./AdaptiveMoney";
import { cn } from "../../../student-management/lib/utils";

type RetailKpiGridProps = { report: RetailReport };

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const KPI_TONES = ["blue", "cyan", "purple", "green", "orange", "rose", "blue", "green", "purple"] as const;

type Kpi = {
  label: string;
  value: string;
  amount?: number;
  sublabel: string;
  icon: LucideIcon;
  isPrimary?: boolean;
};

export default function RetailKpiGrid({ report }: RetailKpiGridProps) {
  const { summary } = report;
  const kpis: Kpi[] = [
    {
      label: "Doanh thu thuần",
      value: moneyFormatter.format(summary.netSales),
      amount: summary.netSales,
      sublabel: "Đã trừ hoàn trả",
      icon: TrendingUp,
      isPrimary: true,
    },
    {
      label: "Số đơn",
      value: numberFormatter.format(summary.orderCount),
      sublabel: "Đơn hoàn tất",
      icon: ShoppingBag,
    },
    {
      label: "Giá trị đơn trung bình",
      value: moneyFormatter.format(summary.averageOrderValue),
      amount: summary.averageOrderValue,
      sublabel: "AOV / đơn",
      icon: ReceiptText,
    },
    {
      label: "Đã thu",
      value: moneyFormatter.format(summary.collectedAmount),
      amount: summary.collectedAmount,
      sublabel: "Dòng tiền thực thu",
      icon: CircleDollarSign,
    },
    {
      label: "Còn phải thu",
      value: moneyFormatter.format(summary.dueAmount),
      amount: summary.dueAmount,
      sublabel: "Công nợ khách",
      icon: HandCoins,
    },
    {
      label: "Hoàn tiền",
      value: moneyFormatter.format(summary.refunds),
      amount: summary.refunds,
      sublabel: "Trả hàng & đổi trả",
      icon: RotateCcw,
    },
  ];

  if (typeof summary.totalCost === "number") {
    kpis.push({
      label: "Giá vốn",
      value: moneyFormatter.format(summary.totalCost),
      amount: summary.totalCost,
      sublabel: "Chi phí hàng bán",
      icon: PackageCheck,
    });
  }
  if (typeof summary.grossProfit === "number") {
    kpis.push({
      label: "Lợi nhuận gộp",
      value: moneyFormatter.format(summary.grossProfit),
      amount: summary.grossProfit,
      sublabel: "Doanh thu - Giá vốn",
      icon: Banknote,
    });
  }
  if (typeof summary.grossMarginPercent === "number") {
    kpis.push({
      label: "Tỷ suất lợi nhuận",
      value: `${percentFormatter.format(summary.grossMarginPercent)}%`,
      sublabel: "Biên lợi nhuận",
      icon: Scale,
    });
  }

  return (
    <section aria-label="Chỉ số tổng quan" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map(({ label, value, amount, sublabel, icon: Icon, isPrimary }, index) => (
        <article
          key={label}
          className={cn(
            "retail-report-kpi-card min-w-0 overflow-hidden rounded-[4px] border border-outline-variant bg-surface-container-lowest p-3.5 shadow-2xs",
            `retail-report-kpi-card--${KPI_TONES[index % KPI_TONES.length]}`,
          )}
        >
          {/* Row 1: Icon + Colored Value */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="retail-report-kpi-card__icon flex size-8 shrink-0 items-center justify-center rounded-[4px]">
                <Icon aria-hidden="true" className="size-4" />
              </div>
              <div className="retail-report-kpi-card__value min-w-0 flex-1 tabular-nums">
                {typeof amount === "number" ? (
                  <AdaptiveMoney value={amount} />
                ) : (
                  <p className="min-w-0 text-base font-semibold [overflow-wrap:anywhere] sm:text-lg" title={value}>
                    {value}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Metric label & Sublabel */}
          <div className="mt-2 flex items-center justify-between gap-1.5 border-t border-outline-variant/60 pt-2 text-xs">
            <p className="truncate font-medium text-on-surface" title={label}>
              {label}
            </p>
            {isPrimary ? (
              <span className="retail-report-kpi-card__badge inline-flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium">
                <Sparkles className="size-2.5" aria-hidden="true" />
                Chủ đạo
              </span>
            ) : (
              <span className="max-w-[110px] shrink-0 truncate text-[11px] text-on-surface-variant" title={sublabel}>
                {sublabel}
              </span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
