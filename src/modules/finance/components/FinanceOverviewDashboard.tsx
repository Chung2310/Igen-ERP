import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, CalendarClock } from "lucide-react";
import { cn } from "../../student-management/lib/utils";
import { money } from "./ManagementUI";
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

function ChartCard({ title, detail, hasData, children, className = "", action }: { title: string; detail: string; hasData: boolean; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return <section className={cn("finance-chart-card", className)}>
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-balance text-sm font-semibold text-on-surface">{title}</h3><p className="mt-0.5 text-pretty text-xs text-on-surface-variant">{detail}</p></div>
      {action}
    </div>
    {hasData ? <div role="img" aria-label={title} className="h-52 min-w-0 sm:h-56">{children}</div> : <div className="flex min-h-32 items-center justify-center rounded-lg bg-surface-container-low px-4 text-center text-xs text-on-surface-variant">Chưa có dữ liệu trong phạm vi đã chọn.</div>}
  </section>;
}

function RingCard({ title, detail, rows }: { title: string; detail: string; rows: { name: string; value: number }[] }) {
  const items = rows.filter(row => row.value > 0);
  return <ChartCard title={title} detail={detail} hasData={items.length > 0}>
    <div className="grid h-full grid-cols-1 items-center gap-2 sm:grid-cols-[52%_1fr]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="58%" outerRadius="80%" stroke="none" paddingAngle={2} isAnimationActive={false}>
          {items.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}
        </Pie><Tooltip formatter={chartTooltip} /></PieChart>
      </ResponsiveContainer>
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

export default function FinanceOverviewDashboard({ report, period, from, to, onPeriodChange }: { report: Report; period: OverviewPeriod; from: string; to: string; onPeriodChange?: (period: "week" | "month" | "quarter" | "year") => void }) {
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
  const knownStockRisk = inventory.filter(row => row.risk != null);
  const stockRisk = knownStockRisk.length ? knownStockRisk.reduce((sum, row) => sum + (row.risk || 0), 0) : null;
  const vatRows = [{ name: "VAT đầu ra", value: report.vat?.output || 0 }, { name: "VAT đầu vào", value: report.vat?.input || 0 }];
  const urgent = [...receivables.map(row => ({ ...row, party: row.customerName || "Khách hàng", type: "Phải thu" })), ...payables.map(row => ({ ...row, party: row.supplierName || "Nhà cung cấp", type: "Phải trả" }))].filter(row => row.balance > 0 && row.daysUntil <= 7).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 5);
  const kpis = [
    ["Doanh thu hàng hóa", s.revenue], ["Giá vốn", s.cost], ["Lãi gộp", s.grossProfit],
    ["Lãi ròng quản trị", s.netProfit], ["Dòng tiền ròng", s.cashIn != null && s.cashOut != null ? s.cashIn - s.cashOut : null], ["Phải thu quá hạn", s.overdue],
  ] as const;

  return <div className="finance-overview space-y-3">
    {!trends.length && !cash.length && !expenses.length && !lines.length && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-xs text-on-surface-variant"><p className="text-pretty">Chưa có giao dịch trong kỳ đã chọn. Số dư công nợ và tồn kho vẫn hiển thị theo hiện tại.</p><a href="/tai-chinh?sub=thu-chi" className="font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở Thu - Chi</a></div>}
    <section className="finance-chart-card !p-3 sm:!p-4" aria-label="Chỉ số tài chính">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-balance text-lg font-semibold text-on-surface">Tình hình tài chính</h2><p className="text-pretty text-xs text-on-surface-variant">Doanh thu, dòng tiền và số dư công nợ trong một màn hình.</p></div>
        <span className="text-xs text-on-surface-variant">Đơn vị: VND</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value], index) => {
          return <div key={label} className={`finance-kpi finance-kpi-${index}`}>
            <p className="text-pretty text-xs font-medium text-white">{label}</p>
            <p className="mt-1 break-words text-lg font-semibold tabular-nums text-white sm:text-xl">{money(value)}</p>
          </div>;
        })}
      </div>
      <p className="mt-3 text-pretty text-xs text-on-surface-variant">Công nợ và tồn kho là số dư hiện tại; bộ lọc ngày áp dụng cho doanh thu, chi phí, dòng tiền và VAT.</p>
    </section>

    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <section className="finance-chart-card">
        <div className="mb-3"><h3 className="text-balance text-sm font-semibold text-on-surface">Số liệu tài chính chi tiết</h3><p className="mt-0.5 text-pretty text-xs text-on-surface-variant">Dòng tiền trong kỳ và số dư hiện tại</p></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {([
            ["Tiền đã thu", s.cashIn], ["Tiền đã chi", s.cashOut], ["Chi phí ghi nhận", s.expense],
            ["Phải thu hiện tại", s.receivable], ["Phải trả hiện tại", s.payable], ["NCC đến hạn 5 ngày", s.payableSoon],
            ["Giá trị tồn kho", s.inventoryValue], ["VAT dự kiến phải nộp", report.vat?.payable ?? null],
          ] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-pretty text-xs text-on-surface-variant">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-on-surface">{money(value)}</dd></div>)}
        </dl>
      </section>
      <ChartCard title="Doanh thu theo kỳ" detail="Cột doanh thu; đường chi phí và lãi ròng" hasData={trends.length > 0 && revenueRows.length > 0} className="xl:col-span-2" action={<select aria-label="Kỳ biểu đồ doanh thu" className="min-h-9 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:border-primary focus:outline-none" value={period === "7" || period === "30" || period === "custom" ? "custom" : period} onChange={(event) => onPeriodChange?.(event.target.value as "week" | "month" | "quarter" | "year")} disabled={!onPeriodChange}>
        {(period === "7" || period === "30" || period === "custom") && <option value="custom" disabled>Khoảng chọn</option>}
        <option value="week">Tuần</option><option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm</option>
      </select>}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={revenueRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={58} /><Tooltip formatter={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue" name="Doanh thu" fill={colors[0]} maxBarSize={38} isAnimationActive={false} /><Line dataKey="expense" name="Chi phí" stroke={colors[2]} strokeWidth={2} dot={false} isAnimationActive={false} /><Line dataKey="net" name="Lãi ròng" stroke={colors[1]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Biên lãi theo ngày" detail="Lãi gộp và lãi ròng từ giao dịch đã ghi nhận" hasData={trendRows.some(row => row.gross != null)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={trendRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={58} /><Tooltip formatter={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Area dataKey="gross" name="Lãi gộp" stroke={colors[1]} fill="var(--finance-chart-teal-soft)" strokeWidth={2} connectNulls={false} isAnimationActive={false} /><Line dataKey="net" name="Lãi ròng" stroke={colors[3]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Thu, chi và dòng tiền ròng" detail="Dòng tiền thực tế theo ngày" hasData={cashRows.length > 0} className="xl:col-span-2">
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={cashRows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={58} /><Tooltip formatter={chartTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="thu" name="Thu" fill={colors[1]} maxBarSize={20} isAnimationActive={false} /><Bar dataKey="chi" name="Chi" fill={colors[2]} maxBarSize={20} isAnimationActive={false} /><Line dataKey="net" name="Ròng" stroke={colors[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer>
      </ChartCard>
      <RingCard title="Cơ cấu chi phí" detail="Chi phí đã ghi nhận theo danh mục" rows={expenseGroups} />
      <RingCard title="Cơ cấu phương thức thanh toán" detail="Tổng giá trị thu và chi theo phương thức" rows={methodGroups} />
      <RingCard title="Chi phí cố định và biến đổi" detail="Phân loại chi phí đã ghi nhận" rows={expenseClasses} />
      <ChartCard title="Tuổi nợ phải thu" detail="Số dư hiện tại theo hạn thanh toán" hasData={receivableAging.some(row => row.value > 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={receivableAging} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Phải thu" fill={colors[0]} maxBarSize={24} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Tuổi nợ phải trả" detail="Số dư nhà cung cấp theo hạn thanh toán" hasData={payableAging.some(row => row.value > 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={payableAging} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Phải trả" fill={colors[2]} maxBarSize={24} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Đối tượng có dư nợ lớn" detail="Phải thu và phải trả hiện tại" hasData={debtParties.length > 0}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={debtParties} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Dư nợ" fill={colors[3]} maxBarSize={20} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Doanh thu theo nhóm hàng" detail="Các nhóm có doanh thu cao nhất trong kỳ" hasData={revenueCategories.some(row => row.value !== 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={revenueCategories} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Doanh thu" fill={colors[1]} maxBarSize={20} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Doanh thu theo thương hiệu" detail="Các thương hiệu có doanh thu cao nhất" hasData={revenueBrands.some(row => row.value !== 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={revenueBrands} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="Doanh thu" fill={colors[0]} maxBarSize={20} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Tuổi hàng tồn theo IMEI" detail={`Số lượng hàng đang tồn · rủi ro giá: ${money(stockRisk)}`} hasData={inventory.length > 0}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={stockBands} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={25} /><Tooltip formatter={(value) => `${value} hàng`} /><Bar dataKey="value" name="Số lượng" fill={colors[2]} maxBarSize={40} isAnimationActive={false} /></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <ChartCard title="VAT đầu vào và đầu ra" detail={`Dự kiến phải nộp: ${money(report.vat?.payable)}`} hasData={vatRows.some(row => row.value > 0)}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={vatRows} layout="vertical" margin={{ left: 0, right: 14 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={82} tick={{ fontSize: 10 }} /><Tooltip formatter={chartTooltip} /><Bar dataKey="value" name="VAT" maxBarSize={38} isAnimationActive={false}>{vatRows.map((row, index) => <Cell key={row.name} fill={colors[index === 0 ? 2 : 1]} />)}</Bar></ComposedChart></ResponsiveContainer>
      </ChartCard>
      <section className="finance-chart-card">
        <div className="mb-3"><h3 className="text-balance text-sm font-semibold text-on-surface">Tiến độ hòa vốn</h3><p className="mt-0.5 text-pretty text-xs text-on-surface-variant">Theo ngân sách chi phí cố định và doanh thu kỳ này</p></div>
        {report.breakeven?.progress == null ? <div className="flex min-h-32 items-center justify-center rounded-lg bg-surface-container-low px-4 text-center text-xs text-on-surface-variant">Chưa đủ dữ liệu để tính điểm hòa vốn.</div> : <div className="flex min-h-52 flex-col justify-center gap-4">
          <p className="text-3xl font-semibold tabular-nums text-on-surface">{Math.round(report.breakeven.progress)}%</p>
          <div className="h-3 overflow-hidden rounded-full bg-surface-container-low"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, report.breakeven.progress))}%` }} /></div>
          <div className="grid grid-cols-2 gap-3 text-xs"><p className="text-on-surface-variant">Chi phí cố định<strong className="mt-1 block font-semibold tabular-nums text-on-surface">{money(report.breakeven.fixedCosts)}</strong></p><p className="text-on-surface-variant">Cần thêm mỗi ngày<strong className="mt-1 block font-semibold tabular-nums text-on-surface">{money(report.breakeven.dailyNeeded)}</strong></p></div>
        </div>}
      </section>
      <section className="finance-chart-card">
        <div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="text-balance text-sm font-semibold text-on-surface">Khoản nợ cần xử lý</h3><p className="mt-0.5 text-pretty text-xs text-on-surface-variant">Quá hạn hoặc đến hạn trong 7 ngày</p></div><CalendarClock className="size-4 shrink-0 text-tertiary" aria-hidden="true" /></div>
        {urgent.length ? <ul className="divide-y divide-outline-variant">{urgent.map((row, index) => <li key={`${row.party}-${row.dueDate}-${index}`} className="flex items-center justify-between gap-2 py-2 text-xs"><div className="min-w-0"><p className="truncate font-medium text-on-surface">{row.party}</p><p className="text-on-surface-variant">{row.type} · {row.dueDate}</p></div><strong className="shrink-0 font-semibold tabular-nums text-on-surface">{shortMoney(row.balance)}</strong></li>)}</ul> : <div className="flex min-h-40 items-center justify-center rounded-lg bg-surface-container-low px-4 text-center text-xs text-on-surface-variant">Không có khoản nợ cần xử lý.</div>}
        <a href="/tai-chinh?sub=cong-no" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Mở công nợ <ArrowRight className="size-3" aria-hidden="true" /></a>
      </section>
    </div>
  </div>;
}
