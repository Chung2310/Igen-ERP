import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, FileCheck2, FileClock, FileText, Handshake, PackageCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import { StyledSelect } from "../common/StyledSelect";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewChartViewport } from "./OverviewChartViewport";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import { useOverviewPeriod } from "./OverviewPeriodContext";
import { getQuotationOverview, type QuotationOverview } from "./quotationOverviewService";
import { cn } from "../../modules/student-management/lib/utils";
import { quotationUrl } from "../../modules/quotation/routing";
import "../../modules/finance/finance-overview.css";

const colors = ["var(--finance-chart-blue)", "var(--finance-chart-teal)", "var(--finance-chart-orange)", "var(--finance-chart-violet)", "var(--finance-chart-red)"];
const integer = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const quantity = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const money = (value: number, currency: string) => new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(value);
const compactMoney = (value: number) => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const countTooltip = (value: unknown) => typeof value === "number" ? integer(value) : String(value ?? "—");
const statusRows = [
  { key: "draft", name: "Bản nháp" }, { key: "needs_info", name: "Thiếu thông tin" },
  { key: "pending_review", name: "Chờ duyệt" }, { key: "approved", name: "Đã duyệt" },
  { key: "rejected", name: "Cần chỉnh sửa" },
] as const;

function trendRows(data: QuotationOverview) {
  const start = new Date(`${data.from}T00:00:00Z`);
  const end = new Date(`${data.to}T00:00:00Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const byDay = new Map(data.quotes.trend.map(row => [row.date, row]));
  const buckets = new Map<string, { date: string; count: number; approved: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start.getTime() + offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const bucket = new Date(date);
    if (days > 180) bucket.setUTCDate(1);
    else if (days > 45) bucket.setUTCDate(bucket.getUTCDate() - (bucket.getUTCDay() + 6) % 7);
    const bucketKey = bucket.toISOString().slice(0, 10);
    const current = buckets.get(bucketKey) ?? { date: bucketKey, count: 0, approved: 0 };
    current.count += byDay.get(key)?.count ?? 0;
    current.approved += byDay.get(key)?.approved ?? 0;
    buckets.set(bucketKey, current);
  }
  return [...buckets.values()].map(row => ({ ...row, label: days > 180 ? `${row.date.slice(5, 7)}/${row.date.slice(0, 4)}` : `${row.date.slice(8, 10)}/${row.date.slice(5, 7)}` }));
}

function ChartCard({ title, children, empty, href = quotationUrl("home"), className = "" }: { title: string; children: React.ReactNode; empty?: string; href?: string; className?: string }) {
  return <section className={cn("finance-chart-card", className)}>
    <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-balance text-sm font-semibold text-on-surface">{title}</h3><a href={href} aria-label={`${title}: xem chi tiết`} className="shrink-0 text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</a></div>
    {empty ? <p className="flex min-h-52 items-center justify-center text-center text-pretty text-sm text-on-surface-variant">{empty}</p> : children}
  </section>;
}

export default function QuotationOverviewSection() {
  const period = useOverviewPeriod();
  const { userProfile } = useAuth();
  const branch = useBranchOptional();
  const branchId = branch?.activeBranchId || userProfile?.branchId || "";
  const companyCode = userProfile?.companyCode || "";
  const from = period?.from || "";
  const to = period?.to || "";
  const previousFrom = period?.previousFrom || "";
  const previousTo = period?.previousTo || "";
  const reduceMotion = useReducedMotion();
  const requestKey = JSON.stringify([companyCode, branchId, from, to, previousFrom, previousTo]);
  const [result, setResult] = useState<{ key: string; current: QuotationOverview | null; previous: QuotationOverview | null; error: string } | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const loading = result?.key !== requestKey;
  const current = loading ? null : result?.current ?? null;
  const previous = loading ? null : result?.previous ?? null;
  const error = loading ? "" : result?.error ?? "";

  useEffect(() => {
    if (!branchId || !companyCode || !from || !to) return;
    const controller = new AbortController();
    void Promise.allSettled([
      getQuotationOverview(from, to, companyCode, branchId, controller.signal),
      previousFrom && previousTo ? getQuotationOverview(previousFrom, previousTo, companyCode, branchId, controller.signal) : Promise.resolve(null),
    ]).then(([next, prior]) => {
      if (controller.signal.aborted) return;
      setResult({
        key: requestKey,
        current: next.status === "fulfilled" ? next.value : null,
        previous: prior.status === "fulfilled" ? prior.value : null,
        error: next.status === "rejected" ? next.reason instanceof Error ? next.reason.message : "Không thể tải thống kê Báo giá." : "",
      });
    });
    return () => controller.abort();
  }, [branchId, companyCode, from, to, previousFrom, previousTo, requestKey]);

  const currencies = current?.quotes.values.map(row => row.currency) ?? [];
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] || "VND";
  const value = current?.quotes.values.find(row => row.currency === currency);
  const previousValue = previous?.quotes.values.find(row => row.currency === currency);
  const statuses = statusRows.map((row, index) => ({ name: row.name, count: current?.quotes.byStatus[row.key] ?? 0, color: colors[index] }));
  const kinds = [
    { name: "Báo giá khách", value: current?.quotes.byKind.customer ?? 0, color: colors[0] },
    { name: "Dự toán", value: current?.quotes.byKind.estimate ?? 0, color: colors[1] },
  ].filter(row => row.value > 0);
  const trend = useMemo(() => current ? trendRows(current) : [], [current]);
  const kpis = [
    { label: "Báo giá trong kỳ", value: current?.quotes.total, previous: previous?.quotes.total, icon: FileText },
    { label: "Đã duyệt", value: current?.quotes.byStatus.approved, previous: previous?.quotes.byStatus.approved, icon: BadgeCheck },
    { label: "Chờ duyệt", value: current?.quotes.byStatus.pending_review, icon: FileClock },
    { label: "Cần bổ sung", value: current?.quotes.byStatus.needs_info, icon: FileCheck2 },
    ...(current?.contracts ? [{ label: "Hợp đồng", value: current.contracts.total, icon: Handshake }] : []),
    ...(current?.acceptances ? [{ label: "Nghiệm thu", value: current.acceptances.total, icon: PackageCheck }] : []),
  ];

  if (!branchId) return <p role="status" className="finance-chart-card text-pretty text-sm text-on-surface-variant">Chọn chi nhánh để xem Tổng quan Báo giá.</p>;
  return <div className="finance-overview space-y-3 text-left text-on-surface">
    <h2 className="sr-only">Tổng quan Báo giá</h2>
    {error && <p role="alert" className="rounded-md border border-error bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>}
    {loading && !current ? <div role="status" aria-label="Đang tải Tổng quan Báo giá" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-md bg-surface-container-low" />)}</div> : current ? <>
      <section className="finance-chart-card" aria-label="Chỉ số Báo giá">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-balance text-lg font-semibold text-on-surface">Tình hình báo giá</h3><span className="text-xs text-on-surface-variant">Toàn công ty · Theo ngày tạo trong kỳ</span></div>
        <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", kpis.length === 6 ? "xl:grid-cols-6" : kpis.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4")}>{kpis.map((item, index) => {
          const Icon = item.icon;
          return <article key={item.label} className={cn("finance-kpi", `finance-kpi-${index}`, "flex min-h-28 flex-col")}>
            <div className="flex items-start justify-between gap-2"><p className="text-pretty text-xs font-medium text-white">{item.label}</p><Icon aria-hidden="true" className="size-4 shrink-0 text-on-primary opacity-70" /></div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white sm:text-xl"><AnimatedOverviewValue value={loading ? null : item.value} format={integer} /></p>
            {item.previous !== undefined && <OverviewKpiDelta value={item.value} previous={item.previous} unit="" />}
          </article>;
        })}</div>
        <p className="mt-3 text-pretty text-xs text-on-surface-variant">Trạng thái là trạng thái hiện tại của chứng từ được tạo trong kỳ. Hợp đồng và nghiệm thu chỉ hiển thị khi bạn có quyền xem.</p>
      </section>
      {current && current.quotes.total === 0 && <section className="finance-chart-card flex flex-wrap items-center justify-between gap-3"><p className="text-pretty text-sm text-on-surface-variant">Chưa có báo giá trong kỳ đã chọn.</p><a href={quotationUrl("home")} className="text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở Báo giá</a></section>}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Xu hướng tạo và duyệt báo giá" className="xl:col-span-2" empty={!current?.quotes.total ? "Chưa có báo giá để vẽ xu hướng." : undefined}>
          <div role="img" aria-label={`Xu hướng báo giá: ${trend.map(row => `${row.label}: ${row.count} tạo, ${row.approved} đã duyệt`).join("; ")}`} className="h-64 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} minTickGap={24} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={countTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Area type="monotone" dataKey="count" name="Đã tạo" stroke={colors[0]} fill="var(--finance-chart-teal-soft)" strokeWidth={2} isAnimationActive={!reduceMotion} animationDuration={700} /><Area type="monotone" dataKey="approved" name="Hiện đã duyệt" stroke={colors[1]} fill="transparent" strokeWidth={2} isAnimationActive={!reduceMotion} animationDuration={700} /></AreaChart></ResponsiveContainer></OverviewChartViewport></div>
        </ChartCard>
        <ChartCard title="Trạng thái báo giá" empty={!current?.quotes.total ? "Chưa có trạng thái để thống kê." : undefined}>
          <div role="img" aria-label={statuses.map(row => `${row.name}: ${row.count}`).join("; ")} className="h-64 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={statuses} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 0 }}><XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={95} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><Tooltip formatter={countTooltip} /><Bar dataKey="count" name="Báo giá" maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700}>{statuses.map(row => <Cell key={row.name} fill={row.color} />)}<LabelList dataKey="count" position="right" fill="var(--color-on-surface-variant)" fontSize={11} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div>
        </ChartCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Loại báo giá" empty={!kinds.length ? "Chưa có báo giá hoặc dự toán." : undefined}>
          <div role="img" aria-label={kinds.map(row => `${row.name}: ${row.value}`).join("; ")} className="h-60 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={kinds} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="76%" stroke="none" isAnimationActive={!reduceMotion} animationDuration={700}>{kinds.map(row => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip formatter={countTooltip} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></OverviewChartViewport></div>
        </ChartCard>
        <ChartCard title="Giá trị báo giá" className="xl:col-span-2" empty={!current?.quotes.values.length ? "Chưa có báo giá với giá trị đã xác định." : undefined}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p className="text-pretty text-xs text-on-surface-variant">Giá trị theo chứng từ tạo trong kỳ. Báo giá khách và dự toán được tách riêng để tránh đếm trùng khi chuyển đổi.</p>{currencies.length > 1 && <div className="w-32"><StyledSelect ariaLabel="Tiền tệ thống kê Báo giá" value={currency} options={currencies.map(item => ({ value: item, label: item }))} onChange={setSelectedCurrency} className="h-9" /></div>}</div>
          <div className="grid grid-cols-2 gap-3 border-b border-outline-variant pb-3"><div><p className="text-xs text-on-surface-variant">Báo giá khách · {currency}</p><strong className="text-lg font-semibold tabular-nums text-on-surface">{money(value?.customer ?? 0, currency)}</strong></div><div><p className="text-xs text-on-surface-variant">Dự toán · {currency}</p><strong className="text-lg font-semibold tabular-nums text-on-surface">{money(value?.estimate ?? 0, currency)}</strong></div></div>
          <div role="img" aria-label={`Báo giá khách ${money(value?.customer ?? 0, currency)}, đã duyệt ${money(value?.approvedCustomer ?? 0, currency)}; dự toán ${money(value?.estimate ?? 0, currency)}, đã duyệt ${money(value?.approvedEstimate ?? 0, currency)}`} className="h-52 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Báo giá khách", total: value?.customer ?? 0, approved: value?.approvedCustomer ?? 0 }, { name: "Dự toán", total: value?.estimate ?? 0, approved: value?.approvedEstimate ?? 0 }]} margin={{ top: 14, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tickFormatter={compactMoney} width={58} tick={{ fontSize: 10 }} /><Tooltip formatter={(amount) => typeof amount === "number" ? money(amount, currency) : amount} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="total" name="Tổng giá trị" fill={colors[0]} maxBarSize={44} isAnimationActive={!reduceMotion} animationDuration={700} /><Bar dataKey="approved" name="Đã duyệt" fill={colors[1]} maxBarSize={44} isAnimationActive={!reduceMotion} animationDuration={700} /></BarChart></ResponsiveContainer></OverviewChartViewport></div>
          {previousValue && <p className="border-t border-outline-variant pt-2 text-xs tabular-nums text-on-surface-variant">Kỳ trước: báo giá khách {money(previousValue.customer, currency)} · dự toán {money(previousValue.estimate, currency)}</p>}
        </ChartCard>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {([['Khách hàng có nhiều báo giá', current?.quotes.customers, 'count', 'báo giá'], ['Hạng mục được báo giá nhiều', current?.quotes.products, 'quantity', 'số lượng']] as const).map(([title, rows, key, unit]) => {
          const chartRows = rows?.map(row => ({ name: row.name, value: row[key] })) ?? [];
          return <ChartCard key={title} title={title} href={quotationUrl(key === "count" ? "customerQuotes" : "quotes")} empty={!chartRows.length ? "Chưa có dữ liệu để xếp hạng." : undefined}>
            <div role="img" aria-label={chartRows.map(row => `${row.name}: ${key === "count" ? integer(row.value) : quantity(row.value)} ${unit}`).join("; ")} className="h-64 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 0 }}><XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={118} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(name: string) => name.length > 18 ? `${name.slice(0, 17)}…` : name} /><Tooltip formatter={(value) => typeof value === "number" ? key === "count" ? integer(value) : quantity(value) : value} /><Bar dataKey="value" name={unit} fill={key === "count" ? colors[3] : colors[2]} maxBarSize={19} isAnimationActive={!reduceMotion} animationDuration={700}><LabelList dataKey="value" position="right" fill="var(--color-on-surface-variant)" fontSize={11} formatter={(value: unknown) => typeof value === "number" ? key === "count" ? integer(value) : quantity(value) : ""} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div>
          </ChartCard>;
        })}
      </div>
      {(current?.contracts || current?.acceptances) && <div className="grid gap-3 lg:grid-cols-2">
        {current.contracts && <ChartCard title="Tiến độ hợp đồng" href={quotationUrl("documents", undefined, "contracts")}><div role="img" aria-label={`${current.contracts.draft} hợp đồng nháp, ${current.contracts.signed} đã ký`} className="h-52"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Nháp", count: current.contracts.draft }, { name: "Đã ký", count: current.contracts.signed }]} margin={{ top: 14, right: 8, left: -16, bottom: 0 }}><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip formatter={countTooltip} /><Bar dataKey="count" name="Hợp đồng" maxBarSize={72} isAnimationActive={!reduceMotion} animationDuration={700}><Cell fill={colors[2]} /><Cell fill={colors[1]} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div></ChartCard>}
        {current.acceptances && <ChartCard title="Tiến độ nghiệm thu" href={quotationUrl("documents", undefined, "acceptances")}><div role="img" aria-label={`${current.acceptances.draft} biên bản nháp, ${current.acceptances.completed} hoàn tất`} className="h-52"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: "Nháp", count: current.acceptances.draft }, { name: "Hoàn tất", count: current.acceptances.completed }]} margin={{ top: 14, right: 8, left: -16, bottom: 0 }}><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip formatter={countTooltip} /><Bar dataKey="count" name="Biên bản" maxBarSize={72} isAnimationActive={!reduceMotion} animationDuration={700}><Cell fill={colors[3]} /><Cell fill={colors[0]} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div></ChartCard>}
      </div>}
    </> : null}
  </div>;
}
