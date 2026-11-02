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

type RetailKpiGridProps = { report: RetailReport };

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

type Kpi = {
  label: string;
  value: string;
  amount?: number;
  sublabel: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
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
      iconBg: "bg-cyan-500/10 text-cyan-700",
      iconColor: "text-cyan-600",
      isPrimary: true,
    },
    {
      label: "Số đơn",
      value: numberFormatter.format(summary.orderCount),
      sublabel: "Đơn hoàn tất",
      icon: ShoppingBag,
      iconBg: "bg-blue-500/10 text-blue-700",
      iconColor: "text-blue-600",
    },
    {
      label: "Giá trị đơn trung bình",
      value: moneyFormatter.format(summary.averageOrderValue),
      amount: summary.averageOrderValue,
      sublabel: "AOV / đơn",
      icon: ReceiptText,
      iconBg: "bg-violet-500/10 text-violet-700",
      iconColor: "text-violet-600",
    },
    {
      label: "Đã thu",
      value: moneyFormatter.format(summary.collectedAmount),
      amount: summary.collectedAmount,
      sublabel: "Dòng tiền thực thu",
      icon: CircleDollarSign,
      iconBg: "bg-emerald-500/10 text-emerald-700",
      iconColor: "text-emerald-600",
    },
    {
      label: "Còn phải thu",
      value: moneyFormatter.format(summary.dueAmount),
      amount: summary.dueAmount,
      sublabel: "Công nợ khách",
      icon: HandCoins,
      iconBg: "bg-amber-500/10 text-amber-700",
      iconColor: "text-amber-600",
    },
    {
      label: "Hoàn tiền",
      value: moneyFormatter.format(summary.refunds),
      amount: summary.refunds,
      sublabel: "Trả hàng & đổi trả",
      icon: RotateCcw,
      iconBg: "bg-rose-500/10 text-rose-700",
      iconColor: "text-rose-600",
    },
  ];

  if (typeof summary.totalCost === "number") {
    kpis.push({
      label: "Giá vốn",
      value: moneyFormatter.format(summary.totalCost),
      amount: summary.totalCost,
      sublabel: "Chi phí hàng bán",
      icon: PackageCheck,
      iconBg: "bg-slate-500/10 text-slate-700",
      iconColor: "text-slate-600",
    });
  }
  if (typeof summary.grossProfit === "number") {
    kpis.push({
      label: "Lợi nhuận gộp",
      value: moneyFormatter.format(summary.grossProfit),
      amount: summary.grossProfit,
      sublabel: "Doanh thu - Giá vốn",
      icon: Banknote,
      iconBg: "bg-teal-500/10 text-teal-700",
      iconColor: "text-teal-600",
    });
  }
  if (typeof summary.grossMarginPercent === "number") {
    kpis.push({
      label: "Tỷ suất lợi nhuận",
      value: `${percentFormatter.format(summary.grossMarginPercent)}%`,
      sublabel: "Biên lợi nhuận",
      icon: Scale,
      iconBg: "bg-indigo-500/10 text-indigo-700",
      iconColor: "text-indigo-600",
    });
  }

  return (
    <section aria-label="Chỉ số tổng quan" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map(({ label, value, amount, sublabel, icon: Icon, iconBg, iconColor, isPrimary }) => (
        <article
          key={label}
          className={`relative min-w-0 overflow-hidden rounded-xl border p-2.5 sm:p-3 transition-all duration-150 shadow-2xs hover:shadow-xs ${
            isPrimary
              ? "border-cyan-300 bg-gradient-to-br from-cyan-50/70 via-white to-sky-50/40"
              : "border-slate-200/80 bg-white hover:border-slate-300"
          }`}
        >
          {isPrimary && (
            <div className="absolute -right-2 -top-2 h-12 w-12 rounded-full bg-cyan-400/15 blur-md pointer-events-none" />
          )}
          {/* Row 1: Icon + Value on same row */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
                <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
              {typeof amount === "number" ? <AdaptiveMoney value={amount} /> : <p className="min-w-0 text-base sm:text-lg font-bold text-slate-900 tracking-tight [overflow-wrap:anywhere]" title={value}>
                {value}
              </p>}
            </div>
          </div>

          {/* Row 2: Metric label & Sublabel */}
          <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px]">
            <p className="font-semibold uppercase tracking-wider text-slate-500 truncate" title={label}>
              {label}
            </p>
            {isPrimary && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-100/80 px-1.5 py-0.5 text-[9px] font-bold text-cyan-800"><Sparkles className="h-2.5 w-2.5" />Chủ đạo</span>}
            {!isPrimary && (
              <span className="shrink-0 text-[10px] font-medium text-slate-400 truncate max-w-[100px]" title={sublabel}>
                {sublabel}
              </span>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
