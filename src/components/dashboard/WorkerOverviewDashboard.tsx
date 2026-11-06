import { BriefcaseBusiness, ClipboardCheck, FileWarning, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { OverviewKpiDelta } from "./OverviewKpiDelta";
import { useOverviewPeriod } from "./OverviewPeriodContext";
import { OverviewChartViewport } from "./OverviewChartViewport";
import { overviewDateKey } from "./overviewComparison";
import { workerDashboardApi, type WorkerDashboard } from "../../modules/worker-management/api/workerDashboard.api";
import { workerApi } from "../../modules/worker-management/api/workers.api";
import { laborPartnersApi } from "../../modules/worker-management/partners/api/laborPartners.api";
import type { LaborPartnerReportSummary } from "../../modules/worker-management/partners/types";
import type { Worker } from "../../modules/worker-management/types";
import { workerDistributions } from "./workerOverviewMetrics";
import "../../modules/finance/finance-overview.css";

const integer = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `${integer(value)} đ`;
const colors = ["var(--finance-chart-blue)", "var(--finance-chart-teal)", "var(--finance-chart-orange)", "var(--finance-chart-violet)", "var(--finance-chart-red)"];
const kpiIcons = [UsersRound, UserCheck, ClipboardCheck, BriefcaseBusiness, UserPlus, FileWarning] as const;

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="finance-chart-card"><h3 className="mb-3 text-sm font-semibold text-on-surface">{title}</h3>{children}</section>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-on-surface-variant">{children}</p>;
}

function Donut({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  const reduceMotion = useReducedMotion();
  const active = rows.filter(row => row.count > 0);
  return <Panel title={title}>{active.length ? <><div role="img" aria-label={`${title}: ${rows.map(row => `${row.name} ${row.count}`).join(", ")}`} className="h-52"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={active} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius="52%" outerRadius="76%" stroke="none" isAnimationActive={!reduceMotion} animationDuration={700}>{active.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip formatter={value => typeof value === "number" ? integer(value) : value} /></PieChart></ResponsiveContainer></OverviewChartViewport></div><div className="grid grid-cols-2 gap-2 border-t border-outline-variant pt-3 text-xs">{rows.map((row, index) => <div key={row.name} className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 text-on-surface-variant"><span className="size-2 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} /><span className="truncate">{row.name}</span></span><strong className="tabular-nums">{integer(row.count)}</strong></div>)}</div></> : <Empty>Chưa có dữ liệu trong phạm vi đã chọn.</Empty>}</Panel>;
}

function Horizontal({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  const reduceMotion = useReducedMotion();
  const active = rows.filter(row => row.count > 0).slice(0, 6);
  return <Panel title={title}>{active.length ? <div role="img" aria-label={`${title}: ${active.map(row => `${row.name} ${row.count}`).join(", ")}`} className="h-64"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><BarChart data={active} layout="vertical" margin={{ top: 4, right: 52, bottom: 4, left: 12 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" horizontal={false} /><XAxis axisLine={false} tickLine={false} type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={105} tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.length > 16 ? `${value.slice(0, 15)}…` : value} /><Tooltip formatter={value => typeof value === "number" ? integer(value) : value} /><Bar dataKey="count" name="Lao động" maxBarSize={24} isAnimationActive={!reduceMotion} animationDuration={700}>{active.map((row, index) => <Cell key={row.name} fill={colors[index % colors.length]} />)}<LabelList dataKey="count" position="right" fill="var(--color-on-surface-variant)" fontSize={11} formatter={(value: unknown) => typeof value === "number" && value > 0 ? integer(value) : ""} /></Bar></BarChart></ResponsiveContainer></OverviewChartViewport></div> : <Empty>Chưa có dữ liệu trong phạm vi đã chọn.</Empty>}</Panel>;
}

export default function WorkerOverviewDashboard({ companyCode, branchId, canSeePartners }: { companyCode: string; branchId?: string; canSeePartners: boolean }) {
  const overviewPeriod = useOverviewPeriod();
  const [summary, setSummary] = useState<WorkerDashboard | null>(null);
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [partner, setPartner] = useState<LaborPartnerReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestSequence = useRef(0);
  const reduceMotion = useReducedMotion();
  const loadData = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    const scope = { companyCode, branchId };
    const [dashboardResult, workerResult, partnerResult] = await Promise.allSettled([
      workerDashboardApi.get(companyCode, branchId),
      workerApi.list(scope),
      canSeePartners ? laborPartnersApi.dashboard(scope) : Promise.resolve(null),
    ] as const);
    if (requestId !== requestSequence.current) return;
    setSummary(dashboardResult.status === "fulfilled" ? dashboardResult.value : null);
    setWorkers(workerResult.status === "fulfilled" ? workerResult.value : null);
    setPartner(partnerResult.status === "fulfilled" ? partnerResult.value : null);
    setError([dashboardResult, workerResult, partnerResult].some(result => result.status === "rejected"));
    setLoading(false);
  }, [companyCode, branchId, canSeePartners]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void loadData(); });
    return () => { active = false; requestSequence.current += 1; };
  }, [loadData]);

  const distributions = workers ? workerDistributions(workers) : null;
  const status = summary?.workersByStatus;
  const projectStatus = summary?.projectsByStatus;
  const alerts = summary?.contractAlerts;
  const monthly = Array.from({ length: 12 }, (_, index) => ({ name: `T${index + 1}`, count: summary?.monthlyRegistrations?.[index] || 0 }));
  const projects = summary?.topProjects || [];
  const registeredIn = (from: string, to: string) => workers?.filter(worker => {
    const date = overviewDateKey(worker.registrationDate);
    return date != null && date >= from && date <= to;
  }).length ?? null;
  const currentRegistrations = overviewPeriod ? registeredIn(overviewPeriod.from, overviewPeriod.to) : null;
  const previousRegistrations = overviewPeriod ? registeredIn(overviewPeriod.previousFrom, overviewPeriod.previousTo) : null;
  const datedWorkerRoster = workers && workers.every(worker => overviewDateKey(worker.registrationDate || worker.createdAt));
  const currentWorkerCount = datedWorkerRoster && overviewPeriod
    ? workers.filter(worker => (overviewDateKey(worker.registrationDate || worker.createdAt) || "") <= overviewPeriod.to).length
    : summary?.totalWorkers ?? workers?.length;
  const previousWorkerCount = datedWorkerRoster && overviewPeriod
    ? workers.filter(worker => (overviewDateKey(worker.registrationDate || worker.createdAt) || "") <= overviewPeriod.previousTo).length
    : null;
  const kpis = [
    { title: "Tổng lao động", value: currentWorkerCount, previous: previousWorkerCount },
    { title: "Hoạt động", value: status?.active ?? summary?.activeWorkers },
    { title: "Đã phân công", value: status?.placed },
    { title: "Dự án", value: summary?.projects },
    { title: "Lao động mới", value: currentRegistrations, previous: previousRegistrations },
    { title: "Hợp đồng cần chú ý", value: alerts ? alerts.expiringCount + alerts.expiredCount : null },
  ];
  const workerRows = status ? [{ name: "Hoạt động", count: status.active }, { name: "Đã phân công", count: status.placed }, { name: "Nghỉ", count: status.inactive }] : [];
  const projectRows = projectStatus ? [{ name: "Sắp triển khai", count: projectStatus.planned }, { name: "Đang triển khai", count: projectStatus.active }, { name: "Hoàn thành", count: projectStatus.completed }] : [];
  const typeRows = distributions ? [{ name: "Chính thức", count: distributions.types.official }, { name: "Thời vụ", count: distributions.types.seasonal }, { name: "Nước ngoài", count: distributions.types.foreign }, { name: "Chưa phân loại", count: distributions.types.unknown }] : [];
  const contractRows: Array<{ label: string; value?: number; format: (value: number) => string }> = [
    { label: "HĐ sắp hết hạn", value: alerts?.expiringCount, format: integer },
    { label: "HĐ đã hết hạn", value: alerts?.expiredCount, format: integer },
    ...(canSeePartners ? [
      { label: "Kỳ đối soát", value: partner?.settlementCount, format: integer },
      { label: "Hoa hồng phát sinh", value: partner?.accruedAmount, format: money },
      { label: "Đã thanh toán", value: partner?.paidAmount, format: money },
      { label: "Còn phải trả", value: partner?.balanceAmount, format: money },
    ] : []),
  ];

  return <div className="finance-overview space-y-3 text-left text-on-surface">
    <h2 className="sr-only">Tổng quan Lao động</h2>
    {error && <p role="status" className="rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">Một số nguồn dữ liệu chưa tải được. Vui lòng thử lại sau.</p>}
    <section className="finance-chart-card" aria-label="Chỉ số tổng quan lao động">
      <h3 className="mb-3 text-lg font-semibold">Tình hình lao động</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {kpis.map((item, index) => {
          const Icon = kpiIcons[index];
          return <div key={item.title} className={`finance-kpi finance-kpi-${index} flex min-h-28 flex-col`}>
            <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium text-white">{item.title}</p><Icon className="size-4 shrink-0 text-on-primary opacity-70" aria-hidden="true" /></div>
            <p className="mt-2 text-lg font-semibold tabular-nums text-white sm:text-xl"><AnimatedOverviewValue value={loading ? null : item.value} format={integer} /></p>
            {item.previous !== undefined ? <OverviewKpiDelta value={loading ? null : item.value} previous={item.previous} unit="người" /> : <p className="finance-kpi-delta mt-auto w-full bg-surface-container-lowest px-2 py-1 text-xs font-medium leading-4 text-on-surface-variant">Số hiện tại</p>}
          </div>;
        })}
      </div>
      <p className="mt-2 text-pretty text-xs text-on-surface-variant">Biến động tổng lao động dựa trên hồ sơ còn tồn tại; các trạng thái, dự án và hợp đồng là số hiện tại.</p>
    </section>
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
      <Panel title="Lao động đăng ký theo tháng">{summary?.monthlyRegistrations?.some(value => value > 0) ? <><div role="img" aria-label={`Lao động đăng ký theo tháng: ${monthly.map(row => `${row.name} ${row.count}`).join(", ")}`} className="h-56"><OverviewChartViewport><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{ top: 6, right: 12, bottom: 4, left: -20 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} tickLine={false} dataKey="name" tick={{ fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={value => typeof value === "number" ? integer(value) : value} /><Line type="monotone" dataKey="count" name="Đăng ký" stroke={colors[0]} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={!reduceMotion} animationDuration={700} /></LineChart></ResponsiveContainer></OverviewChartViewport></div><p className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant">Trong năm: <strong className="tabular-nums text-on-surface">{integer(monthly.reduce((sum, row) => sum + row.count, 0))} lao động</strong></p></> : <Empty>{loading ? "Đang tải đăng ký..." : "Chưa có lượt đăng ký trong năm."}</Empty>}</Panel>
      <Donut title="Cơ cấu lao động" rows={workerRows} />
      <Donut title="Trạng thái dự án" rows={projectRows} />
      <Donut title="Loại lao động" rows={typeRows} />
      <Horizontal title="Nguồn đối tác" rows={distributions?.partners || []} />
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Phân bổ theo dự án">{projects.length ? <div className="space-y-3">{projects.map(project => { const percent = project.quota > 0 ? Math.min(100, project.allocated / project.quota * 100) : 0; return <div key={project.name} className="border-b border-outline-variant pb-3 last:border-0"><div className="mb-2 flex justify-between gap-3 text-xs"><span className="min-w-0 truncate">{project.name}</span><strong className="shrink-0 tabular-nums">{integer(project.allocated)} / {integer(project.quota)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-surface-container-low"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>; })}</div> : <Empty>Chưa có dự án được phân bổ lao động.</Empty>}</Panel>
      <Panel title="Hợp đồng và đối tác">{alerts || partner ? <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">{contractRows.map(row => <div key={row.label} className="border-b border-outline-variant pb-3"><p className="text-on-surface-variant">{row.label}</p><strong className="mt-1 block break-words text-base tabular-nums">{typeof row.value === "number" ? row.format(row.value) : "—"}</strong></div>)}</div> : <Empty>Chưa có dữ liệu hợp đồng và đối tác.</Empty>}</Panel>
    </div>
  </div>;
}
