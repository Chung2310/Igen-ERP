import {
  ArrowRight, BriefcaseBusiness, CalendarDays,
  FileText, FolderTree, GraduationCap, Layers3, ShieldCheck, UsersRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import type { DashboardSummary } from "../../types/dashboard";

type Icon = ComponentType<{ className?: string }>;
type Tone = "blue" | "green" | "amber" | "violet";

const toneClasses: Record<Tone, { icon: string; text: string }> = {
  blue: { icon: "bg-sky-100 text-sky-600", text: "text-sky-700" },
  green: { icon: "bg-emerald-100 text-emerald-600", text: "text-emerald-700" },
  amber: { icon: "bg-orange-100 text-orange-600", text: "text-orange-700" },
  violet: { icon: "bg-violet-100 text-violet-600", text: "text-violet-700" },
};

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
  loading || value == null ? "—" : value.toLocaleString("vi-VN");

function openHrTab(sub: string) {
  window.history.pushState(null, "", `/nhan-su?sub=${sub}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Card({
  children, delay = 0, className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-2xl bg-white shadow-[0_8px_28px_rgba(26,67,103,0.055)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

function Kpi({
  label, value, note, icon: IconComponent, tone, delay,
}: {
  label: string;
  value: string;
  note: string;
  icon: Icon;
  tone: Tone;
  delay: number;
}) {
  const palette = toneClasses[tone];
  return (
    <Card delay={delay} className="min-w-0 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${palette.icon}`}><IconComponent className="h-[19px] w-[19px]" /></span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
          <p className={`mt-1 text-[23px] font-semibold leading-none tabular-nums ${palette.text}`}>{value}</p>
        </div>
      </div>
      <span className="sr-only">{note}</span>
    </Card>
  );
}

function PanelHeader({ title, subtitle, sub, badge }: { title: string; subtitle: string; sub: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-[#143963]">{title}</h2>
          {badge && <span className="rounded-full bg-[#E8F7FF] px-2.5 py-1 text-[11px] font-medium text-[#007EB8]">{badge}</span>}
        </div>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      <button type="button" onClick={() => openHrTab(sub)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8F7FF] text-[#008FCE] transition hover:bg-[#D2F0FF] focus-visible:outline-2 focus-visible:outline-[#00ADFC]" aria-label={`Mở ${title}`}>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function TaskChart({ summary, loading }: { summary: DashboardSummary | null; loading: boolean }) {
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
    <Card delay={0.12} className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <PanelHeader title="Tiến độ công việc" subtitle="Trạng thái công việc hiện tại" sub="kanban" badge={`${numberText(total, loading)} việc`} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-5 sm:flex-row sm:gap-7">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.88, rotate: -18 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative h-44 w-44 shrink-0"
          role="img"
          aria-label={loading || !summary ? "Đang tải biểu đồ công việc" : `Công việc: ${segments.map((item) => `${item.label} ${item.count}`).join(", ")}`}
        >
          <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="88" cy="88" r={radius} fill="none" stroke="#EBF4F9" strokeWidth="15" />
            {arcs.map((arc) => arc.length > 0 && (
              <circle key={arc.label} cx="88" cy="88" r={radius} fill="none" stroke={arc.color} strokeWidth="15" strokeLinecap="round"
                strokeDasharray={`${Math.max(0, arc.length - 4)} ${circumference}`}
                strokeDashoffset={-arc.offset} />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-semibold tabular-nums text-[#143963]">{loading || !summary ? "—" : total ? `${completedPercent}%` : "0"}</span>
            <span className="mt-1 text-xs text-slate-500">{total ? "hoàn thành" : "chưa có việc"}</span>
          </div>
        </motion.div>
        <div className="w-full max-w-[270px] divide-y divide-slate-100">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${segment.dot}`} />{segment.label}</span>
              <span className="font-semibold tabular-nums text-[#143963]">{numberText(segment.count, loading)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Quá hạn</span>
            <span className="font-semibold tabular-nums text-rose-600">{numberText(summary?.projects.overdueTasks, loading)}</span>
          </div>
        </div>
      </div>
      {total === 0 && !loading && <p className="rounded-xl bg-[#F4FAFD] px-3 py-2.5 text-center text-xs text-slate-500">Tạo công việc trong mục Giao việc để theo dõi tiến độ tại đây.</p>}
    </Card>
  );
}

function TrainingChart({ summary, loading }: { summary: DashboardSummary | null; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const enrollments = summary?.training.enrollments;
  const total = enrollments?.total ?? 0;
  const rows = [
    { label: "Đang học", count: enrollments?.inProgress ?? 0, bar: "bg-[#00ADFC]", text: "text-[#008FCE]" },
    { label: "Đã hoàn thành", count: enrollments?.completed ?? 0, bar: "bg-emerald-500", text: "text-emerald-600" },
    { label: "Chưa bắt đầu", count: enrollments?.notStarted ?? 0, bar: "bg-violet-500", text: "text-violet-600" },
  ];

  return (
    <Card delay={0.18} className="flex h-full min-w-0 flex-col p-5 sm:p-6">
      <PanelHeader title="Đào tạo nội bộ" subtitle="Tiến độ tham gia của nhân sự" sub="dao-tao" badge={`${numberText(summary?.training.totalCourses, loading)} khóa`} />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#EAF7FF] px-4 py-3.5">
          <p className="text-xs text-[#39749A]">Khóa đang diễn ra</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[#007EB8]">{numberText(summary?.training.ongoingCourses, loading)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-3.5">
          <p className="text-xs text-emerald-700">Lượt học hoàn thành</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-700">{numberText(enrollments?.completed, loading)}</p>
        </div>
      </div>
      <div className="mt-6 flex-1 space-y-5">
        {rows.map((row, index) => {
          const percent = total ? Math.min(100, row.count / total * 100) : 0;
          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">{row.label}</span>
                <span className={`font-semibold tabular-nums ${row.text}`}>{numberText(row.count, loading)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#ECF3F8]" role="img" aria-label={`${row.label}: ${numberText(row.count, loading)} trên ${numberText(total, loading)} lượt học`}>
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
      <p className="mt-6 rounded-xl bg-[#F4FAFD] px-3 py-2.5 text-center text-xs text-slate-500">
        {total ? `Tổng ${numberText(total)} lượt tham gia đào tạo` : "Chưa có lượt tham gia đào tạo."}
      </p>
    </Card>
  );
}

function Attendance({ summary, loading }: { summary: DashboardSummary | null; loading: boolean }) {
  const attendance = summary?.timekeeping;
  const total = attendance?.totalEmployees ?? 0;
  const checkedIn = attendance?.checkedInToday ?? 0;
  const percent = total ? Math.min(100, Math.round(checkedIn / total * 100)) : 0;
  return (
    <Card delay={0.24} className="p-5 sm:p-6">
      <PanelHeader title="Chấm công hôm nay" subtitle="Tình hình nhân sự toàn công ty" sub="lich" />
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Đã chấm công", count: checkedIn, tone: "bg-sky-50 text-sky-700" },
          { label: "Đi muộn", count: attendance?.lateToday, tone: "bg-orange-50 text-orange-700" },
          { label: "Nghỉ phép", count: attendance?.onApprovedLeaveToday, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Vắng không phép", count: attendance?.absentWithoutLeave, tone: "bg-rose-50 text-rose-700" },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl px-4 py-3 ${item.tone}`}>
            <p className="text-xs">{item.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{numberText(item.count, loading)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>Tỷ lệ đã chấm công</span><span className="font-medium text-[#007EB8]">{loading || !summary ? "—" : `${percent}%`}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EAF3F9]" role="img" aria-label={`Tỷ lệ chấm công: ${percent}%`}><div className="h-full rounded-full bg-[#00ADFC] transition-[width] duration-500" style={{ width: `${percent}%` }} /></div>
    </Card>
  );
}

export function HrOverviewDashboard({
  summary, employeeCount, newEmployeeCount, employeeScope, loading, error, canSeeTimekeeping, canSeeRecruitment,
}: {
  summary: DashboardSummary | null;
  employeeCount: number | null;
  newEmployeeCount: number | null;
  employeeScope: string;
  loading: boolean;
  error: boolean;
  canSeeTimekeeping: boolean;
  canSeeRecruitment: boolean;
}) {
  return (
    <div className="space-y-4 pb-5">
      {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Không tải được số liệu nhân sự. Bấm Làm mới để thử lại.</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Nhân sự" value={numberText(employeeCount)} note={employeeScope} icon={UsersRound} tone="blue" delay={0} />
        <Kpi label="Mới trong kỳ" value={numberText(newEmployeeCount)} note="Theo bộ lọc thời gian" icon={CalendarDays} tone="green" delay={0.05} />
        <Kpi label="Công việc" value={numberText(summary?.projects.tasks.total, loading)} note="Tổng số công việc hiện tại" icon={BriefcaseBusiness} tone="violet" delay={0.1} />
        <Kpi label="Khóa đào tạo" value={numberText(summary?.training.totalCourses, loading)} note="Tổng số khóa hiện tại" icon={GraduationCap} tone="amber" delay={0.15} />
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <TaskChart summary={summary} loading={loading} />
        <TrainingChart summary={summary} loading={loading} />
      </div>
      {canSeeTimekeeping && <Attendance summary={summary} loading={loading} />}
      <section aria-labelledby="hr-quick-links-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 id="hr-quick-links-heading" className="text-base font-semibold text-[#143963]">Truy cập nhanh</h2>
          {!canSeeTimekeeping && <span className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Chấm công cần quyền xem riêng</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.filter((link) => link.sub !== "tuyen-dung" || canSeeRecruitment).map(({ label, sub, icon: IconComponent }, index) => (
            <Card key={sub} delay={0.28 + index * 0.035}>
              <button type="button" onClick={() => openHrTab(sub)} className="group flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition hover:bg-[#F0FAFF] focus-visible:outline-2 focus-visible:outline-[#00ADFC]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8F7FF] text-[#0095D9] transition group-hover:bg-[#D7F2FF]"><IconComponent className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1 text-sm font-medium text-[#143963]">{label}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0095D9]" />
              </button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
