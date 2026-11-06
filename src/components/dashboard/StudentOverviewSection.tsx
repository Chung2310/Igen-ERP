import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight } from "lucide-react";
import { ErpRefreshButton } from "../common/ErpRefreshButton";
import { HrEmptyIllustration, type HrEmptyIllustrationKind } from "../hr/HrEmptyIllustration";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import { OverviewPeriodActions, useOverviewPeriod } from "./OverviewPeriodContext";
import { buildStudentOverview } from "./studentOverviewMetrics";
import { useStudents } from "../../modules/student-management/hooks/useStudents";
import { useCourses } from "../../modules/student-management/hooks/useCourses";
import { useBatches } from "../../modules/student-management/hooks/useBatches";
import { cn } from "../../modules/student-management/lib/utils";
import "./overview-dashboard.css";
import "../../modules/finance/finance-overview.css";

const colors = ["var(--finance-chart-blue)", "var(--finance-chart-teal)", "var(--finance-chart-orange)", "var(--finance-chart-violet)", "var(--finance-chart-red)"];
const integer = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `${integer(value)} đ`;
const shortMoney = (value: number) => {
  const absolute = Math.abs(value);
  const [scale, unit] = absolute >= 1e9 ? [1e9, " tỷ"] : absolute >= 1e6 ? [1e6, " tr"] : absolute >= 1e3 ? [1e3, " nghìn"] : [1, ""];
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: scale === 1 ? 0 : 1 }).format(value / Number(scale))}${unit}`;
};
const countTooltip = (value: number | string | undefined) => typeof value === "number" ? integer(value) : value ?? "—";
const moneyTooltip = (value: number | string | undefined) => typeof value === "number" ? money(value) : value ?? "—";

function Empty({ kind, children }: { kind: HrEmptyIllustrationKind; children: React.ReactNode }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-3 text-center text-pretty text-xs text-on-surface-variant"><HrEmptyIllustration kind={kind} /><p className="mt-1">{children}</p></div>;
}

function ChartCard({ title, children, hasData, kind = "training", className = "", href, emptyText }: {
  title: string; children: React.ReactNode; hasData: boolean; kind?: HrEmptyIllustrationKind; className?: string; href?: string; emptyText?: string;
}) {
  return <section className={cn("finance-chart-card", className)}>
    <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-balance text-sm font-semibold text-on-surface">{title}</h3>{href && <a href={href} aria-label={`${title}: xem chi tiết`} className="shrink-0 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</a>}</div>
    {hasData ? children : <Empty kind={kind}>{emptyText || "Chưa có dữ liệu trong phạm vi đã chọn."}</Empty>}
  </section>;
}

export default function StudentOverviewSection() {
  const period = useOverviewPeriod();
  const { students, loading: studentsLoading, error: studentsError, refetch: refetchStudents } = useStudents();
  const { courses, loading: coursesLoading, error: coursesError, refetch: refetchCourses } = useCourses();
  const { batches, loading: batchesLoading, error: batchesError, refetch: refetchBatches } = useBatches();
  const reduceMotion = useReducedMotion();
  const today = new Date().toLocaleDateString("en-CA");
  const from = period?.from || `${today.slice(0, 7)}-01`;
  const to = period?.to || today;
  const previousFrom = period?.previousFrom || "";
  const previousTo = period?.previousTo || "";
  const data = useMemo(() => buildStudentOverview(students, courses, batches, { from, to, previousFrom, previousTo }), [students, courses, batches, from, to, previousFrom, previousTo]);
  const loading = studentsLoading || coursesLoading || batchesLoading;
  const error = studentsError || coursesError || batchesError;
  const refresh = () => { void Promise.all([refetchStudents(), refetchCourses(), refetchBatches()]); };
  const chartMotion = !reduceMotion;
  const feeSplit = [{ name: "Đã đóng", value: Math.min(data.tuition.totalPaid, data.tuition.totalFee) }, { name: "Còn phải thu", value: data.tuition.outstanding }].filter(row => row.value > 0);
  const studentHref = "/quan-ly-hoc-vien?sub=hoc-vien";
  const tuitionHref = "/quan-ly-hoc-vien?sub=hoc-phi";
  const kpis = [
    { label: "Tổng học viên", value: data.counts.students },
    { label: "Đăng ký trong kỳ", value: data.counts.registrations, previous: data.counts.previousRegistrations },
    { label: "Đang học", value: data.counts.studying },
    { label: "Đã tốt nghiệp", value: data.counts.graduated },
    { label: "Lớp đang / sắp mở", value: data.counts.activeBatches },
    { label: "Còn nợ học phí", value: data.counts.debtors },
  ];
  const financial = [
    { label: "Tổng học phí", value: !studentsError && data.counts.feeKnown ? data.tuition.totalFee : null, tone: "blue" },
    { label: "Đã đóng lũy kế", value: !studentsError && data.counts.feeKnown ? data.tuition.totalPaid : null, tone: "teal" },
    { label: "Còn phải thu", value: !studentsError && data.counts.feeKnown ? data.tuition.outstanding : null, tone: "orange" },
    { label: "Thu trong kỳ", value: studentsError ? null : data.tuition.collectedInPeriod, tone: "violet" },
  ];

  return <div className="finance-overview space-y-3 text-left text-on-surface">
    <OverviewPeriodActions>
      <h2 className="sr-only">Tổng quan Học viên</h2>
      <ErpRefreshButton onClick={refresh} loading={loading} />
    </OverviewPeriodActions>
    {error && <div role="alert" className="rounded-md border border-error bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div>}
    {loading && !students.length && <div role="status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Đang tải Tổng quan Học viên">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-md bg-surface-container-low" />)}</div>}
    {!loading && !students.length && !studentsError && <section className="finance-chart-card flex flex-wrap items-center justify-between gap-3"><p className="text-pretty text-sm text-on-surface-variant">Chưa có học viên trong chi nhánh này. Các biểu đồ bên dưới sẽ cập nhật khi có dữ liệu.</p><a className="inline-flex items-center gap-1 text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary" href={studentHref}>Mở danh sách học viên <ArrowRight className="size-4" aria-hidden="true" /></a></section>}
    {(!loading || students.length > 0) && <>
            <section className="finance-chart-card" aria-label="Chỉ số học viên">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h3 className="text-balance text-sm font-semibold text-on-surface">Tình hình học viên</h3><span className="text-xs text-on-surface-variant">{coursesError ? "—" : integer(data.counts.courses)} khóa học</span></div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{kpis.map((item, index) => <article key={item.label} className={`finance-kpi finance-kpi-${index} flex min-h-28 flex-col`}><p className="text-pretty text-xs font-medium text-white">{item.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-white"><AnimatedOverviewValue value={studentsError || (index === 4 && batchesError) ? null : item.value} format={integer} /></p>{item.previous !== undefined && <OverviewKpiDelta value={studentsError ? null : item.value} previous={studentsError ? null : item.previous} unit="học viên" />}</article>)}</div>
            </section>
            <section className="finance-chart-card" aria-label="Số liệu học phí chi tiết">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h3 className="text-balance text-sm font-semibold text-on-surface">Số liệu học phí chi tiết</h3><span className="text-xs text-on-surface-variant">Đơn vị: VND</span></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">{financial.map(item => <div key={item.label} className="min-w-0"><dt className="text-pretty text-xs text-on-surface-variant">{item.label}</dt><dd className={cn("mt-0.5 break-words text-xl font-bold tabular-nums", item.value === null ? "text-on-surface-variant" : `finance-detail-value finance-detail-value--${item.tone}`)}>{item.value === null ? "—" : money(item.value)}</dd></div>)}</dl>
              <p className="mt-3 text-pretty text-xs text-on-surface-variant">Tổng học phí và số dư là lũy kế theo hồ sơ hiện tại. Thu trong kỳ lấy từ lịch sử thanh toán có ngày hợp lệ; {data.counts.feeKnown}/{data.counts.students} hồ sơ có học phí.</p>
            </section>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <ChartCard title="Xu hướng đăng ký học viên" hasData={data.trend.some(row => row.registrations > 0)} className="xl:col-span-2" href={studentHref}>
                <div role="img" aria-label="Xu hướng đăng ký học viên trong kỳ" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={countTooltip} /><Area type="monotone" dataKey="registrations" name="Học viên mới" stroke={colors[0]} fill="var(--finance-chart-teal-soft)" strokeWidth={2} isAnimationActive={chartMotion} /></AreaChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Trạng thái học viên" hasData={data.status.length > 0} href={studentHref}>
                <div role="img" aria-label="Số học viên theo trạng thái chính" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.status} layout="vertical" margin={{ left: 0, right: 10, top: 4, bottom: 0 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={82} tick={{ fontSize: 10 }} /><Tooltip formatter={countTooltip} /><Bar dataKey="value" name="Học viên" fill={colors[3]} maxBarSize={19} isAnimationActive={chartMotion} /></BarChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Thu học phí trong kỳ" hasData={data.trend.some(row => row.collected > 0)} className="xl:col-span-2" href={tuitionHref} kind="payroll" emptyText="Chưa có giao dịch học phí có ngày hợp lệ trong kỳ này.">
                <div role="img" aria-label="Tiền học phí đã thu theo thời gian" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tickFormatter={shortMoney} tick={{ fontSize: 10 }} width={55} /><Tooltip formatter={moneyTooltip} /><Bar dataKey="collected" name="Đã thu" fill={colors[1]} maxBarSize={34} isAnimationActive={chartMotion} /></BarChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Cơ cấu học phí" hasData={feeSplit.length > 0} kind="payroll" href={tuitionHref}>
                <div role="img" aria-label="Học phí đã đóng và còn phải thu" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={feeSplit} dataKey="value" nameKey="name" cx="50%" cy="47%" innerRadius="52%" outerRadius="75%" stroke="none" paddingAngle={2} isAnimationActive={chartMotion}>{feeSplit.map((row, index) => <Cell key={row.name} fill={index === 0 ? colors[1] : colors[2]} />)}</Pie><Tooltip formatter={moneyTooltip} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Học viên theo khóa học" hasData={data.courses.length > 0} href="/quan-ly-hoc-vien?sub=khoa-hoc">
                <div role="img" aria-label="Số học viên theo khóa học" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.courses} layout="vertical" margin={{ left: 0, right: 10, top: 4, bottom: 0 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 10 }} /><Tooltip formatter={countTooltip} /><Bar dataKey="value" name="Học viên" fill={colors[0]} maxBarSize={19} isAnimationActive={chartMotion} /></BarChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Học phí theo khóa học" hasData={data.tuitionByCourse.some(row => row.total > 0)} className="xl:col-span-2" kind="payroll" href={tuitionHref}>
                <div role="img" aria-label="Học phí đã đóng và còn phải thu theo khóa học" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.tuitionByCourse} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 0 }}><XAxis type="number" tickFormatter={shortMoney} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={105} tick={{ fontSize: 10 }} /><Tooltip formatter={moneyTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="paid" name="Đã đóng" stackId="tuition" fill={colors[1]} maxBarSize={21} isAnimationActive={chartMotion} /><Bar dataKey="outstanding" name="Còn phải thu" stackId="tuition" fill={colors[2]} maxBarSize={21} isAnimationActive={chartMotion} /></ComposedChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Nguồn học viên" hasData={data.referral.length > 0} href={studentHref}>
                <div role="img" aria-label="Cơ cấu nguồn học viên" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.referral} dataKey="value" nameKey="name" cx="50%" cy="47%" outerRadius="74%" stroke="none" isAnimationActive={chartMotion}>{data.referral.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={countTooltip} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Phương thức đóng học phí" hasData={data.paymentMethods.length > 0} kind="payroll" href={tuitionHref} emptyText="Chưa có giao dịch học phí có ngày hợp lệ trong kỳ này.">
                <div role="img" aria-label="Cơ cấu phương thức đóng học phí" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.paymentMethods} dataKey="value" nameKey="name" cx="50%" cy="47%" innerRadius="52%" outerRadius="75%" stroke="none" isAnimationActive={chartMotion}>{data.paymentMethods.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={moneyTooltip} /><Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
              </ChartCard>
              <ChartCard title="Sĩ số lớp đang mở" hasData={data.batchLoad.length > 0} href="/quan-ly-hoc-vien?sub=lop-hoc">
                <div role="img" aria-label="Sĩ số và chỉ tiêu các lớp đang mở" className="h-56 min-w-0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.batchLoad} layout="vertical" margin={{ left: 0, right: 10, top: 4, bottom: 0 }}><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} /><Tooltip formatter={countTooltip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="capacity" name="Chỉ tiêu" fill={colors[0]} maxBarSize={14} isAnimationActive={chartMotion} /><Bar dataKey="learners" name="Đã xếp" fill={colors[1]} maxBarSize={14} isAnimationActive={chartMotion} /></ComposedChart></ResponsiveContainer></div>
              </ChartCard>
            </div>
            <section className="finance-chart-card"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-balance text-sm font-semibold text-on-surface">Học phí cần thu</h3><a className="text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary" href={tuitionHref}>Mở học phí</a></div>
              {data.debts.length ? <ul className="grid grid-cols-1 gap-x-5 sm:grid-cols-2 xl:grid-cols-3">{data.debts.map((row, index) => <li key={row.id || index} className="flex min-w-0 items-center justify-between gap-2 border-b border-outline-variant py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium text-on-surface">{row.name}</p><p className="truncate text-xs text-on-surface-variant">{row.course}</p></div><strong className="finance-detail-value finance-detail-value--orange shrink-0 text-xl font-bold tabular-nums">{shortMoney(row.outstanding)}</strong></li>)}</ul> : <Empty kind="payroll">Không có học viên còn phải thu học phí.</Empty>}
            </section>
          </>}
  </div>;
}
