import './overview-dashboard.css';
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, Clock3,
  FileText, FileWarning, FolderTree, GraduationCap, Layers3, ShieldCheck, UsersRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ComponentType, ReactNode } from "react";
import type { DashboardSummary } from "../../types/dashboard";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../types/recruitment";
import { cn } from "../../modules/student-management/lib/utils";
import { HrAnalyticsPanels } from "./HrAnalyticsPanels";
import { OverviewChartSummary } from "./OverviewChartSummary";
import { OverviewChartViewport } from "./OverviewChartViewport";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import { useOverviewPeriod } from "./OverviewPeriodContext";
import { summarizeHrRecruitment } from "./hrRecruitmentOverview";
import type { DepartmentPayrollRow } from "./hrPayrollOverview";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const quickLinks: Array<{ label: string; sub: string; icon: Icon }> = [
  { label: "Sơ đồ tổ chức", sub: "so-do", icon: FolderTree },
  { label: "Đào tạo", sub: "dao-tao", icon: GraduationCap },
  { label: "Quy trình", sub: "quy-trinh", icon: Layers3 },
  { label: "Giao việc", sub: "kanban", icon: BriefcaseBusiness },
  { label: "Lịch làm việc", sub: "lich", icon: CalendarDays },
  { label: "Hợp đồng", sub: "hop-dong", icon: FileText },
  { label: "Tuyển dụng", sub: "tuyen-dung", icon: UsersRound },
];

const numberText = (value: number | null | undefined, loading = false) =>
  loading || value == null ? "—" : Math.round(value).toLocaleString("vi-VN");

function openHrTab(sub: string) {
  window.history.pushState(null, "", `/nhan-su?sub=${sub}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Card({
  children, className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`overview-panel ${className}`}>
      {children}
    </div>
  );
}

function Kpi({
  label, value, previous, note, comparisonLabel, icon: IconComponent,
}: {
  label: string;
  value: number | null | undefined;
  previous?: number | null;
  note: string;
  comparisonLabel?: string;
  icon: Icon;
}) {
  return (
    <Card className="overview-kpi flex min-h-28 min-w-0 flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 min-w-0 flex-1 text-pretty text-xs font-medium leading-4 text-white">{label}</p>
        <IconComponent className="size-4 shrink-0 text-on-primary opacity-70" aria-hidden={true} />
      </div>
      <p className="mt-1 text-lg font-semibold leading-none tabular-nums text-white sm:text-xl"><AnimatedOverviewValue value={value} format={numberText} /></p>
      {previous !== undefined ? <OverviewKpiDelta value={value} previous={previous} unit="" comparisonLabel={comparisonLabel} /> : <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 text-on-surface-variant">Số hiện tại</p>}
      <span className="sr-only">{note}</span>
    </Card>
  );
}

function PanelHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-balance text-base font-semibold text-on-surface">{title}</h2>
          {badge && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{badge}</span>}
        </div>
      </div>
    </div>
  );
}

const departmentColors = ["var(--hr-analytics-blue)", "var(--hr-analytics-teal)", "var(--hr-analytics-orange)", "var(--hr-analytics-violet)", "var(--hr-analytics-red)", "var(--hr-analytics-cyan)", "var(--hr-analytics-gold)", "var(--hr-analytics-green)"];
const pieCallout = (name: string, share: number, x: unknown, y: unknown, anchor: unknown) => <text x={Number(x)} y={Number(y)} textAnchor={anchor === "end" ? "end" : "start"} dominantBaseline="middle" fontFamily="inherit" style={{ fill: "var(--color-on-surface)", fontSize: 11, fontWeight: 400 }}>{name.length > 13 ? `${name.slice(0, 12)}…` : name} {Math.round(share * 100)}%</text>;

function HeadcountChart({ current, departments, loading, enterpriseCount, branchEmployeeCount, branchName, hasActiveBranch }: { current: number | null; departments: Array<{ name: string; value: number }> | null; loading: boolean; enterpriseCount: number | null; branchEmployeeCount: number | null; branchName: string; hasActiveBranch: boolean }) {
  const reduceMotion = useReducedMotion();
  const departmentRows = (departments ?? []).filter(row => row.value > 0).sort((a, b) => b.value - a.value);
  const rows = departmentRows.length > 3
    ? [...departmentRows.slice(0, 3), { name: "Phòng ban khác", value: departmentRows.slice(3).reduce((sum, row) => sum + row.value, 0) }]
    : departmentRows;
  const percent = (value: number) => current ? `${(value / current * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "0%";

  return <Card className="hr-analytics h-full min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-balance text-lg font-semibold text-on-surface">Quy mô nhân sự</h2><button type="button" aria-label="Xem chi tiết quy mô nhân sự" onClick={() => openHrTab("so-do")} className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</button></div>
    {loading ? <div className="h-40 rounded-md bg-surface-container-low" role="status" aria-label="Đang tải biểu đồ quy mô nhân sự" />
      : !current || !rows.length ? <p className="flex min-h-40 items-center justify-center rounded-md bg-surface-container-low px-4 text-center text-pretty text-xs text-on-surface-variant">Chưa có dữ liệu phòng ban. Mở Sơ đồ tổ chức để xem nhân sự.</p>
        : <div className="min-w-0" role="img" aria-label={`Cơ cấu nhân sự theo phòng ban, tổng ${numberText(current)} người: ${rows.map(row => `${row.name} ${numberText(row.value)} người, ${percent(row.value)}`).join("; ")}`}>
          <div className="relative h-48 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="value" nameKey="name" innerRadius={39} outerRadius={62} paddingAngle={1} stroke="none" labelLine={{ stroke: "var(--color-on-surface-variant)", strokeWidth: 1 }} label={({ name, percent: share, x, y, textAnchor }) => pieCallout(String(name), share ?? 0, x, y, textAnchor)} isAnimationActive={!reduceMotion} animationDuration={700}>{rows.map((row, index) => <Cell key={`${row.name}-${index}`} fill={departmentColors[index % departmentColors.length]} />)}</Pie><Tooltip formatter={(value) => typeof value === "number" ? `${numberText(value)} người · ${percent(value)}` : value} /></PieChart></ResponsiveContainer></OverviewChartViewport><span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><strong className="text-xl font-semibold tabular-nums text-on-surface">{numberText(current)}</strong><span className="text-xs text-on-surface-variant">nhân sự</span></span></div>
        </div>}
    <p className="mt-3 border-t border-outline-variant pt-2 text-pretty text-xs text-on-surface-variant">Tổng số nhân sự doanh nghiệp: <strong className="tabular-nums text-on-surface">{numberText(enterpriseCount, loading)}</strong>{hasActiveBranch && <> · {branchName}: <strong className="tabular-nums text-on-surface">{numberText(branchEmployeeCount, loading)}</strong></>}</p>
  </Card>;
}

function PayrollDepartmentChart({ rows, loading }: { rows: DepartmentPayrollRow[] | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const total = rows?.reduce((sum, row) => sum + row.total, 0) ?? 0;
  const topRows = rows?.slice(0, 3) ?? [];
  const pieRows = rows && rows.length > 3
    ? [...topRows, { name: "Phòng ban khác", total: rows.slice(3).reduce((sum, row) => sum + row.total, 0) }]
    : topRows;
  const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
  return <section className="overview-panel hr-analytics h-full min-w-0 space-y-3" aria-labelledby="hr-payroll-department-heading">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="hr-payroll-department-heading" className="text-balance text-lg font-semibold text-on-surface">Lương theo phòng ban</h2><button type="button" onClick={() => openHrTab("payroll")} className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</button></div>
    {loading ? <div className="h-40 rounded-md bg-surface-container-low" role="status" aria-label="Đang tải cơ cấu lương theo phòng ban" />
      : !rows ? <p role="status" className="flex min-h-40 items-center justify-center rounded-md bg-surface-container-low px-4 text-center text-pretty text-xs text-on-surface-variant">Không tải được dữ liệu lương nhân sự.</p>
        : !rows.length ? <p className="flex min-h-40 items-center justify-center rounded-md bg-surface-container-low px-4 text-center text-pretty text-xs text-on-surface-variant">Chưa có nhân sự để thống kê lương.</p>
          : <div role="img" aria-label={`Cơ cấu quỹ lương theo phòng ban: ${rows.map(row => `${row.name} ${money(row.total)}`).join("; ")}`}>
              {total > 0 ? <div className="h-48 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieRows.filter(row => row.total > 0)} dataKey="total" nameKey="name" innerRadius={39} outerRadius={62} stroke="none" labelLine={{ stroke: "var(--color-on-surface-variant)", strokeWidth: 1 }} label={({ name, percent: share, x, y, textAnchor }) => pieCallout(String(name), share ?? 0, x, y, textAnchor)} isAnimationActive={!reduceMotion} animationDuration={700}>{pieRows.filter(row => row.total > 0).map((row, index) => <Cell key={row.name} fill={departmentColors[index % departmentColors.length]} />)}</Pie><Tooltip formatter={(value) => typeof value === "number" ? money(value) : value} /></PieChart></ResponsiveContainer></OverviewChartViewport></div>
                : <p className="rounded-md bg-surface-container-low px-3 py-4 text-center text-pretty text-xs text-on-surface-variant">Chưa có mức lương được cập nhật.</p>}
            </div>}
  </section>;
}

function AveragePayrollChart({ rows, loading }: { rows: DepartmentPayrollRow[] | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const averageRows = [...(rows ?? [])].sort((a, b) => b.average - a.average);
  const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
  const axisMoney = (value: number) => value ? `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : "0";
  return <section className="overview-panel hr-analytics min-w-0 space-y-3" aria-labelledby="hr-average-payroll-heading">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="hr-average-payroll-heading" className="text-balance text-lg font-semibold text-on-surface">Lương bình quân theo phòng ban</h2><button type="button" onClick={() => openHrTab("payroll")} className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</button></div>
    {loading ? <div className="h-40 rounded-md bg-surface-container-low" role="status" aria-label="Đang tải lương bình quân theo phòng ban" />
      : !rows ? <p role="status" className="rounded-md bg-surface-container-low px-4 py-8 text-center text-pretty text-xs text-on-surface-variant">Không tải được dữ liệu lương nhân sự.</p>
        : !rows.length ? <p className="rounded-md bg-surface-container-low px-4 py-8 text-center text-pretty text-xs text-on-surface-variant">Chưa có nhân sự để thống kê lương.</p>
          : <div tabIndex={averageRows.length > 3 ? 0 : undefined} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary" role="img" aria-label={`Lương bình quân theo phòng ban, chưa cập nhật lương tính 0 đồng: ${averageRows.map(row => `${row.name} ${money(row.average)} trên ${row.count} nhân sự`).join("; ")}`}>
            <div className="h-64 w-full" style={{ minWidth: Math.max(320, averageRows.length * 96) }}><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={averageRows} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={52} tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }} tickFormatter={(name: string) => name.length > 12 ? `${name.slice(0, 11)}…` : name} /><YAxis axisLine={false} tickLine={false} width={54} tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }} tickFormatter={axisMoney} /><Tooltip formatter={(value) => typeof value === "number" ? money(value) : value} cursor={false} /><Bar dataKey="average" name="Lương bình quân" fill="var(--hr-analytics-teal)" maxBarSize={38} isAnimationActive={!reduceMotion} animationDuration={700} /></BarChart></ResponsiveContainer></OverviewChartViewport></div>
          </div>}
  </section>;
}

function TaskChart({ summary, previous, loading }: { summary: DashboardSummary | null; previous: DashboardSummary | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const tasks = summary?.projects.tasks;
  const total = tasks?.total ?? 0;
  const segments = [
    { label: "Hoàn thành", count: tasks?.done ?? 0, color: "#18B777", dot: "bg-emerald-500" },
    { label: "Đang thực hiện", count: tasks?.doing ?? 0, color: "#00ADFC", dot: "bg-sky-500" },
    { label: "Chưa bắt đầu", count: tasks?.todo ?? 0, color: "#9FB0C4", dot: "bg-slate-400" },
  ];
  const radius = 67;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = total ? (segment.count / total) * circumference : 0;
    const arc = { ...segment, length, offset };
    offset += length;
    return arc;
  });
  const completedPercent = total ? Math.round((segments[0].count / total) * 100) : 0;

  return (
    <Card className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <PanelHeader title="Tiến độ công việc" badge={`${numberText(total, loading)} việc`} />
      <OverviewChartSummary value={loading ? null : tasks?.total} previous={previous?.projects.tasks.total} metricLabel="Công việc trong kỳ" onDetails={() => openHrTab("kanban")} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5 sm:flex-row sm:gap-7">
        <div
          className="relative h-44 w-44 shrink-0"
          role="img"
          aria-label={loading || !summary ? "Đang tải biểu đồ công việc" : `Công việc: ${segments.map((item) => `${item.label} ${item.count}`).join(", ")}`}
        >
          <OverviewChartViewport><motion.div className="h-full w-full"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, ease: "easeOut" }}><svg viewBox="0 0 176 176" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="88" cy="88" r={radius} fill="none" stroke="var(--color-outline-variant)" strokeWidth="15" />
            {arcs.map((arc) => arc.length > 0 && (
              <motion.circle key={arc.label} cx="88" cy="88" r={radius} fill="none" stroke={arc.color} strokeWidth="15" strokeLinecap="round"
                initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                strokeDasharray={`${Math.max(0, arc.length - 4)} ${circumference}`}
                strokeDashoffset={-arc.offset} />
            ))}
          </svg></motion.div></OverviewChartViewport>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-semibold tabular-nums text-on-surface">{loading || !summary ? "—" : total ? `${completedPercent}%` : "0"}</span>
            <span className="mt-1 text-xs text-on-surface-variant">{total ? "hoàn thành" : "chưa có việc"}</span>
          </div>
        </div>
        <div className="w-full max-w-72 divide-y divide-outline-variant">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-on-surface-variant"><span className={`size-2.5 rounded-full ${segment.dot}`} />{segment.label}</span>
              <span className="font-semibold tabular-nums text-on-surface">{numberText(segment.count, loading)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-on-surface-variant"><span className="size-2.5 rounded-full bg-error" />Quá hạn</span>
            <span className="font-semibold tabular-nums text-rose-600">{numberText(summary?.projects.overdueTasks, loading)}</span>
          </div>
        </div>
      </div>
      {total === 0 && !loading && <p className="rounded-md bg-surface-container-low px-3 py-2.5 text-center text-pretty text-xs text-on-surface-variant">Tạo công việc trong mục Giao việc để theo dõi tiến độ tại đây.</p>}
    </Card>
  );
}

function TrainingChart({ summary, previous, loading }: { summary: DashboardSummary | null; previous: DashboardSummary | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const enrollments = summary?.training.enrollments;
  const total = enrollments?.total ?? 0;
  const rows = [
    { label: "Đang học", count: enrollments?.inProgress ?? 0, bar: "bg-primary", text: "text-primary" },
    { label: "Đã hoàn thành", count: enrollments?.completed ?? 0, bar: "bg-emerald-500", text: "text-emerald-600" },
    { label: "Chưa bắt đầu", count: enrollments?.notStarted ?? 0, bar: "bg-violet-500", text: "text-violet-600" },
  ];

  return (
    <Card className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <PanelHeader title="Đào tạo nội bộ" badge={`${numberText(summary?.training.totalCourses, loading)} khóa`} />
      <OverviewChartSummary value={loading ? null : enrollments?.total} previous={previous?.training.enrollments.total} metricLabel="Lượt tham gia đào tạo trong kỳ" onDetails={() => openHrTab("dao-tao")} />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-primary/10 px-4 py-3.5">
          <p className="text-xs text-on-surface-variant">Khóa đang diễn ra</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-primary">{numberText(summary?.training.ongoingCourses, loading)}</p>
        </div>
        <div className="rounded-md bg-tertiary/10 px-4 py-3.5">
          <p className="text-xs text-tertiary">Lượt học hoàn thành</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-tertiary">{numberText(enrollments?.completed, loading)}</p>
        </div>
      </div>
      <div className="mt-6 flex-1 space-y-5">
        {rows.map((row, index) => {
          const percent = total ? Math.min(100, row.count / total * 100) : 0;
          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-on-surface-variant">{row.label}</span>
                <span className={`font-semibold tabular-nums ${row.text}`}>{numberText(row.count, loading)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-low" role="img" aria-label={`${row.label}: ${numberText(row.count, loading)} trên ${numberText(total, loading)} lượt học`}>
                <OverviewChartViewport><motion.div
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.65, delay: 0.3 + index * 0.1 }}
                  className={`h-full rounded-full ${row.bar}`}
                  style={{ width: `${percent}%`, transformOrigin: "left" }}
                /></OverviewChartViewport>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 rounded-md bg-surface-container-low px-3 py-2.5 text-center text-pretty text-xs text-on-surface-variant">
        {total ? `Tổng ${numberText(total)} lượt tham gia đào tạo` : "Chưa có lượt tham gia đào tạo."}
      </p>
    </Card>
  );
}

function Attendance({ summary, yesterdayAttendance, loading }: { summary: DashboardSummary | null; yesterdayAttendance: { checkedIn: number; late: number; total: number } | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const attendance = summary?.timekeeping;
  const total = attendance?.totalEmployees ?? 0;
  const checkedIn = attendance?.checkedInToday ?? 0;
  const percent = total ? Math.min(100, Math.round(checkedIn / total * 100)) : 0;
  return (
    <Card className="p-5 sm:p-6">
      <PanelHeader title="Chấm công hôm nay" />
      <OverviewChartSummary value={loading ? null : checkedIn} previous={yesterdayAttendance?.checkedIn} metricLabel="Nhân sự đã chấm công hôm nay" onDetails={() => openHrTab("lich")} />
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Đã chấm công", count: checkedIn, tone: "bg-primary/10 text-primary" },
          { label: "Đi muộn", count: attendance?.lateToday, tone: "bg-tertiary/10 text-tertiary" },
          { label: "Nghỉ phép", count: attendance?.onApprovedLeaveToday, tone: "bg-secondary-container text-on-secondary-container" },
          { label: "Chưa chấm công", count: attendance?.absentWithoutLeave, tone: "bg-error/10 text-error" },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl px-4 py-3 ${item.tone}`}>
            <p className="text-xs">{item.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{numberText(item.count, loading)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-on-surface-variant"><span>Tỷ lệ đã chấm công</span><span className="font-medium text-primary">{loading || !summary ? "—" : `${percent}%`}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-low" role="img" aria-label={`Tỷ lệ chấm công: ${percent}%`}><OverviewChartViewport><motion.div initial={reduceMotion ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.65, ease: "easeOut" }} className="h-full rounded-full bg-primary" style={{ width: `${percent}%`, transformOrigin: "left" }} /></OverviewChartViewport></div>
    </Card>
  );
}

export function HrOverviewDashboard({
  summary, previousSummary, yesterdayAttendance, employeeCount, employeeScope, enterpriseCount, branchEmployeeCount, hasActiveBranch, loading, error, canSeeTimekeeping, canSeeRecruitment, applicants, jobs, pipeline, payrollRows,
}: {
  summary: DashboardSummary | null;
  previousSummary: DashboardSummary | null;
  yesterdayAttendance: { checkedIn: number; late: number; total: number } | null;
  employeeCount: number | null;
  employeeScope: string;
  enterpriseCount: number | null;
  branchEmployeeCount: number | null;
  hasActiveBranch: boolean;
  loading: boolean;
  error: boolean;
  canSeeTimekeeping: boolean;
  canSeeRecruitment: boolean;
  applicants: RecruitmentApplicant[] | null;
  jobs: RecruitmentJob[] | null;
  pipeline: RecruitmentPipeline | null;
  payrollRows?: DepartmentPayrollRow[] | null;
}) {
  const reduceMotion = useReducedMotion();
  const overviewPeriod = useOverviewPeriod();
  const previousEmployeeCount = previousSummary?.timekeeping.employeesExistingAtRangeEnd
    ?? (previousSummary?.personnelNow?.departmentHeadcounts.length ? previousSummary.personnelNow.departmentHeadcounts.reduce((sum, row) => sum + row.value, 0) : null);
  const recruitment = summarizeHrRecruitment(jobs, applicants, overviewPeriod);
  const personnel = summary?.personnelNow;
  const contractCovered = personnel?.activeContractEmployeeCount ?? 0;
  const contractMissing = personnel?.withoutContractCount ?? 0;
  const contractTotal = contractCovered + contractMissing;
  const contractCoverage = contractTotal ? contractMissing === 0 ? 100 : Math.floor(contractCovered / contractTotal * 1000) / 10 : 0;
  const contractRows = [{ name: "Có hợp đồng hiệu lực", value: contractCovered, color: "var(--hr-analytics-teal)" }, { name: "Chưa có hợp đồng hiệu lực", value: contractMissing, color: "var(--hr-analytics-orange)" }];
  const recruitmentRows = recruitment.departmentRows;
  return (
    <div className="space-y-3 pb-5">
      {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Không tải được số liệu nhân sự. Vui lòng thử lại sau.</div>}
      <section className="overview-panel space-y-3" aria-label="Tình hình nhân sự">
      <h3 className="text-balance text-lg font-semibold text-on-surface">Tình hình nhân sự</h3>
      <div className="hr-overview-metrics grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Nhân sự" value={employeeCount} previous={previousEmployeeCount} note={`${employeeScope}. So sánh theo tài khoản còn tồn tại và ngày tạo; không bao gồm tài khoản đã xóa.`} icon={UsersRound} />
        <Kpi label="Đã chấm công" value={canSeeTimekeeping ? summary?.timekeeping.checkedInToday : null} previous={canSeeTimekeeping ? yesterdayAttendance?.checkedIn ?? null : null} note="Hôm nay so với hôm qua, không theo bộ lọc kỳ" comparisonLabel="hôm qua" icon={CalendarDays} />
        <Kpi label="Công việc" value={loading ? null : summary?.projects.tasks.total} previous={previousSummary?.projects.tasks.total ?? null} note="Công việc trong kỳ" icon={BriefcaseBusiness} />
        <Kpi label="Khóa đào tạo" value={loading ? null : summary?.training.totalCourses} previous={previousSummary?.training.totalCourses ?? null} note="Khóa trong kỳ" icon={GraduationCap} />
        <Kpi label="Đi muộn" value={canSeeTimekeeping ? summary?.timekeeping.lateToday : null} previous={canSeeTimekeeping ? yesterdayAttendance?.late ?? null : null} note="Hôm nay so với hôm qua, không theo bộ lọc kỳ" comparisonLabel="hôm qua" icon={Clock3} />
        {canSeeRecruitment && overviewPeriod ? <Kpi label="Ứng viên mới" value={loading ? null : recruitment.currentApplicantCount} previous={recruitment.previousApplicantCount} note="Hồ sơ trong kỳ" icon={FileText} /> : <Kpi label="HĐ sắp hết hạn" value={loading ? null : summary?.personnelNow?.expiringContractCount} note="Trong 30 ngày tới" icon={FileWarning} />}
      </div>
      <p className="text-pretty text-xs text-on-surface-variant">Số nhân sự chỉ tính tài khoản còn tồn tại. Chấm công và đi muộn hiển thị số hôm nay, so sánh với hôm qua.</p>
      </section>
      <div className={cn("grid items-stretch gap-3", payrollRows !== undefined || canSeeRecruitment ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      <HeadcountChart current={employeeCount} departments={summary?.personnelNow?.departmentHeadcounts ?? null} loading={loading} enterpriseCount={enterpriseCount} branchEmployeeCount={branchEmployeeCount} branchName={employeeScope} hasActiveBranch={hasActiveBranch} />
      <section className="overview-panel hr-analytics min-w-0 space-y-3" aria-labelledby="hr-contract-summary-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="hr-contract-summary-heading" className="text-balance text-lg font-semibold text-on-surface">Tình hình hợp đồng</h2>
          <button type="button" aria-label="Xem chi tiết tình hình hợp đồng" onClick={() => openHrTab("hop-dong")} className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</button>
        </div>
        {loading ? <div className="h-40 rounded-md bg-surface-container-low" role="status" aria-label="Đang tải biểu đồ hợp đồng" />
          : !personnel || !contractTotal ? <p className="flex min-h-40 items-center justify-center rounded-md bg-surface-container-low px-4 text-center text-pretty text-xs text-on-surface-variant">Chưa có dữ liệu hợp đồng. Mở Chi tiết để kiểm tra.</p>
            : <div className="min-w-0" role="img" aria-label={`Tỷ lệ có hợp đồng hiệu lực ${contractCoverage}%. ${contractRows.map(row => `${row.name}: ${numberText(row.value)} người`).join("; ")}`}>
              <div className="relative h-48 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contractRows.filter(row => row.value > 0)} dataKey="value" nameKey="name" innerRadius={39} outerRadius={62} stroke="none" labelLine={{ stroke: "var(--color-on-surface-variant)", strokeWidth: 1 }} label={({ name, percent: share, x, y, textAnchor }) => pieCallout(String(name).startsWith("Có") ? "Có HĐ" : "Chưa HĐ", share ?? 0, x, y, textAnchor)} isAnimationActive={!reduceMotion} animationDuration={700}>{contractRows.filter(row => row.value > 0).map(row => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip formatter={(value) => typeof value === "number" ? `${numberText(value)} người` : value} /></PieChart></ResponsiveContainer></OverviewChartViewport><span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><strong className="text-xl font-semibold tabular-nums text-on-surface">{contractCoverage}%</strong><span className="text-xs text-on-surface-variant">có hợp đồng</span></span></div>
            </div>}
        {!loading && personnel && <p className="border-t border-outline-variant pt-2 text-pretty text-xs tabular-nums text-on-surface-variant">Sắp hết hạn: {numberText(personnel.expiringContractCount)} · Gia hạn trong kỳ: {numberText(personnel.renewedEmployeeCount)}</p>}
      </section>
      {payrollRows !== undefined && <PayrollDepartmentChart rows={payrollRows} loading={loading} />}
      {canSeeRecruitment && <section className="overview-panel min-w-0 space-y-3" aria-labelledby="hr-recruitment-summary-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="hr-recruitment-summary-heading" className="text-balance text-lg font-semibold text-on-surface">Tình hình tuyển dụng</h2>
          <button type="button" aria-label="Xem chi tiết tình hình tuyển dụng" onClick={() => openHrTab("tuyen-dung")} className="text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">Chi tiết</button>
        </div>
        <p className="text-pretty text-xs tabular-nums text-on-surface-variant">{numberText(recruitment.openJobCount, loading || jobs == null)} vị trí · {numberText(recruitment.openHeadcount, loading || jobs == null)} cần tuyển · {numberText(recruitment.currentApplicantCount, loading)} ứng viên trong kỳ</p>
        {loading ? <div className="h-40 rounded-md bg-surface-container-low" role="status" aria-label="Đang tải biểu đồ tuyển dụng" />
          : jobs == null || !recruitmentRows.length ? <p className="flex min-h-40 items-center justify-center rounded-md bg-surface-container-low px-4 text-center text-pretty text-xs text-on-surface-variant">{jobs == null ? "Chưa tải được dữ liệu tuyển dụng." : "Chưa có vị trí đang mở. Mở Chi tiết để tạo vị trí mới."}</p>
            : <div tabIndex={recruitmentRows.length > 3 ? 0 : undefined} role="img" aria-label={`Chỉ tiêu tuyển dụng theo phòng ban: ${recruitmentRows.map(row => `${row.name} cần ${numberText(row.headcount)} người`).join("; ")}`} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary">
              <div className="h-52 w-full" style={{ minWidth: Math.max(280, recruitmentRows.length * 96) }}><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={recruitmentRows} margin={{ top: 18, right: 8, bottom: 4, left: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={46} tick={{ fontSize: 10, fill: "var(--color-on-surface-variant)" }} tickFormatter={(name: string) => name.length > 12 ? `${name.slice(0, 11)}…` : name} /><YAxis axisLine={false} tickLine={false} width={28} allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-on-surface-variant)" }} /><Tooltip formatter={(value) => typeof value === "number" ? `${numberText(value)} người` : value} cursor={false} /><Bar dataKey="headcount" name="Chỉ tiêu tuyển" fill="var(--color-primary)" maxBarSize={40} isAnimationActive={!reduceMotion} animationDuration={700}><LabelList dataKey="headcount" position="top" fill="var(--color-on-surface)" fontSize={11} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div>
            </div>}
      </section>}
        <TaskChart summary={summary} previous={previousSummary} loading={loading} />
        <TrainingChart summary={summary} previous={previousSummary} loading={loading} />
      </div>
      {payrollRows !== undefined && <AveragePayrollChart rows={payrollRows} loading={loading} />}
      {canSeeTimekeeping && <Attendance summary={summary} yesterdayAttendance={yesterdayAttendance} loading={loading && !summary} />}
      <HrAnalyticsPanels summary={summary} yesterdayAttendance={yesterdayAttendance} applicants={applicants} jobs={jobs} pipeline={pipeline} loading={loading} canSeeTimekeeping={canSeeTimekeeping} canSeeRecruitment={canSeeRecruitment} />
      <section aria-labelledby="hr-quick-links-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 id="hr-quick-links-heading" className="text-balance text-base font-semibold text-on-surface">Truy cập nhanh</h2>
          {!canSeeTimekeeping && <span className="flex items-center gap-1.5 text-xs text-on-surface-variant"><ShieldCheck aria-hidden="true" className="size-3.5" /> Chấm công cần quyền xem riêng</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.filter((link) => link.sub !== "tuyen-dung" || canSeeRecruitment).map(({ label, sub, icon: IconComponent }) => (
            <Card key={sub}>
              <button type="button" onClick={() => openHrTab(sub)} className="group flex w-full items-center gap-3 rounded-md px-4 py-3.5 text-left hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/15"><IconComponent aria-hidden={true} className="size-4.5" /></span>
                <span className="min-w-0 flex-1 text-sm font-medium text-on-surface">{label}</span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
              </button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
