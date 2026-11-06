import './overview-dashboard.css';
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, Clock3,
  FileText, FileWarning, FolderTree, GraduationCap, Layers3, ShieldCheck, UsersRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import type { DashboardSummary } from "../../types/dashboard";
import type { HrDepartment } from "../../services/hrDepartmentService";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../types/recruitment";
import { HrAnalyticsPanels } from "./HrAnalyticsPanels";
import { OverviewChartSummary } from "./OverviewChartSummary";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import { useOverviewPeriod } from "./OverviewPeriodContext";
import { overviewDateKey } from "./overviewComparison";

type Icon = ComponentType<{ className?: string }>;

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
  label, value, previous, note, icon: IconComponent,
}: {
  label: string;
  value: number | null | undefined;
  previous?: number | null;
  note: string;
  icon: Icon;
}) {
  return (
    <Card className="overview-kpi flex min-w-0 flex-col px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white/15 text-white"><IconComponent className="size-5" /></span>
        <div className="min-w-0">
          <p className="line-clamp-2 min-h-8 text-pretty text-xs font-medium leading-4 text-white">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-none tabular-nums text-white"><AnimatedOverviewValue value={value} format={numberText} /></p>
        </div>
      </div>
      {previous !== undefined && <OverviewKpiDelta value={value} previous={previous} unit="" />}
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
          <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="88" cy="88" r={radius} fill="none" stroke="var(--color-outline-variant)" strokeWidth="15" />
            {arcs.map((arc) => arc.length > 0 && (
              <motion.circle key={arc.label} cx="88" cy="88" r={radius} fill="none" stroke={arc.color} strokeWidth="15" strokeLinecap="round"
                initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
                strokeDasharray={`${Math.max(0, arc.length - 4)} ${circumference}`}
                strokeDashoffset={-arc.offset} />
            ))}
          </svg>
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
                <motion.div
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.65, delay: 0.3 + index * 0.1 }}
                  className={`h-full rounded-full ${row.bar}`}
                  style={{ width: `${percent}%`, transformOrigin: "left" }}
                />
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
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-low" role="img" aria-label={`Tỷ lệ chấm công: ${percent}%`}><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
    </Card>
  );
}

export function HrOverviewDashboard({
  summary, previousSummary, yesterdayAttendance, employeeCount, employeeScope, loading, error, canSeeTimekeeping, canSeeRecruitment, departments, applicants, jobs, pipeline,
}: {
  summary: DashboardSummary | null;
  previousSummary: DashboardSummary | null;
  yesterdayAttendance: { checkedIn: number; late: number; total: number } | null;
  employeeCount: number | null;
  employeeScope: string;
  loading: boolean;
  error: boolean;
  canSeeTimekeeping: boolean;
  canSeeRecruitment: boolean;
  departments: HrDepartment[] | null;
  applicants: RecruitmentApplicant[] | null;
  jobs: RecruitmentJob[] | null;
  pipeline: RecruitmentPipeline | null;
}) {
  const overviewPeriod = useOverviewPeriod();
  const applicantCount = (from: string, to: string) => applicants?.filter(applicant => {
    const date = overviewDateKey(applicant.createdAt);
    return date != null && date >= from && date <= to;
  }).length ?? null;
  const currentApplicants = overviewPeriod ? applicantCount(overviewPeriod.from, overviewPeriod.to) : null;
  const previousApplicants = overviewPeriod ? applicantCount(overviewPeriod.previousFrom, overviewPeriod.previousTo) : null;
  return (
    <div className="space-y-4 pb-5">
      {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Không tải được số liệu nhân sự. Bấm Làm mới để thử lại.</div>}
      <div className="hr-overview-metrics grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Nhân sự" value={employeeCount} note={employeeScope} icon={UsersRound} />
        <Kpi label="Đã chấm công" value={canSeeTimekeeping && !loading ? summary?.timekeeping.checkedInToday : null} note="Hôm nay" icon={CalendarDays} />
        <Kpi label="Công việc" value={loading ? null : summary?.projects.tasks.total} previous={previousSummary?.projects.tasks.total ?? null} note="Công việc trong kỳ" icon={BriefcaseBusiness} />
        <Kpi label="Khóa đào tạo" value={loading ? null : summary?.training.totalCourses} previous={previousSummary?.training.totalCourses ?? null} note="Khóa trong kỳ" icon={GraduationCap} />
        <Kpi label="Đi muộn" value={canSeeTimekeeping && !loading ? summary?.timekeeping.lateToday : null} note="Ghi nhận trong ngày" icon={Clock3} />
        {canSeeRecruitment && overviewPeriod ? <Kpi label="Ứng viên mới" value={loading ? null : currentApplicants} previous={previousApplicants} note="Hồ sơ trong kỳ" icon={FileText} /> : <Kpi label="HĐ sắp hết hạn" value={loading ? null : summary?.personnelNow?.expiringContractCount} note="Trong 30 ngày tới" icon={FileWarning} />}
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <TaskChart summary={summary} previous={previousSummary} loading={loading} />
        <TrainingChart summary={summary} previous={previousSummary} loading={loading} />
      </div>
      {canSeeTimekeeping && <Attendance summary={summary} yesterdayAttendance={yesterdayAttendance} loading={loading} />}
      <HrAnalyticsPanels summary={summary} yesterdayAttendance={yesterdayAttendance} departments={departments} applicants={applicants} jobs={jobs} pipeline={pipeline} loading={loading} canSeeTimekeeping={canSeeTimekeeping} canSeeRecruitment={canSeeRecruitment} />
      <section aria-labelledby="hr-quick-links-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 id="hr-quick-links-heading" className="text-balance text-base font-semibold text-on-surface">Truy cập nhanh</h2>
          {!canSeeTimekeeping && <span className="flex items-center gap-1.5 text-xs text-on-surface-variant"><ShieldCheck aria-hidden="true" className="size-3.5" /> Chấm công cần quyền xem riêng</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.filter((link) => link.sub !== "tuyen-dung" || canSeeRecruitment).map(({ label, sub, icon: IconComponent }) => (
            <Card key={sub}>
              <button type="button" onClick={() => openHrTab(sub)} className="group flex w-full items-center gap-3 rounded-md px-4 py-3.5 text-left hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary group-hover:bg-primary/15"><IconComponent aria-hidden="true" className="size-4.5" /></span>
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
