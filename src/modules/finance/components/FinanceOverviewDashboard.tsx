import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  LabelList,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeftRight, ArrowRight, CalendarClock, ChartNoAxesCombined, CircleDollarSign, Clock3, Package, ShoppingBag } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "../../student-management/lib/utils";
import { OverviewChartSummary } from "../../../components/dashboard/OverviewChartSummary";
import { OverviewKpiDelta } from "../../../components/dashboard/OverviewKpiDelta";
import { displayComparisonDate, previousComparisonRange } from "../../../components/dashboard/overviewComparison";
import { AnimatedOverviewValue } from "../../../components/dashboard/AnimatedOverviewValue";
import { OverviewChartViewport } from "../../../components/dashboard/OverviewChartViewport";
import { financeManagement } from "../api/financeManagement.api";
import { useBranchOptional } from "../../../context/BranchContext";
import { money } from "./ManagementUI";
import { FinanceEmptyState } from "./FinanceEmptyState";
import { aggregateRevenueTrends, type DailyFinanceTrend, type OverviewPeriod } from "./financeOverviewPeriods";
import "../finance-overview.css";

type Cash = { date: string; kind: string; amount: number; method?: string; category?: string };
type Expense = { category?: string; expenseClass?: string; amount: number };
type Debt = { customerName?: string; supplierName?: string; balance: number; daysUntil: number; dueDate: string };
type LineItem = { category?: string; brand?: string; productName?: string; revenue: number; cost: number | null; quantity: number };
type Stock = { band: string; cost: number | null; risk: number | null };
type Report = {
  summary: Record<string, number | null>;
  trends?: DailyFinanceTrend[];
  cash?: Cash[];
  expenses?: Expense[];
  debts?: { receivables?: Debt[]; payables?: Debt[] };
  lines?: LineItem[];
  inventory?: Stock[];
  vat?: { input: number; output: number; payable: number; nextCarryforward: number };
  breakeven?: { progress: number | null; fixedCosts: number; variableCosts: number; dailyNeeded: number | null };
};

const colors = ["var(--finance-chart-blue)", "var(--finance-chart-teal)", "var(--finance-chart-orange)", "var(--finance-chart-violet)", "var(--finance-chart-red)"];
const shortMoney = (value: number) => {
  const absolute = Math.abs(value);
  const unit = absolute >= 1e9 ? [1e9, " tỷ"] : absolute >= 1e6 ? [1e6, " tr"] : absolute >= 1e3 ? [1e3, " nghìn"] : [1, ""];
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: unit[0] === 1 ? 0 : 1 }).format(value / Number(unit[0]))}${unit[1]}`;
};
const chartTooltip = (value: number | string | undefined) => typeof value === "number" ? money(value) : value ?? "—";
type ChartMetric = { value: number | null | undefined; previous?: number | null; href: string; count?: boolean };
const ChartMetrics = createContext<Record<string, ChartMetric>>({});

function ChartCard({ title, hasData, children, className = "" }: { title: string; hasData: boolean; children: React.ReactNode; className?: string }) {
  const metric = useContext(ChartMetrics)[title];
  return <section className={cn("finance-chart-card", className)}>
    <h3 className="mb-2 text-balance text-sm font-semibold text-on-surface">{title}</h3>
    <OverviewChartSummary value={metric?.value} previous={metric?.previous} metricLabel={title} format={metric?.count ? undefined : value => shortMoney(value)} detailsHref={metric?.href || "/tai-chinh?sub=thu-chi"} />
    {hasData ? <div role="img" aria-label={title} className="h-52 min-w-0 sm:h-56">{children}</div> : <FinanceEmptyState kind="payroll">Chưa có dữ liệu trong phạm vi đã chọn.</FinanceEmptyState>}
  </section>;
}

function RingCard({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  const reduceMotion = useReducedMotion();
  const items = rows.filter(row => row.value > 0);
  return <ChartCard title={title} hasData={items.length > 0}>
    <div className="grid h-full grid-cols-1 items-center gap-2 sm:grid-cols-[52%_1fr]">
      <OverviewChartViewport><ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="58%" outerRadius="80%" stroke="none" paddingAngle={2} isAnimationActive={!reduceMotion} animationDuration={700}>
          {items.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
        </Pie><Tooltip formatter={chartTooltip} /></PieChart>
      </ResponsiveContainer></OverviewChartViewport>
      <ul className="space-y-1.5 text-xs">
        {items.slice(0, 5).map((item, index) => <li key={item.name} className="flex min-w-0 items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-on-surface-variant"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="truncate" title={item.name}>{item.name}</span></span>
          <strong className="shrink-0 font-medium tabular-nums text-on-surface">{shortMoney(item.value)}</strong>
        </li>)}
      </ul>
    </div>
  </ChartCard>;
}

function groupSum<T>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => number) {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    grouped.set(key, (grouped.get(key) || 0) + valueOf(row));
  }
  return [...grouped].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function agingRows(rows: Debt[]) {
  const bands = [
    { name: "Quá hạn", value: 0 },
    { name: "Trong 7 ngày", value: 0 },
    { name: "8–30 ngày", value: 0 },
    { name: "Trên 30 ngày", value: 0 },
  ];
  for (const row of rows) {
    if (row.balance <= 0) continue;
    const index = row.daysUntil < 0 ? 0 : row.daysUntil <= 7 ? 1 : row.daysUntil <= 30 ? 2 : 3;
    bands[index].value += row.balance;
  }
  return bands;
}

export default function FinanceOverviewDashboard({ report, period, from, to, comparisonShownInToolbar = false }: { report: Report; period: OverviewPeriod; from: string; to: string; comparisonShownInToolbar?: boolean }) {
  const reduceMotion = useReducedMotion();
  const branch = useBranchOptional();
  const [previousResult, setPreviousResult] = useState<{ key: string; report: Report } | null>(null);
  const comparisonRange = previousComparisonRange(from, to, period);
  const comparisonKey = `${branch?.activeBranchId || "all"}:${from}:${to}:${period}`;
  useEffect(() => {
    const controller = new AbortController();
    const previous = previousComparisonRange(from, to, period);
    void financeManagement<Report>(`/report?${new URLSearchParams(previous)}`, undefined, undefined, controller.signal).then(report => setPreviousResult({ key: comparisonKey, report })).catch(() => { if (!controller.signal.aborted) setPreviousResult(null); });
    return () => controller.abort();
  }, [branch?.activeBranchId, from, to, period, comparisonKey]);
  const previousReport = previousResult?.key === comparisonKey ? previousResult.report : null;
  const s = report.summary;
  const trends = report.trends || [];
  const cash = report.cash || [];
  const expenses = report.expenses || [];
  const lines = report.lines || [];
  const inventory = report.inventory || [];
  const receivables = report.debts?.receivables || [];
  const payables = report.debts?.payables || [];
  const trendRows = trends.map(row => ({ ...row, label: row.date.slice(8, 10) + "/" + row.date.slice(5, 7), gross: row.cost == null ? null : row.revenue - row.cost, net: row.cost == null ? null : row.revenue - row.cost - row.expense }));
  const revenueRows = aggregateRevenueTrends(trends, period, from, to);
  const cashByDate = new Map<string, { name: string; thu: number; chi: number }>();
  for (const row of cash) {
    const current = cashByDate.get(row.date) || { name: row.date, thu: 0, chi: 0 };
    if (row.kind === "receipt") current.thu += row.amount;
    if (row.kind === "payment") current.chi += row.amount;
    cashByDate.set(row.date, current);
  }
  const cashRows = [...cashByDate.values()].sort((a, b) => a.name.localeCompare(b.name)).map(row => ({ ...row, name: row.name.slice(8, 10) + "/" + row.name.slice(5, 7), net: row.thu - row.chi }));
  const expenseGroups = groupSum(expenses, row => ({ rent: "Mặt bằng", salary: "Lương", marketing: "Marketing", utilities: "Điện nước", repair: "Sửa chữa", depreciation: "Khấu hao", other_expense: "Chi khác" } as Record<string, string>)[row.category || ""] || row.category || "Khác", row => row.amount);
  const expenseClasses = groupSum(expenses, row => row.expenseClass === "fixed" ? "Cố định" : row.expenseClass === "variable" ? "Biến đổi" : "Khác", row => row.amount);
  const methodGroups = groupSum(cash, row => ({ cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ", other: "Khác" } as Record<string, string>)[row.method || ""] || "Chưa phân loại", row => row.amount);
  const receivableAging = agingRows(receivables);
  const payableAging = agingRows(payables);
  const debtParties = groupSum([...receivables.map(row => ({ ...row, name: row.customerName || "Khách hàng" })), ...payables.map(row => ({ ...row, name: row.supplierName || "Nhà cung cấp" }))].filter(row => row.balance > 0), row => row.name, row => row.balance).slice(0, 6);
  const revenueCategories = groupSum(lines, row => row.category || "Chưa phân loại", row => row.revenue).slice(0, 7);
  const revenueBrands = groupSum(lines, row => row.brand || "Chưa có thương hiệu", row => row.revenue).slice(0, 7);
  const stockBands = ["0-30", "31-60", "61-90", "over90"].map((band, index) => ({ name: ["0–30 ngày", "31–60 ngày", "61–90 ngày", "Trên 90 ngày"][index], value: inventory.filter(row => row.band === band).length }));
  const vatRows = [{ name: "VAT đầu ra", value: report.vat?.output || 0 }, { name: "VAT đầu vào", value: report.vat?.input || 0 }];
  const urgent = [...receivables.map(row => ({ ...row, party: row.customerName || "Khách hàng", type: "Phải thu" })), ...payables.map(row => ({ ...row, party: row.supplierName || "Nhà cung cấp", type: "Phải trả" }))].filter(row => row.balance > 0 && row.daysUntil <= 7).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5);
  const prior = previousReport?.summary;
  const kpis = [
    ["Doanh thu hàng hóa", s.revenue, prior?.revenue], ["Giá vốn", s.cost, prior?.cost], ["Lãi gộp", s.grossProfit, prior?.grossProfit],
    ["Lãi ròng quản trị", s.netProfit, prior?.netProfit], ["Dòng tiền ròng", s.cashIn != null && s.cashOut != null ? s.cashIn - s.cashOut : null, prior?.cashIn != null && prior.cashOut != null ? prior.cashIn - prior.cashOut : null], ["Phải thu quá hạn", s.overdue, null],
  ] as const;
  const kpiIcons = [ShoppingBag, Package, ChartNoAxesCombined, CircleDollarSign, ArrowLeftRight, Clock3] as const;
  const previousExpenses = previousReport?.expenses || [];
  const previousCash = previousReport?.cash || [];
  const metrics: Record<string, ChartMetric> = {
    "Doanh thu theo kỳ": { value: s.revenue, previous: previousReport?.summary.revenue, href: "/tai-chinh?sub=lai-lo" },
    "Biên lãi theo ngày": { value: s.grossProfit, previous: previousReport?.summary.grossProfit, href: "/tai-chinh?sub=lai-lo" },
    "Thu, chi và dòng tiền ròng": { value: s.cashIn, previous: previousReport?.summary.cashIn, href: "/tai-chinh?sub=thu-chi" },
    "Cơ cấu chi phí": { value: expenses.reduce((sum, row) => sum + row.amount, 0), previous: previousReport ? previousExpenses.reduce((sum, row) => sum + row.amount, 0) : null, href: "/tai-chinh?sub=lai-lo" },
    "Cơ cấu phương thức thanh toán": { value: cash.reduce((sum, row) => sum + row.amount, 0), previous: previousReport ? previousCash.reduce((sum, row) => sum + row.amount, 0) : null, href: "/tai-chinh?sub=thu-chi" },
    "Chi phí cố định và biến đổi": { value: expenses.reduce((sum, row) => sum + row.amount, 0), previous: previousReport ? previousExpenses.reduce((sum, row) => sum + row.amount, 0) : null, href: "/tai-chinh?sub=lai-lo" },
    "Tuổi nợ phải thu": { value: receivableAging.reduce((sum, row) => sum + row.value, 0), href: "/tai-chinh?sub=tuoi-no" },
    "Tuổi nợ phải trả": { value: payableAging.reduce((sum, row) => sum + row.value, 0), href: "/tai-chinh?sub=tuoi-no" },
    "Đối tượng có dư nợ lớn": { value: debtParties.reduce((sum, row) => sum + row.value, 0), href: "/tai-chinh?sub=cong-no" },
    "Doanh thu theo nhóm hàng": { value: s.revenue, previous: previousReport?.summary.revenue, href: "/tai-chinh?sub=lai-lo" },
    "Doanh thu theo thương hiệu": { value: s.revenue, previous: previousReport?.summary.revenue, href: "/tai-chinh?sub=lai-lo" },
    "Tuổi hàng tồn theo IMEI": { value: inventory.length, href: "/tai-chinh?sub=lai-lo", count: true },
    "VAT đầu vào và đầu ra": { value: report.vat?.output, previous: previousReport?.vat?.output, href: "/tai-chinh?sub=vat" },
  };

  return <ChartMetrics.Provider value={metrics}><div className="finance-overview space-y-3">
    {!trends.length && !cash.length && !expenses.length && !lines.length && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-xs text-on-surface-variant"><p className="text-pretty">Chưa có giao dịch trong kỳ đã chọn. Số dư công nợ và tồn kho vẫn hiển thị theo hiện tại.</p><a href="/tai-chinh?sub=thu-chi" className="font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở Thu - Chi</a></div>}
    <section className="finance-chart-card !p-3 sm:!p-4" aria-label="Chỉ số tài chính">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-balance text-lg font-semibold text-on-surface">Tình hình tài chính</h2>
        <span className="text-xs text-on-surface-variant">Đơn vị: VND</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value, previous], index) => {
          const Icon = kpiIcons[index];
          return <div key={label} className={`finance-kpi finance-kpi-${index} flex min-h-28 flex-col`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-pretty text-xs font-medium text-white">{label}</p>
              <Icon className="size-4 shrink-0 text-on-primary opacity-70" aria-hidden="true" />
            </div>
            <p className="mt-1 break-words text-lg font-semibold tabular-nums text-white sm:text-xl"><AnimatedOverviewValue value={value} format={money} /></p>
            {label === "Phải thu quá hạn" ? <p className="mt-auto text-xs text-white">Số dư hiện tại</p> : <OverviewKpiDelta value={value} previous={previous} />}
          </div>;
        })}
      </div>
      <p className="mt-3 text-pretty text-xs text-on-surface-variant">{!comparisonShownInToolbar && <>So sánh: {displayComparisonDate(comparisonRange.from)} – {displayComparisonDate(comparisonRange.to)}. </>}Công nợ và tồn kho là số dư hiện tại.</p>
    </section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <section className="finance-chart-card">
        <h3 className="mb-3 text-balance text-sm font-semibold text-on-surface">Số liệu tài chính chi tiết</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ["Tiền đã thu", s.cashIn, "blue"], ["Tiền đã chi", s.cashOut, "orange"], ["Chi phí ghi nhận", s.expense, "red"],
            ["Phải thu hiện tại", s.receivable, "teal"], ["Phải trả hiện tại", s.payable, "violet"], ["NCC đến hạn 5 ngày", s.payableSoon, "orange"],
            ["Giá trị tồn kho", s.inventoryValue, "blue"], ["VAT dự kiến phải nộp", report.vat?.payable ?? null, "violet"],
          ] as const).map(([label, value, tone]) => <div key={label} className="min-w-0"><dt className="text-pretty text-xs text-on-surface-variant">{label}</dt><dd className={`mt-0.5 break-words text-xl font-bold tabular-nums ${value == null ? "text-on-surface-variant" : `finance-detail-value finance-detail-value--${tone}`}`}>{money(value)}</dd></div>)}
        </dl>
      </section>
      <ChartCard title="Doanh thu theo kỳ" hasData={trends.length > 0 && revenueRows.length > 0} className="xl:col-span-2">
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={revenueRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="label" tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={58} /><Tooltip formatter={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="Doanh thu" fill={colors[0]} maxBarSize={38} isAnimationActive={!reduceMotion} animationDuration={700} /><Line type="monotone" dataKey="expense" name="Chi phí" stroke={colors[2]} strokeWidth={2} dot={false} isAnimationActive={!reduceMotion} animationDuration={700} /><Line type="monotone" dataKey="net" name="Lãi ròng" stroke={colors[1]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={!reduceMotion} animationDuration={700} />
        </ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Biên lãi theo ngày" hasData={trendRows.some(row => row.gross != null)}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="label" tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={58} /><Tooltip formatter={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="gross" name="Lãi gộp" stroke={colors[1]} fill="var(--finance-chart-teal-soft)" strokeWidth={2} connectNulls={false} isAnimationActive={!reduceMotion} animationDuration={700} /><Line type="monotone" dataKey="net" name="Lãi ròng" stroke={colors[3]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={!reduceMotion} animationDuration={700} />
        </ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Thu, chi và dòng tiền ròng" hasData={cashRows.length > 0} className="xl:col-span-2">
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={cashRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="name" tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={58} /><Tooltip formatter={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="thu" name="Thu" fill={colors[1]} maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700} /><Bar dataKey="chi" name="Chi" fill={colors[2]} maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700} /><Line type="monotone" dataKey="net" name="Ròng" stroke={colors[0]} strokeWidth={2} dot={false} isAnimationActive={!reduceMotion} animationDuration={700} />
        </ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <RingCard title="Cơ cấu chi phí" rows={expenseGroups} />
      <RingCard title="Cơ cấu phương thức thanh toán" rows={methodGroups} />
      <RingCard title="Chi phí cố định và biến đổi" rows={expenseClasses} />
      <ChartCard title="Tuổi nợ phải thu" hasData={receivableAging.some(row => row.value > 0)}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={receivableAging} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis axisLine={false} tickLine={false} type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Phải thu" fill={colors[0]} maxBarSize={24} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Tuổi nợ phải trả" hasData={payableAging.some(row => row.value > 0)}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={payableAging} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis axisLine={false} tickLine={false} type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Phải trả" fill={colors[2]} maxBarSize={24} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Đối tượng có dư nợ lớn" hasData={debtParties.length > 0}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={debtParties} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis axisLine={false} tickLine={false} type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Dư nợ" fill={colors[3]} maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Doanh thu theo nhóm hàng" hasData={revenueCategories.some(row => row.value !== 0)}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={revenueCategories} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis axisLine={false} tickLine={false} type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Doanh thu" fill={colors[1]} maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Doanh thu theo thương hiệu" hasData={revenueBrands.some(row => row.value !== 0)}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={revenueBrands} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis axisLine={false} tickLine={false} type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Doanh thu" fill={colors[0]} maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="Tuổi hàng tồn theo IMEI" hasData={inventory.length > 0}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={stockBands} margin={{ top: 20, right: 4, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="name" tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} width={25} /><Tooltip formatter={(value) => `${value} hàng`} /><Bar dataKey="value" name="Số lượng" fill={colors[2]} maxBarSize={40} isAnimationActive={!reduceMotion} animationDuration={700}><LabelList dataKey="value" position="top" fill="var(--color-on-surface-variant)" fontSize={11} formatter={(value: unknown) => typeof value === "number" && value > 0 ? new Intl.NumberFormat("vi-VN").format(value) : ""} /></Bar></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <ChartCard title="VAT đầu vào và đầu ra" hasData={vatRows.some(row => row.value > 0)}>
        <OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><ComposedChart data={vatRows} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis axisLine={false} tickLine={false} type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={82} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="VAT" maxBarSize={38} isAnimationActive={!reduceMotion} animationDuration={700}>{vatRows.map((row, index) => <Cell key={row.name} fill={colors[index === 0 ? 2 : 1]} />)}</Bar></ComposedChart></ResponsiveContainer></OverviewChartViewport>
      </ChartCard>
      <section className="finance-chart-card">
        <h3 className="mb-3 text-balance text-sm font-semibold text-on-surface">Tiến độ hòa vốn</h3>
        <OverviewChartSummary value={report.breakeven?.progress} previous={previousReport?.breakeven?.progress} metricLabel="Tiến độ hòa vốn" format={value => `${Math.round(value)}%`} detailsHref="/tai-chinh?sub=hoa-von" />
        {report.breakeven?.progress == null ? <FinanceEmptyState kind="payroll">Chưa đủ dữ liệu để tính điểm hòa vốn.</FinanceEmptyState> : <div className="flex min-h-52 flex-col justify-center gap-3">
          <div className="h-3 overflow-hidden rounded-full bg-surface-container-low"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, report.breakeven.progress))}%` }} /></div>
          <div className="grid grid-cols-2 gap-3 text-xs"><p className="text-on-surface-variant">Chi phí cố định<strong className="mt-1 block font-semibold tabular-nums text-on-primary-container">{money(report.breakeven.fixedCosts)}</strong></p><p className="text-on-surface-variant">Cần thêm mỗi ngày<strong className="mt-1 block font-semibold tabular-nums text-on-primary-container">{money(report.breakeven.dailyNeeded)}</strong></p></div>
        </div>}
      </section>
      <section className="finance-chart-card">
        <div className="mb-3 flex items-start justify-between gap-2"><h3 className="text-balance text-sm font-semibold text-on-surface">Khoản nợ cần xử lý</h3><CalendarClock className="size-4 shrink-0 text-tertiary" aria-hidden="true" /></div>
        {urgent.length ? <ul className="divide-y divide-outline-variant">{urgent.map((row, index) => <li key={`${row.party}-${row.dueDate}-${index}`} className="flex items-center justify-between gap-2 py-2 text-xs"><div className="min-w-0"><p className="truncate font-medium text-on-surface">{row.party}</p><p className="text-on-surface-variant">{row.type} · {row.dueDate}</p></div><strong className={cn("finance-detail-value shrink-0 text-xl font-bold tabular-nums", row.type === "Phải thu" ? "finance-detail-value--teal" : "finance-detail-value--orange")}>{shortMoney(row.balance)}</strong></li>)}</ul> : <FinanceEmptyState kind="notification">Không có khoản nợ cần xử lý.</FinanceEmptyState>}
        <a href="/tai-chinh?sub=cong-no" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở công nợ <ArrowRight className="size-3" aria-hidden="true" /></a>
      </section>
    </div>
  </div></ChartMetrics.Provider>;
}
