import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { DashboardSummary } from "../../types/dashboard";
import type { HrDepartment } from "../../services/hrDepartmentService";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../types/recruitment";
import { OverviewChartSummary } from "./OverviewChartSummary";
import { OverviewChartViewport } from "./OverviewChartViewport";
import "./hr-analytics.css";

type Props = {
  summary: DashboardSummary | null;
  yesterdayAttendance: { checkedIn: number; late: number; total: number } | null;
  departments: HrDepartment[] | null;
  applicants: RecruitmentApplicant[] | null;
  jobs: RecruitmentJob[] | null;
  pipeline: RecruitmentPipeline | null;
  loading: boolean;
  canSeeTimekeeping: boolean;
  canSeeRecruitment: boolean;
};
const colors = ["var(--hr-analytics-blue)", "var(--hr-analytics-teal)", "var(--hr-analytics-orange)", "var(--hr-analytics-violet)", "var(--hr-analytics-red)", "var(--hr-analytics-cyan)", "var(--hr-analytics-gold)", "var(--hr-analytics-green)"];
const integer = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("vi-VN");
const tooltipValue = (value: number | string | undefined) => typeof value === "number" ? integer(value) : value ?? "—";

function openHrTab(sub: string) {
  window.history.pushState(null, "", `/nhan-su?sub=${sub}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function ChartPanel({ title, sub, empty, children, value, previous }: { title: string; sub?: string; empty: boolean; children: ReactNode; value: number | null | undefined; previous?: number | null }) {
  return <section className="hr-analytics-panel">
    <h3 className="mb-2 text-balance text-sm font-semibold text-on-surface">{title}</h3>
    <OverviewChartSummary value={value} previous={previous} metricLabel={title} onDetails={sub ? () => openHrTab(sub) : undefined} />
    {empty ? <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md bg-surface-container-low px-4 text-center text-xs text-on-surface-variant"><span>Chưa có dữ liệu để hiển thị.</span>{sub && <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => openHrTab(sub)}>Mở {title}</button>}</div> : children}
  </section>;
}

function Donut({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const reduceMotion = useReducedMotion();
  const visible = rows.filter(row => row.value > 0);
  return <div className="grid min-h-48 grid-cols-1 items-center gap-2 sm:grid-cols-[48%_1fr]" role="img" aria-label={`${label}: ${rows.map(row => `${row.name} ${integer(row.value)}`).join(", ")}`}>
    <div className="relative h-44 min-w-0"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={visible} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="80%" paddingAngle={2} stroke="none" isAnimationActive={!reduceMotion} animationDuration={700}>{visible.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={tooltipValue} /></PieChart></ResponsiveContainer></OverviewChartViewport><span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-on-surface">{integer(rows.reduce((sum, row) => sum + row.value, 0))}</span></div>
    <ul className="space-y-2 text-xs">{rows.map((row, index) => <li key={row.name} className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-on-surface-variant"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="truncate" title={row.name}>{row.name}</span></span><strong className="tabular-nums text-on-surface">{integer(row.value)}</strong></li>)}</ul>
  </div>;
}

function HorizontalChart({ rows, label }: { rows: { name: string; value: number }[]; label: string }) {
  const reduceMotion = useReducedMotion();
  return <div className="h-60 min-w-0" role="img" aria-label={`${label}: ${rows.map(row => `${row.name} ${row.value}`).join(", ")}`}><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{ left: 0, right: 52, top: 4, bottom: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" horizontal={false} /><XAxis axisLine={false} tickLine={false} type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={106} tick={{ fontSize: 10 }} tickFormatter={(name: string) => name.length > 16 ? `${name.slice(0, 15)}…` : name} /><Tooltip formatter={tooltipValue} cursor={false} /><Bar dataKey="value" name={label} fill={colors[0]} maxBarSize={20} isAnimationActive={!reduceMotion} animationDuration={700}>{rows.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}<LabelList dataKey="value" position="right" fill="var(--color-on-surface-variant)" fontSize={11} formatter={(value: unknown) => typeof value === "number" && value > 0 ? integer(value) : ""} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div>;
}

export function HrAnalyticsPanels({ summary, yesterdayAttendance, departments, applicants, jobs, pipeline, loading, canSeeTimekeeping, canSeeRecruitment }: Props) {
  const reduceMotion = useReducedMotion();
  if (loading) return <div className="hr-analytics grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Đang tải biểu đồ nhân sự">{Array.from({ length: canSeeRecruitment ? 7 : 3 }, (_, index) => <div key={index} className="hr-analytics-panel"><div className="h-4 w-1/2 rounded bg-surface-container-low" /><div className="mt-4 h-40 rounded bg-surface-container-low" /></div>)}</div>;
  const attendance = summary?.timekeeping;
  const personnel = summary?.personnelNow;
  const totalEmployees = attendance?.totalEmployees ?? 0;
  const attendanceRate = totalEmployees ? Math.min(100, Math.round((attendance?.checkedInToday ?? 0) / totalEmployees * 100)) : 0;
  const departmentRows = (departments ?? []).filter(row => row.employeeCount > 0).sort((a, b) => b.employeeCount - a.employeeCount).slice(0, 7).map(row => ({ name: row.name, value: row.employeeCount }));
  const applicantRows = applicants ?? [];
  const stageRows = (pipeline?.stages ?? []).filter(stage => stage.isActive).sort((a, b) => a.position - b.position).map(stage => ({ name: stage.name, value: applicantRows.filter(row => row.stageId === stage.id).length })).filter(row => row.value > 0);
  const sourceCounts = new Map<string, number>();
  for (const applicant of applicantRows) { const source = applicant.source?.trim() || "Chưa rõ"; sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1); }
  const sortedSources = [...sourceCounts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const sourceRows = sortedSources.length > 5 ? [...sortedSources.slice(0, 4), { name: "Nguồn khác", value: sortedSources.slice(4).reduce((sum, row) => sum + row.value, 0) }] : sortedSources;
  const now = new Date();
  const monthlyRows = Array.from({ length: 6 }, (_, index) => { const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1); const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`; return { name: `T${month.getMonth() + 1}/${String(month.getFullYear()).slice(2)}`, value: applicantRows.filter(row => row.createdAt?.startsWith(key)).length }; });
  const openJobs = (jobs ?? []).filter(job => job.status === "open");

  return <div className="hr-analytics grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
    {canSeeTimekeeping && <ChartPanel title="Chấm công hôm nay" sub="lich" value={attendance?.checkedInToday} previous={yesterdayAttendance?.checkedIn} empty={!loading && !totalEmployees}>
      <div className="grid min-h-48 grid-cols-[auto_1fr] items-center gap-4" role="img" aria-label={`Đã chấm công ${integer(attendance?.checkedInToday)} trên ${integer(totalEmployees)} nhân sự, ${attendanceRate}%`}><div className="hr-analytics-gauge" style={{ background: `conic-gradient(var(--hr-analytics-blue) ${attendanceRate}%, var(--color-outline-variant) 0)` }}><div><strong className="text-2xl tabular-nums text-on-surface">{loading ? "—" : `${attendanceRate}%`}</strong><span className="text-xs text-on-surface-variant">đã chấm công</span></div></div><ul className="space-y-2 text-xs">{[
        ["Đã chấm công", attendance?.checkedInToday, colors[0]], ["Nghỉ phép đã duyệt", attendance?.onApprovedLeaveToday, colors[1]], ["Chưa chấm công", attendance?.absentWithoutLeave, colors[2]], ["Đi muộn", attendance?.lateToday, colors[4]],
      ].map(([name, value, color]) => <li key={String(name)} className="flex justify-between gap-2"><span className="flex items-center gap-2 text-on-surface-variant"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: String(color) }} />{name}</span><strong className="tabular-nums text-on-surface">{loading ? "—" : integer(value as number | undefined)}</strong></li>)}</ul></div>
    </ChartPanel>}
    {departments !== null && <ChartPanel title="Nhân sự theo phòng ban" sub="so-do" value={departmentRows.reduce((sum, row) => sum + row.value, 0)} empty={!departmentRows.length}><HorizontalChart rows={departmentRows} label="Nhân sự" /></ChartPanel>}
    <ChartPanel title="Việc cần chú ý" sub="hop-dong" value={summary?.projects.overdueTasks} empty={false}>
      <dl className="grid grid-cols-2 gap-2"><div className="hr-analytics-stat"><dt>Hợp đồng ≤ 30 ngày</dt><dd>{loading ? "—" : integer(personnel?.expiringContractCount)}</dd></div><div className="hr-analytics-stat"><dt>Đơn chờ duyệt</dt><dd>{loading ? "—" : integer(personnel?.pendingApprovalCount)}</dd></div><div className="hr-analytics-stat"><dt>Việc chờ xử lý</dt><dd>{loading ? "—" : integer(personnel?.pendingTaskCount)}</dd></div><div className="hr-analytics-stat"><dt>Việc quá hạn</dt><dd>{loading ? "—" : integer(summary?.projects.overdueTasks)}</dd></div></dl>
      {!!personnel?.expiringContracts.length && <ul className="mt-3 divide-y divide-outline-variant text-xs">{personnel.expiringContracts.slice(0, 3).map(row => <li key={row.id} className="flex justify-between gap-2 py-1.5"><span className="truncate text-on-surface" title={row.employeeName}>{row.employeeName}</span><span className="shrink-0 tabular-nums text-on-surface-variant">{new Date(row.endDate).toLocaleDateString("vi-VN")}</span></li>)}</ul>}
    </ChartPanel>
    {canSeeRecruitment && <>
      {applicants !== null && pipeline !== null && <ChartPanel title="Ứng viên theo giai đoạn" sub="tuyen-dung" value={stageRows.reduce((sum, row) => sum + row.value, 0)} empty={!stageRows.length}><HorizontalChart rows={stageRows} label="Ứng viên" /></ChartPanel>}
      {applicants !== null && <><ChartPanel title="Ứng viên mới 6 tháng" sub="tuyen-dung" value={monthlyRows[5]?.value} previous={monthlyRows[4]?.value} empty={!monthlyRows.some(row => row.value)}><div className="h-60 min-w-0" role="img" aria-label={monthlyRows.map(row => `${row.name} ${row.value}`).join(", ")}><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><LineChart data={monthlyRows} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="name" tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={tooltipValue} cursor={false} /><Line type="monotone" dataKey="value" name="Ứng viên mới" stroke={colors[0]} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={!reduceMotion} animationDuration={700} /></LineChart></ResponsiveContainer></OverviewChartViewport></div></ChartPanel><ChartPanel title="Nguồn ứng viên" sub="tuyen-dung" value={sourceRows.reduce((sum, row) => sum + row.value, 0)} empty={!sourceRows.length}><Donut rows={sourceRows} label="Nguồn ứng viên" /></ChartPanel></>}
      {jobs !== null && applicants !== null && <ChartPanel title="Nhu cầu tuyển dụng" sub="tuyen-dung" value={openJobs.reduce((sum, job) => sum + job.headcount, 0)} empty={false}><dl className="grid grid-cols-2 gap-2"><div className="hr-analytics-stat"><dt>Vị trí đang mở</dt><dd>{integer(openJobs.length)}</dd></div><div className="hr-analytics-stat"><dt>Chỉ tiêu tuyển</dt><dd>{integer(openJobs.reduce((sum, job) => sum + job.headcount, 0))}</dd></div><div className="hr-analytics-stat"><dt>Tổng hồ sơ</dt><dd>{integer(applicants.length)}</dd></div><div className="hr-analytics-stat"><dt>Đã tuyển</dt><dd>{integer(applicants.filter(row => row.outcome === "hired").length)}</dd></div></dl></ChartPanel>}
    </>}
  </div>;
}
