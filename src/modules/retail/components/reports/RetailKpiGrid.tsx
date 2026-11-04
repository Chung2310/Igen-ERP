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
const KPI_TONES = ["blue", "cyan", "purple", "green", "orange", "rose"] as const;

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
          className={cn("retail-stat-card min-w-0 overflow-hidden rounded-md p-3", `retail-stat-card--${KPI_TONES[index % KPI_TONES.length]}`)}
        >
          {/* Row 1: Icon + Value on same row */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15">
                <Icon aria-hidden="true" className="size-4 text-white" />
              </div>
              {typeof amount === "number" ? <AdaptiveMoney value={amount} /> : <p className="min-w-0 text-base font-semibold text-white [overflow-wrap:anywhere] sm:text-lg" title={value}>
                {value}
              </p>}
            </div>
          </div>

          {/* Row 2: Metric label & Sublabel */}
          <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px]">
            <p className="truncate font-medium text-white" title={label}>
              {label}
            </p>
            {isPrimary && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-medium text-white"><Sparkles className="size-2.5" />Chủ đạo</span>}
            {!isPrimary && (
              <span className="max-w-[100px] shrink-0 truncate text-[10px] font-medium text-white/90" title={sublabel}>
                {sublabel}
              </span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
