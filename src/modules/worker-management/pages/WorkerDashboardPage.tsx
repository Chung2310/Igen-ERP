import React from "react";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type { Worker } from "../types";
import { workerDashboardApi } from "../api/workerDashboard.api";
import "./worker-dashboard.css";
import {
  Users,
  Briefcase,
  BarChart3,
  PieChart,
  ClipboardList,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";

type ChartSegment = { label: string; value: number; color: string };

function StatusChart({ title, segments }: { title: string; segments: ChartSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let start = 0;
  const slices = segments.map((segment) => {
    const end = start + (total ? (Math.max(0, segment.value) / total) * 100 : 0);
    const slice = `${segment.color} ${start}% ${end}%`;
    start = end;
    return slice;
  });

  return (
    <div className="min-w-0 flex-1">
      <h4 className="mb-4 text-sm font-medium text-slate-800">{title}</h4>
      <div className="flex flex-wrap items-center gap-5">
        <div
          role="img"
          aria-label={`${title}: ${segments.map(({ label, value }) => `${label} ${value}`).join(", ")}`}
          className="worker-chart-donut relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
          style={{ background: total ? `conic-gradient(${slices.join(", ")})` : "#e2e8f0" }}
        >
          <div className="grid h-[92px] w-[92px] place-items-center rounded-full bg-white text-center">
            <div>
              <span className="block text-2xl font-medium text-slate-900">{total}</span>
              <span className="text-xs text-slate-500">Tổng số</span>
            </div>
          </div>
        </div>
        <div className="min-w-[120px] flex-1 space-y-2.5">
          {segments.map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between gap-3 text-xs text-slate-600">
              <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />{label}</span>
              <span className="font-medium tabular-nums text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkerDashboardPage({
  formattedDate,
  onSelectStudent,
  onSelectWorker,
  onNavigate,
  selectedCenter
}: {
  formattedDate: string;
  onSelectStudent?: (worker: Worker) => void;
  onSelectWorker?: (worker: Worker) => void;
  onNavigate?: (view: string) => void;
  selectedCenter?: string;
}) {
  const [stats, setStats] = React.useState({
    totalWorkers: 0,
    activeWorkers: 0,
    projects: 0,
    workersByStatus: { active: 0, inactive: 0, placed: 0 },
    projectsByStatus: { planned: 0, active: 0, completed: 0 },
    monthlyRegistrations: Array(12).fill(0),
    topProjects: [] as Array<{ name: string; allocated: number; quota: number }>,
    contractAlerts: { alertDays: 30, expiringCount: 0, expiredCount: 0 },
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const select = onSelectWorker || onSelectStudent;

  React.useEffect(() => {
    if (!selectedCenter || selectedCenter === "all") return;
    let active = true;
    setLoading(true);
    void workerDashboardApi
      .get(selectedCenter)
      .then((value) => {
        // Gộp vào giá trị mặc định thay vì thay nguyên object: API thiếu bất kỳ khóa nào
        // (vd monthlyRegistrations) sẽ làm phần render bên dưới ném lỗi ngoài try/catch
        // và trắng toàn bộ trang.
        if (active) setStats((prev) => ({ ...prev, ...value }));
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e, "Không thể tải bảng điều khiển"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCenter]);

  const monthlyRegistrations = Array.from({ length: 12 }, (_, index) => {
    const value = Array.isArray(stats.monthlyRegistrations) ? Number(stats.monthlyRegistrations[index]) : 0;
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  });
  const chartStep = Math.max(1, Math.ceil(Math.max(...monthlyRegistrations) / 4));
  const chartMax = chartStep * 4;
  const annualRegistrations = monthlyRegistrations.reduce((sum, count) => sum + count, 0);
  const hasContractAlerts = stats.contractAlerts.expiredCount > 0 || stats.contractAlerts.expiringCount > 0;
  const contractAlertCount = stats.contractAlerts.expiredCount + stats.contractAlerts.expiringCount;
  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

  return (
    <div className="worker-dashboard flex w-full flex-col gap-5 bg-[#F8FBFF] px-1 py-1 text-left sm:px-2">
      {/* Header section */}
      <section className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="border-l-[3px] border-[#00ADFC] pl-3">
          <h1 className="text-xl font-medium tracking-tight text-slate-900">Tổng quan lao động</h1>
          <p className="mt-1 text-xs font-normal text-slate-500">Hôm nay: {formattedDate}</p>
        </div>
        {(onNavigate || select) && (
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate("lao-dong") : select?.({ _id: "", fullName: "", status: "active" })}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00ADFC] px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0097dc]"
          >
            <Users className="h-4 w-4" />
            Quản lý hồ sơ lao động
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className={`grid grid-cols-1 gap-3 ${hasContractAlerts ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"}`} aria-label="Số liệu tổng quan lao động">
        <div className="flex items-center gap-3 rounded-2xl border border-[#DCE7F4] bg-white p-4">
          <div className="rounded-xl bg-[#E8F7FF] p-3 text-[#00ADFC]">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Tổng lao động</p>
            <p className="mt-0.5 text-2xl font-medium tabular-nums text-slate-900">
              {loading ? <span className="animate-pulse">...</span> : stats.totalWorkers}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#DCE7F4] bg-white p-4">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Đang hoạt động</p>
            <p className="mt-0.5 text-2xl font-medium tabular-nums text-slate-900">
              {loading ? <span className="animate-pulse">...</span> : stats.activeWorkers}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-[#DCE7F4] bg-white p-4">
          <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Dự án tiếp nhận</p>
            <p className="mt-0.5 text-2xl font-medium tabular-nums text-slate-900">
              {loading ? <span className="animate-pulse">...</span> : stats.projects}
            </p>
          </div>
        </div>
        {hasContractAlerts && (
          <div
            role="alert"
            className={`flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-4 ${stats.contractAlerts.expiredCount > 0 ? "border-rose-200" : "border-amber-200"}`}
          >
            <div className={`shrink-0 rounded-xl p-3 ${stats.contractAlerts.expiredCount > 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Hợp đồng cần chú ý</p>
              <p className="mt-0.5 text-2xl font-medium tabular-nums text-slate-900">{contractAlertCount}</p>
              <p className="text-xs text-slate-500">
                {stats.contractAlerts.expiredCount > 0 && stats.contractAlerts.expiringCount > 0
                  ? `${stats.contractAlerts.expiredCount} đã hết hạn · ${stats.contractAlerts.expiringCount} sắp hết hạn trong ${stats.contractAlerts.alertDays} ngày`
                  : stats.contractAlerts.expiredCount > 0
                    ? "Đã hết hạn"
                    : `Sắp hết hạn trong ${stats.contractAlerts.alertDays} ngày`}
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("hop-dong")}
                aria-label="Xem hợp đồng cần chú ý"
                title="Xem hợp đồng"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#DCE7F4] text-slate-600 transition-colors hover:border-[#00ADFC] hover:bg-[#E8F7FF] hover:text-[#007EB8]"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section className="rounded-2xl border border-[#DCE7F4] bg-white p-4 sm:p-5 xl:col-span-7" aria-labelledby="worker-registration-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7EFF7] pb-4">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#E8F7FF] p-2 text-[#00ADFC]"><BarChart3 className="h-5 w-5" /></span>
              <div>
                <h2 id="worker-registration-title" className="text-base font-medium text-slate-900">Lao động đăng ký theo tháng</h2>
                <p className="mt-0.5 text-xs text-slate-500">Số lao động mới đăng ký trong năm {currentYear}</p>
              </div>
            </div>
            <span className="rounded-lg bg-[#E8F7FF] px-2.5 py-1 text-xs text-[#007EB8]">{annualRegistrations} đăng ký</span>
          </div>
          <div className="mt-5 flex h-60 gap-2 sm:gap-3" role="img" aria-label={`Số lao động đăng ký từng tháng năm ${currentYear}: ${monthlyRegistrations.map((count, index) => `tháng ${index + 1} ${count}`).join(", ")}`}>
            <div className="flex w-7 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-slate-400">
              {[4, 3, 2, 1, 0].map((step) => <span key={step}>{step * chartStep}</span>)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative h-[216px] border-b border-[#DCE7F4]">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {[0, 1, 2, 3].map((step) => <span key={step} className="border-t border-dashed border-[#E7EFF7]" />)}
                </div>
                <div className="relative z-10 flex h-full items-end gap-1.5 sm:gap-2.5">
                  {monthlyRegistrations.map((count, index) => (
                    <div key={`${index}-${count}`} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`Tháng ${index + 1}: ${count} lao động`}>
                      {count > 0 && <div className="worker-chart-column relative w-full max-w-9 rounded-t-md bg-[#00ADFC] transition-colors group-hover:bg-[#008DCE]" style={{ height: `${(count / chartMax) * 100}%`, animationDelay: `${index * 45}ms` }}><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] tabular-nums text-slate-600">{count}</span></div>}
                    </div>
                  ))}
                </div>
                {!loading && annualRegistrations === 0 && <p className="absolute inset-0 grid place-items-center text-center text-sm text-slate-500">Chưa có lượt đăng ký trong năm {currentYear}</p>}
              </div>
              <div className="flex h-6 items-end gap-1.5 sm:gap-2.5">
                {months.map((month) => <span key={month} className="min-w-0 flex-1 text-center text-[10px] text-slate-500 sm:text-xs">{month}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#DCE7F4] bg-white p-4 sm:p-5 xl:col-span-5" aria-labelledby="worker-status-title">
          <div className="flex items-start gap-3 border-b border-[#E7EFF7] pb-4">
            <span className="rounded-xl bg-[#E8F7FF] p-2 text-[#00ADFC]"><PieChart className="h-5 w-5" /></span>
            <div>
              <h2 id="worker-status-title" className="text-base font-medium text-slate-900">Cơ cấu lao động và dự án</h2>
              <p className="mt-0.5 text-xs text-slate-500">Phân bổ theo trạng thái hiện tại</p>
            </div>
          </div>
          <div className="mt-5 space-y-5 divide-y divide-[#E7EFF7]">
            <StatusChart key={`workers-${stats.workersByStatus.active}-${stats.workersByStatus.placed}-${stats.workersByStatus.inactive}`} title="Lao động" segments={[
              { label: "Hoạt động", value: stats.workersByStatus.active, color: "#00ADFC" },
              { label: "Giao việc", value: stats.workersByStatus.placed, color: "#F59E0B" },
              { label: "Nghỉ", value: stats.workersByStatus.inactive, color: "#CBD5E1" },
            ]} />
            <div className="pt-5"><StatusChart key={`projects-${stats.projectsByStatus.active}-${stats.projectsByStatus.planned}-${stats.projectsByStatus.completed}`} title="Dự án" segments={[
              { label: "Đang triển khai", value: stats.projectsByStatus.active, color: "#00ADFC" },
              { label: "Sắp triển khai", value: stats.projectsByStatus.planned, color: "#93C5FD" },
              { label: "Hoàn thành", value: stats.projectsByStatus.completed, color: "#38BDF8" },
            ]} /></div>
          </div>
        </section>
      </div>

      <section className="space-y-4 rounded-2xl border border-[#DCE7F4] bg-white p-4 sm:p-5">
        <div className="flex items-center gap-3 border-b border-[#E7EFF7] pb-4">
          <div className="rounded-xl bg-violet-50 p-2 text-violet-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-medium text-slate-900">Lao động theo dự án</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Số lao động tham gia so với chỉ tiêu của các dự án nổi bật
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-slate-500 animate-pulse">
            Đang tải dữ liệu phân bổ...
          </div>
        ) : stats.topProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {stats.topProjects.map((p, idx) => {
              const percent = Math.min(100, p.quota > 0 ? Math.round((p.allocated / p.quota) * 100) : 0);
              return (
                <div key={idx} className="space-y-2 border-b border-[#E7EFF7] py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-800" title={p.name}>
                      {p.name}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {p.allocated} / {p.quota} chỉ tiêu · {percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`worker-chart-progress h-full rounded-full ${
                        percent >= 100
                          ? "bg-emerald-500"
                          : percent >= 75
                          ? "bg-[#00ADFC]"
                          : percent >= 40
                          ? "bg-amber-400"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-slate-500">
            Chưa có dự án nào được gán chỉ tiêu lao động.
          </div>
        )}
      </section>
    </div>
  );
}
