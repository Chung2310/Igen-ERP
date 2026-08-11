import type { LucideIcon } from "lucide-react";
import { Banknote, CircleDollarSign, HandCoins, PackageCheck, ReceiptText, RotateCcw, Scale, ShoppingBag, TrendingUp } from "lucide-react";
import type { RetailReport } from "../../types";

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
  icon: LucideIcon;
  tone: string;
};

export default function RetailKpiGrid({ report }: RetailKpiGridProps) {
  const { summary } = report;
  const kpis: Kpi[] = [
    { label: "Doanh thu thuần", value: moneyFormatter.format(summary.netSales), icon: TrendingUp, tone: "bg-cyan-50 text-cyan-700" },
    { label: "Số đơn", value: numberFormatter.format(summary.orderCount), icon: ShoppingBag, tone: "bg-blue-50 text-blue-700" },
    { label: "Giá trị đơn trung bình", value: moneyFormatter.format(summary.averageOrderValue), icon: ReceiptText, tone: "bg-violet-50 text-violet-700" },
    { label: "Đã thu", value: moneyFormatter.format(summary.collectedAmount), icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Còn phải thu", value: moneyFormatter.format(summary.dueAmount), icon: HandCoins, tone: "bg-amber-50 text-amber-700" },
    { label: "Hoàn tiền", value: moneyFormatter.format(summary.refunds), icon: RotateCcw, tone: "bg-rose-50 text-rose-700" },
  ];

  if (typeof summary.totalCost === "number") {
    kpis.push({ label: "Giá vốn", value: moneyFormatter.format(summary.totalCost), icon: PackageCheck, tone: "bg-slate-100 text-slate-700" });
  }
  if (typeof summary.grossProfit === "number") {
    kpis.push({ label: "Lợi nhuận gộp", value: moneyFormatter.format(summary.grossProfit), icon: Banknote, tone: "bg-teal-50 text-teal-700" });
  }
  if (typeof summary.grossMarginPercent === "number") {
    kpis.push({ label: "Tỷ suất lợi nhuận", value: `${percentFormatter.format(summary.grossMarginPercent)}%`, icon: Scale, tone: "bg-indigo-50 text-indigo-700" });
  }

  return (
    <section aria-label="Chỉ số tổng quan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map(({ label, value, icon: Icon, tone }) => (
        <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 break-words text-xl font-bold text-slate-900">{value}</p>
        </article>
      ))}
    </section>
  );
}
