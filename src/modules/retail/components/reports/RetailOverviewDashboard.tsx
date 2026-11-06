import React from "react";
import { useReducedMotion } from "motion/react";
import { OverviewChartSummary, previousCalendarMonth, yesterday } from "../../../../components/dashboard/OverviewChartSummary";
import { useOverviewPeriod } from "../../../../components/dashboard/OverviewPeriodContext";
import { AnimatedOverviewValue } from "../../../../components/dashboard/AnimatedOverviewValue";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { retailReportsApi } from "../../api/retailReports.api";
import type { RetailReport, RetailReportFilters, RetailScope } from "../../types";
import { cn } from "../../../student-management/lib/utils";
import { aggregateSales, comparison, groupProducts, previousRangeFilters, type RetailPeriod } from "./retailOverviewAnalytics";
import "../../../finance/finance-overview.css";
import "./retail-overview.css";

const colors = ["var(--finance-chart-blue)", "var(--finance-chart-teal)", "var(--finance-chart-orange)", "var(--finance-chart-violet)", "var(--finance-chart-red)"];
const integer = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `${integer(value)} đ`;
const displayDate = (value: string) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3-$2-$1");
const shortMoney = (value: number) => {
  const absolute = Math.abs(value);
  const scale = absolute >= 1e9 ? [1e9, " tỷ"] : absolute >= 1e6 ? [1e6, " tr"] : absolute >= 1e3 ? [1e3, " nghìn"] : [1, ""];
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: scale[0] === 1 ? 0 : 1 }).format(value / Number(scale[0]))}${scale[1]}`;
};
const paymentLabels: Record<string, string> = { cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ", ewallet: "Ví điện tử" };
const tooltipMoney = (value: number | string | undefined) => typeof value === "number" ? money(value) : value ?? "—";
const tooltipCount = (value: number | string | undefined) => typeof value === "number" ? `${integer(value)} đơn` : value ?? "—";
type ChartMetric = { value: number | null | undefined; previous?: number | null; count?: boolean };
const ChartMetrics = React.createContext<Record<string, ChartMetric>>({});

function ChartCard({ title, hasData, children, className = "", action }: { title: string; hasData: boolean; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const metric = React.useContext(ChartMetrics)[title];
  return <section className={cn("finance-chart-card", className)}>
    <h3 className="mb-2 text-balance text-sm font-semibold text-on-surface">{title}</h3>
    <OverviewChartSummary value={metric?.value} previous={metric?.previous} metricLabel={title} format={metric?.count ? integer : shortMoney} detailsHref="/erp?sub=bao-cao" action={action} />
    {hasData ? <div role="img" aria-label={title} className="h-56 min-w-0 sm:h-64">{children}</div> : <div className="flex min-h-36 items-center justify-center rounded-lg bg-surface-container-low px-4 text-center text-xs text-on-surface-variant">Chưa có dữ liệu trong phạm vi đã chọn.</div>}
  </section>;
}

function Delta({ value, previous, unit = "money" }: { value: number; previous?: number; unit?: "money" | "count" }) {
  const change = comparison(value, previous);
  if (!change) return null;
  if (change.amount === 0) return <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 tabular-nums text-change-flat" aria-label="Không thay đổi so với kỳ trước">–</p>;
  const arrow = change.amount > 0 ? "▲" : "▼";
  const display = unit === "count" ? `${integer(Math.abs(change.amount))} đơn` : money(Math.abs(change.amount));
  const tone = change.amount > 0 ? "text-change-up" : "text-change-down";
  return <p className={cn("finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 tabular-nums", tone)} aria-label={`${change.amount > 0 ? "Tăng" : "Giảm"} ${display} so với kỳ trước`}>
    {arrow} {display}{change.percent == null ? " · kỳ trước: 0" : ` (${Math.abs(change.percent).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%)`}
  </p>;
}

function DonutCard({ title, rows, unit = "money" }: { title: string; rows: { name: string; value: number }[]; unit?: "money" | "count" }) {
  const reduceMotion = useReducedMotion();
  const items = rows.filter(row => row.value > 0).slice(0, 6);
  const total = items.reduce((sum, row) => sum + row.value, 0);
  return <ChartCard title={title} hasData={items.length > 0}>
    <div className="grid h-full min-w-0 grid-cols-1 items-center gap-1 sm:grid-cols-[56%_minmax(0,1fr)]">
      <ResponsiveContainer width="100%" height="100%"><PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="51%" outerRadius="70%" paddingAngle={2} stroke="none" labelLine={{ stroke: "var(--color-on-surface-variant)", strokeWidth: 1 }} label={({ name, percent }) => `${String(name).slice(0, 12)} ${(Number(percent || 0) * 100).toFixed(0)}%`} isAnimationActive={!reduceMotion} animationDuration={700}>
          {items.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
        </Pie><Tooltip formatter={(value) => typeof value === "number" ? unit === "count" ? `${integer(value)} sản phẩm` : money(value) : value ?? "—"} />
      </PieChart></ResponsiveContainer>
      <ul className="space-y-2 text-xs">{items.map((item, index) => <li key={item.name} className="flex min-w-0 items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1.5 text-on-surface-variant"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} /><span className="break-words">{item.name}</span></span>
        <strong className="shrink-0 text-right font-semibold tabular-nums text-on-surface">{unit === "count" ? integer(item.value) : shortMoney(item.value)}<span className="block text-[10px] font-normal text-on-surface-variant">{(item.value / total * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</span></strong>
      </li>)}</ul>
    </div>
  </ChartCard>;
}

function HorizontalCard({ title, rows, valueLabel = "Doanh thu", count = false, countUnit = "đơn" }: { title: string; rows: { name: string; value: number }[]; valueLabel?: string; count?: boolean; countUnit?: string }) {
  const reduceMotion = useReducedMotion();
  const items = rows.filter(row => row.value > 0).slice(0, 7);
  return <ChartCard title={title} hasData={items.length > 0}>
    <ResponsiveContainer width="100%" height="100%"><ComposedChart data={items} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 2 }}>
      <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" horizontal={false} />
      <XAxis type="number" tickFormatter={count ? integer : shortMoney} tick={{ fontSize: 10 }} />
      <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} tickFormatter={(name: string) => name.length > 14 ? `${name.slice(0, 13)}…` : name} />
      <Tooltip formatter={count ? (value) => typeof value === "number" ? `${integer(value)} ${countUnit}` : value ?? "—" : tooltipMoney} /><Bar dataKey="value" name={valueLabel} fill={colors[0]} maxBarSize={22} isAnimationActive={!reduceMotion} animationDuration={700}>
        {items.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
      </Bar>
    </ComposedChart></ResponsiveContainer>
  </ChartCard>;
}

export default function RetailOverviewDashboard({ report, filters, scope }: { report: RetailReport; filters: RetailReportFilters; scope: RetailScope }) {
  const overviewPeriod = useOverviewPeriod();
  const reduceMotion = useReducedMotion();
  const [period, setPeriod] = React.useState<RetailPeriod>("day");
  const [previous, setPrevious] = React.useState<{ key: string; report: RetailReport } | null>(null);
  const [previousErrorKey, setPreviousErrorKey] = React.useState("");
  const currentDay = new Date().toLocaleDateString("en-CA");
  const comparisonRange = report.range.from === currentDay && report.range.to === currentDay
    ? { from: yesterday(), to: yesterday() }
    : report.range.from.slice(0, 7) === currentDay.slice(0, 7) && report.range.from.endsWith("-01") && report.range.to === currentDay
      ? previousCalendarMonth()
      : previousRangeFilters(report.range, filters);
  const previousFilters = { ...previousRangeFilters(report.range, filters), ...comparisonRange, ...(overviewPeriod ? { from: overviewPeriod.previousFrom, to: overviewPeriod.previousTo } : {}) };
  const compareKey = `${scope.companyCode}:${scope.branchId}:${JSON.stringify(previousFilters)}`;
  React.useEffect(() => {
    let active = true;
    void retailReportsApi.summary(scope, previousFilters).then(value => { if (active) { setPrevious({ key: compareKey, report: value }); setPreviousErrorKey(""); } }).catch(() => { if (active) { setPrevious(null); setPreviousErrorKey(compareKey); } });
    return () => { active = false; };
  }, [compareKey, scope.companyCode, scope.branchId]);
  const prior = previous?.key === compareKey ? previous.report : undefined;
  const summary = report.summary;
  const kpis = [
    { title: "Doanh thu thuần", value: summary.netSales, previous: prior?.summary.netSales, unit: "money" as const },
    { title: "Số đơn bán", value: summary.orderCount, previous: prior?.summary.orderCount, unit: "count" as const },
    { title: "Giá trị đơn trung bình", value: summary.averageOrderValue, previous: prior?.summary.averageOrderValue, unit: "money" as const },
    { title: "Tiền đã thu", value: summary.collectedAmount, previous: prior?.summary.collectedAmount, unit: "money" as const },
    { title: "Lợi nhuận gộp", value: summary.grossProfit, previous: prior?.summary.grossProfit, unit: "money" as const },
    { title: "Hoàn tiền", value: summary.refunds, previous: prior?.summary.refunds, unit: "money" as const },
  ];
  const series = aggregateSales(report.timeSeries, period);
  const dayRows = aggregateSales(report.timeSeries, "day");
  const productRows = report.products.filter(row => row.netSales > 0).sort((a, b) => b.netSales - a.netSales);
  const categoryRows = groupProducts(report.products, "category");
  const brandRows = groupProducts(report.products, "brand");
  const cashierRows = report.cashiers.map(row => ({ name: row.cashierName, value: row.netSales })).sort((a, b) => b.value - a.value);
  const cashierOrders = report.cashiers.map(row => ({ name: row.cashierName, value: row.orderCount })).sort((a, b) => b.value - a.value);
  const debtRows = [{ name: "Quá hạn", value: report.debt.overdueDebt }, { name: "Đến hạn hôm nay", value: report.debt.dueTodayDebt }, { name: "Chưa đến hạn", value: report.debt.upcomingDebt }];
  const customerDebt = report.debt.customers.map(row => ({ name: row.customerName, value: row.totalDebt })).sort((a, b) => b.value - a.value);
  const paymentRows = report.paymentMix.map(row => ({ name: paymentLabels[row.method] || row.method, value: row.amount }));
  const shiftRows = report.shifts.filter(row => row.grossSales > 0).map(row => ({ name: row.shiftCode, value: row.grossSales })).sort((a, b) => b.value - a.value);
  const hasSales = series.some(row => row.netSales || row.grossSales || row.refunds);
  const metrics: Record<string, ChartMetric> = {
    "Doanh thu theo kỳ": { value: summary.netSales, previous: prior?.summary.netSales },
    "Cơ cấu thanh toán": { value: summary.collectedAmount, previous: prior?.summary.collectedAmount },
    "Số đơn theo ngày": { value: summary.orderCount, previous: prior?.summary.orderCount, count: true },
    "Giá trị đơn trung bình": { value: summary.averageOrderValue, previous: prior?.summary.averageOrderValue },
    "Doanh thu theo danh mục": { value: summary.netSales, previous: prior?.summary.netSales },
    "Doanh thu theo thương hiệu": { value: summary.netSales, previous: prior?.summary.netSales },
    "Sản phẩm bán chạy": { value: productRows.reduce((sum, row) => sum + row.netSales, 0), previous: prior?.products.reduce((sum, row) => sum + row.netSales, 0) },
    "Số lượng sản phẩm bán": { value: report.products.reduce((sum, row) => sum + row.netQuantity, 0), previous: prior?.products.reduce((sum, row) => sum + row.netQuantity, 0), count: true },
    "Doanh thu theo thu ngân": { value: summary.netSales, previous: prior?.summary.netSales },
    "Số đơn theo thu ngân": { value: summary.orderCount, previous: prior?.summary.orderCount, count: true },
    "Cơ cấu công nợ": { value: report.debt.totalDebt },
    "Khách hàng còn nợ": { value: report.debt.totalDebt },
    "Doanh thu theo ca": { value: shiftRows.reduce((sum, row) => sum + row.value, 0), previous: prior?.shifts.reduce((sum, row) => sum + row.grossSales, 0) },
  };
  return <ChartMetrics.Provider value={metrics}><div className="finance-overview retail-overview space-y-3">
    <section className="finance-chart-card" aria-label="Chỉ số bán lẻ">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h2 className="text-balance text-lg font-semibold text-on-surface">Tình hình bán lẻ & POS</h2><span className="text-xs text-on-surface-variant">Đơn vị: VND</span></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{kpis.map((item, index) => <div key={item.title} className={`finance-kpi finance-kpi-${index}`}>
        <p className="text-xs font-medium text-white">{item.title}</p><p className="mt-1 break-words text-lg font-semibold tabular-nums text-white sm:text-xl"><AnimatedOverviewValue value={item.value} format={item.unit === "count" ? integer : money} /></p>
        {item.value != null && <Delta value={item.value} previous={item.previous} unit={item.unit} />}
      </div>)}</div>
      <p className="mt-3 text-xs text-on-surface-variant">Kỳ so sánh: {displayDate(previousFilters.from)} – {displayDate(previousFilters.to)}. Công nợ bên dưới là số dư hiện tại.</p>
    </section>

      <section className="finance-chart-card"><h3 className="mb-3 text-balance text-sm font-semibold text-on-surface">Số liệu bán hàng chi tiết</h3><dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {([ ["Doanh thu gộp", summary.grossSales, "text-primary"], ["Giá vốn", summary.totalCost, "text-on-surface"], ["Biên lợi nhuận", summary.grossMarginPercent, "text-tertiary"], ["Chưa thu", summary.dueAmount, "text-tertiary"], ["Công nợ hiện tại", report.debt.totalDebt, "text-on-surface"], ["Nợ quá hạn", report.debt.overdueDebt, "text-error"] ] as const).map(([title, value, tone]) => <div key={title} className="min-w-0"><dt className="text-xs text-on-surface-variant">{title}</dt><dd className={`mt-1 break-words text-sm font-semibold tabular-nums ${tone}`}>{value == null ? "—" : title === "Biên lợi nhuận" ? `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : money(value)}</dd></div>)}
    </dl></section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Doanh thu theo kỳ" hasData={hasSales} className="xl:col-span-2" action={<select aria-label="Kỳ biểu đồ doanh thu" value={period} onChange={event => setPeriod(event.target.value as RetailPeriod)} className="min-h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 text-xs text-on-surface focus:border-primary focus:outline-none"><option value="day">Ngày</option><option value="week">Tuần</option><option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm</option></select>}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 8, right: 10, bottom: 0, left: 2 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={62} /><Tooltip formatter={tooltipMoney} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="netSales" name="Doanh thu thuần" fill={colors[0]} maxBarSize={42} isAnimationActive={!reduceMotion} animationDuration={700} /><Line type="monotone" dataKey="collectedAmount" name="Đã thu" stroke={colors[1]} strokeWidth={2} dot={false} isAnimationActive={!reduceMotion} animationDuration={700} /><Line type="monotone" dataKey="refunds" name="Hoàn tiền" stroke={colors[4]} strokeWidth={2} dot={false} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <DonutCard title="Cơ cấu thanh toán" rows={paymentRows} />
      <ChartCard title="Số đơn theo ngày" hasData={dayRows.some(row => row.orderCount > 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={dayRows}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={tooltipCount} /><Bar dataKey="orderCount" name="Số đơn" fill={colors[2]} maxBarSize={36} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Giá trị đơn trung bình" hasData={dayRows.some(row => row.orderCount > 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={dayRows}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={60} /><Tooltip formatter={tooltipMoney} /><Line type="monotone" dataKey="averageOrderValue" name="Trung bình đơn" stroke={colors[3]} strokeWidth={2.5} isAnimationActive={!reduceMotion} animationDuration={700} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <DonutCard title="Doanh thu theo danh mục" rows={categoryRows.map(row => ({ name: row.name, value: row.sales }))} />
      <HorizontalCard title="Doanh thu theo thương hiệu" rows={brandRows.map(row => ({ name: row.name, value: row.sales }))} />
      <HorizontalCard title="Sản phẩm bán chạy" rows={productRows.map(row => ({ name: row.productName, value: row.netSales }))} />
      <HorizontalCard title="Số lượng sản phẩm bán" rows={[...report.products].sort((a, b) => b.netQuantity - a.netQuantity).map(row => ({ name: row.productName, value: row.netQuantity }))} valueLabel="Số sản phẩm" count countUnit="sản phẩm" />
      <HorizontalCard title="Doanh thu theo thu ngân" rows={cashierRows} />
      <HorizontalCard title="Số đơn theo thu ngân" rows={cashierOrders} valueLabel="Số đơn" count />
      <DonutCard title="Cơ cấu công nợ" rows={debtRows} />
      <HorizontalCard title="Khách hàng còn nợ" rows={customerDebt} />
      <HorizontalCard title="Doanh thu theo ca" rows={shiftRows} />
      <section className="finance-chart-card xl:col-span-2">
        <h3 className="mb-3 text-balance text-sm font-semibold text-on-surface">Biến động sản phẩm bán chạy</h3>
        {prior && productRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-outline-variant text-on-surface-variant"><th scope="col" className="pb-2 font-medium">Sản phẩm</th><th scope="col" className="pb-2 text-right font-medium">Doanh thu</th><th scope="col" className="pb-2 text-right font-medium">Thay đổi doanh thu</th><th scope="col" className="pb-2 text-right font-medium">Số lượng</th></tr></thead><tbody>{productRows.slice(0, 6).map(row => {
          const old = prior.products.find(item => item.productId === row.productId);
          const salesDelta = comparison(row.netSales, old?.netSales);
          const quantityDelta = old ? row.netQuantity - old.netQuantity : null;
          const salesTone = salesDelta == null ? "text-on-surface-variant" : salesDelta.amount > 0 ? "text-change-up" : salesDelta.amount < 0 ? "text-change-down" : "text-change-flat";
          const quantityTone = quantityDelta == null ? "text-on-surface-variant" : quantityDelta > 0 ? "text-change-up" : quantityDelta < 0 ? "text-change-down" : "text-change-flat";
          return <tr key={row.productId} className="border-b border-outline-variant/60 last:border-0">
            <th scope="row" className="max-w-52 py-2 font-medium text-on-surface">{row.productName}<span className="block font-normal text-on-surface-variant">{row.sku}</span></th>
            <td className="py-2 text-right font-semibold tabular-nums text-primary">{money(row.netSales)}</td>
            <td className={cn("py-2 text-right tabular-nums", salesTone)}>{salesDelta == null ? "—" : salesDelta.amount === 0 ? "–" : `${salesDelta.amount > 0 ? "▲ " : "▼ "}${money(Math.abs(salesDelta.amount))}${salesDelta.percent == null ? "" : ` · ${Math.abs(salesDelta.percent).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`}`}</td>
            <td className="py-2 text-right tabular-nums text-on-surface">{integer(row.netQuantity)} <span className={quantityTone}>{quantityDelta == null ? "—" : quantityDelta === 0 ? "–" : `(${quantityDelta > 0 ? "▲ " : "▼ "}${integer(Math.abs(quantityDelta))} SP)`}</span></td>
          </tr>;
        })}</tbody></table></div> : <div className="flex min-h-36 items-center justify-center rounded-lg bg-surface-container-low px-4 text-center text-xs text-on-surface-variant">{previousErrorKey === compareKey ? "Không tải được dữ liệu kỳ so sánh." : !prior ? "Đang tải dữ liệu kỳ so sánh." : "Chưa có sản phẩm bán trong kỳ đã chọn."}</div>}
      </section>
    </div>
  </div></ChartMetrics.Provider>;
}
