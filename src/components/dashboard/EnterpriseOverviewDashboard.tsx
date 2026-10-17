import { BookOpenCheck, BriefcaseBusiness, GraduationCap, PackageOpen, UsersRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { ComponentType } from "react";
import type { UserProfile } from "../../types";
import type { DashboardSummary } from "../../types/dashboard";
import type { DashboardPeriod } from "./dashboardPeriod";

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;
type Segment = { label: string; value: number; color: string };
type JoinBucket = { label: string; value: number };

const format = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("vi-VN");
const panelClass = "rounded-[20px] bg-white p-5 shadow-[0_8px_28px_rgba(26,67,103,0.055)] sm:p-6";

function Metric({ label, value, icon: IconComponent, tone, accent }: {
  label: string;
  value: string;
  icon: Icon;
  tone: string;
  accent: string;
}) {
  const reduced = useReducedMotion();
  return <motion.div initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
    className="relative flex min-h-[98px] items-center gap-3 overflow-hidden rounded-2xl bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(26,67,103,0.055)]">
    <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-2xl " + tone}><IconComponent className="h-5 w-5" /></span>
    <div className="relative z-10 min-w-0"><p className="truncate text-xs text-[#355271]">{label}</p><p className="mt-1 text-[23px] font-semibold leading-none tabular-nums" style={{ color: accent }}>{value}</p><p className="mt-1.5 text-[10px] text-slate-400">Trong kỳ</p></div>
    <IconComponent aria-hidden className="pointer-events-none absolute -bottom-5 -right-3 h-24 w-24 opacity-[0.07]" strokeWidth={1.3} />
  </motion.div>;
}

function Distribution({ title, rows, tone }: { title: string; rows: Segment[]; tone: string }) {
  const reduced = useReducedMotion();
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return <section className={panelClass}>
    <h2 className="flex items-center gap-2 text-sm font-semibold text-[#143963]"><span className={"grid h-7 w-7 place-items-center rounded-lg " + tone}><BriefcaseBusiness className="h-4 w-4" /></span>{title}</h2>
    {total === 0 ? <div className="mt-4 flex min-h-24 items-center justify-center gap-2 rounded-xl bg-[#F4FAFD] text-sm text-slate-500"><PackageOpen className="h-5 w-5 text-[#A9BDD0]" />Chưa có dữ liệu trong khoảng thời gian này.</div> :
      <div className="mt-5 space-y-3.5">{rows.map((row) => <div key={row.label}>
        <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-slate-600">{row.label}</span><span className="font-medium tabular-nums text-[#143963]">{format(row.value)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-[#ECF3F8]"><motion.div initial={reduced ? false : { width: 0 }} animate={{ width: String(row.value / total * 100) + "%" }} transition={{ duration: 0.55 }} className="h-full rounded-full" style={{ backgroundColor: row.color }} /></div>
      </div>)}</div>}
  </section>;
}

function joinBuckets(employees: UserProfile[] | null, start: Date, end: Date, period: DashboardPeriod): JoinBucket[] {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (period === "year") {
    const buckets = Array.from({ length: 12 }, (_, month) => ({ label: "T" + (month + 1), value: 0 }));
    for (const employee of employees || []) {
      const joined = new Date(employee.createdAt as string);
      if (!Number.isNaN(joined.getTime()) && joined >= start && joined <= end) buckets[joined.getMonth()].value += 1;
    }
    return buckets;
  }
  const day = 86400000;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const dayCount = Math.max(1, Math.round((endDay - startDay) / day) + 1);
  const count = period === "month" ? Math.ceil(dayCount / 7) : Math.min(8, dayCount);
  const buckets = Array.from({ length: count }, (_, index) => {
    const offset = period === "month" ? index * 7 : Math.floor(index * dayCount / count);
    const date = new Date(startDay + offset * day);
    return { label: period === "month" ? "Tuần " + (index + 1) : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), value: 0 };
  });
  for (const employee of employees || []) {
    const joined = new Date(employee.createdAt as string);
    if (Number.isNaN(joined.getTime()) || joined < start || joined > end) continue;
    const joinedDay = new Date(joined.getFullYear(), joined.getMonth(), joined.getDate()).getTime();
    const offset = Math.max(0, Math.round((joinedDay - startDay) / day));
    const bucketIndex = period === "month" ? Math.floor(offset / 7) : Math.floor(offset * count / dayCount);
    buckets[Math.min(count - 1, bucketIndex)].value += 1;
  }
  return buckets;
}

function JoinChart({ buckets, unavailable }: { buckets: JoinBucket[]; unavailable: boolean }) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  return <section className={panelClass}>
    <h2 className="text-sm font-semibold text-[#143963]">Nhân sự gia nhập theo thời gian</h2>
    {unavailable ? <div className="mt-5 grid h-[170px] place-items-center text-xs text-slate-500">Chưa có ngày gia nhập để vẽ biểu đồ.</div> :
      <div className="relative mt-5 h-[170px]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">{[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-[#E5EEF6]" />)}</div>
        <div className="relative flex h-full items-end gap-1.5">{buckets.map((bucket, index) => <div key={index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div className="flex h-[137px] w-full items-end justify-center"><motion.div title={bucket.label + ": " + bucket.value + " nhân sự"} initial={reduced ? false : { height: 0 }} animate={{ height: String(Math.max(bucket.value ? 7 : 2, bucket.value / max * 100)) + "%" }} transition={{ duration: 0.55, delay: index * 0.025 }} className="w-full max-w-8 rounded-t-md bg-gradient-to-t from-[#078FEB] to-[#8CD3FF]" /></div>
          <span className="h-5 truncate text-center text-[10px] text-slate-500">{bucket.label}</span>
        </div>)}</div>
      </div>}
  </section>;
}

function TaskChart({ rows }: { rows: Segment[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let progress = 0;
  const stops = rows.map((row) => {
    const from = progress;
    progress += total > 0 ? row.value / total * 100 : 0;
    return row.color + " " + from + "% " + progress + "%";
  });
  return <section className={panelClass}>
    <h2 className="text-sm font-semibold text-[#143963]">Trạng thái công việc tạo trong kỳ</h2>
    <div className="mt-5 flex min-h-[170px] items-center justify-center gap-5">
      <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full p-4" style={{ background: total ? "conic-gradient(" + stops.join(", ") + ")" : "#EDF4F8" }}>
        <div className="grid h-full w-full place-content-center rounded-full bg-white text-center"><strong className="text-2xl font-semibold text-[#143963]">{format(total)}</strong><span className="text-[10px] text-slate-500">Tổng công việc</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">{rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2 truncate text-slate-600"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />{row.label}</span><strong className="font-medium tabular-nums text-[#143963]">{format(row.value)}</strong></div>)}</div>
    </div>
  </section>;
}

function TrainingChart({ rows }: { rows: Segment[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className={panelClass}>
    <h2 className="text-sm font-semibold text-[#143963]">Lượt tham gia đào tạo</h2>
    <div className="mt-5 flex min-h-[170px] flex-col justify-center gap-5">{rows.map((row) => <div key={row.label} className="grid grid-cols-[105px_minmax(0,1fr)_24px] items-center gap-2">
      <span className="truncate text-xs text-slate-600">{row.label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-[#EDF4F8]"><motion.div initial={reduced ? false : { width: 0 }} animate={{ width: String(row.value / max * 100) + "%" }} transition={{ duration: 0.55 }} className="h-full rounded-full" style={{ backgroundColor: row.color }} /></div>
      <strong className="text-right text-xs font-medium tabular-nums text-[#143963]">{row.value}</strong>
    </div>)}</div>
  </section>;
}

function InProgressTaskList({ summary, loading, error }: { summary: DashboardSummary | null; loading: boolean; error: boolean }) {
  const tasks = summary?.personnelNow?.inProgressTasks ?? [];
  const count = summary?.personnelNow?.inProgressTaskCount ?? 0;
  const openTasks = () => {
    window.history.pushState(null, "", "/nhan-su?sub=kanban");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const dueLabel = (value: string) => {
    if (!value || value === "Chưa cập nhật") return "Chưa có hạn";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
  };
  return <section className={panelClass}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#143963]"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F1EAFE] text-[#8057E7]"><BriefcaseBusiness className="h-4 w-4" /></span>Công việc đang làm</h2>
      <span className="rounded-full bg-[#F1EAFE] px-2.5 py-1 text-xs font-medium tabular-nums text-[#8057E7]">{loading || !summary ? "—" : count} việc</span>
    </div>
    {loading || error || !summary ? <div className="mt-4 grid min-h-24 place-items-center rounded-xl bg-[#F4FAFD] text-sm text-slate-500">{error ? "Không tải được công việc." : "Đang tải công việc..."}</div> : tasks.length ?
      <div className="mt-4 divide-y divide-[#ECF2F7]">{tasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
        <div className="flex min-w-0 items-center gap-2.5"><span className="h-2 w-2 shrink-0 rounded-full bg-[#00ADFC]" /><div className="min-w-0"><p className="truncate text-xs font-medium text-[#143963]">{task.title}</p><p className="truncate text-[11px] text-slate-500">{task.assignee || "Chưa phân công"}</p></div></div>
        <span className="shrink-0 text-[11px] text-slate-500">{dueLabel(task.dueDate)}</span>
      </div>)}</div> : <div className="mt-4 flex min-h-24 items-center justify-center gap-2 rounded-xl bg-[#F4FAFD] text-sm text-slate-500"><BriefcaseBusiness className="h-5 w-5 text-[#A9BDD0]" />Chưa có công việc đang làm.</div>}
    <button type="button" onClick={openTasks} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#008ACB] hover:text-[#006DAB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ADFC]">Xem giao việc <ArrowUpRight className="h-3.5 w-3.5" /></button>
  </section>;
}

export function EnterpriseOverviewDashboard({ summary, employeeCount, employees, period, rangeStart, rangeEnd, loading, error }: {
  summary: DashboardSummary | null;
  employeeCount: number | null;
  employees: UserProfile[] | null;
  period: DashboardPeriod;
  rangeStart: Date;
  rangeEnd: Date;
  loading: boolean;
  error: boolean;
}) {
  const tasks = summary?.projects.tasks;
  const enrollments = summary?.training.enrollments;
  const metrics = [
    { label: "Nhân sự gia nhập", value: format(employeeCount), icon: UsersRound, tone: "bg-sky-100 text-sky-700", accent: "#058DCB" },
    { label: "Công việc tạo", value: format(loading ? null : tasks?.total), icon: BriefcaseBusiness, tone: "bg-violet-100 text-violet-700", accent: "#7435E4" },
    { label: "Khóa đào tạo tạo", value: format(loading ? null : summary?.training.totalCourses), icon: GraduationCap, tone: "bg-orange-100 text-orange-700", accent: "#C65316" },
    { label: "Lượt tham gia đào tạo", value: format(loading ? null : enrollments?.total), icon: BookOpenCheck, tone: "bg-sky-100 text-sky-700", accent: "#058DCB" },
  ];
  const taskRows: Segment[] = [
    { label: "Hoàn thành", value: tasks?.done ?? 0, color: "#18B777" },
    { label: "Đang thực hiện", value: tasks?.doing ?? 0, color: "#00ADFC" },
    { label: "Chưa bắt đầu", value: tasks?.todo ?? 0, color: "#F17B27" },
  ];
  const trainingRows: Segment[] = [
    { label: "Đã hoàn thành", value: enrollments?.completed ?? 0, color: "#18B777" },
    { label: "Đang học", value: enrollments?.inProgress ?? 0, color: "#00ADFC" },
    { label: "Chưa bắt đầu", value: enrollments?.notStarted ?? 0, color: "#8057E7" },
  ];
  const buckets = joinBuckets(employees, rangeStart, rangeEnd, period);
  return <div className="space-y-4 pb-6">
    {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Không tải được số liệu nhân sự. Hãy thử làm mới.</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Metric key={metric.label} {...metric} />)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.9fr_1.1fr]">
      <JoinChart buckets={buckets} unavailable={employees == null || employeeCount == null} />
      <TaskChart rows={taskRows} />
      <TrainingChart rows={trainingRows} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Distribution title="Trạng thái công việc tạo trong kỳ" rows={taskRows} tone="bg-[#EAF6FF] text-[#078DCC]" />
      <InProgressTaskList summary={summary} loading={loading} error={error} />
    </div>
  </div>;
}
