import React from "react";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type { Worker } from "../types";
import { workerDashboardApi } from "../api/workerDashboard.api";
import {
  Users,
  Briefcase,
  Activity,
  BarChart3,
  PieChart,
  ClipboardList,
  UserCheck,
  TrendingUp,
  UserX,
  AlertTriangle,
  FileCheck2
} from "lucide-react";

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

  const monthlyRegistrations = Array.isArray(stats.monthlyRegistrations) ? stats.monthlyRegistrations : [];
  const maxRegCount = Math.max(...monthlyRegistrations, 1);
  const currentYear = new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

  return (
    <div className="flex flex-col gap-6 text-left w-full max-w-7xl mx-auto p-1">
      {/* Header section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Tổng quan Lao động
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cập nhật ngày hôm nay: {formattedDate}
          </p>
        </div>
        {select && (
          <button
            type="button"
            onClick={() => select({ _id: "", fullName: "", status: "active" })}
            className="px-4 py-2 bg-indigo-550 hover:bg-indigo-600 active:scale-95 text-white font-bold rounded-xl text-xs shadow-3xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            Quản lý hồ sơ lao động
          </button>
        )}
      </section>

      {error && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {(stats.contractAlerts.expiredCount > 0 || stats.contractAlerts.expiringCount > 0) && (
        <div
          role="alert"
          className={`flex flex-wrap items-center gap-2 rounded-xl border p-4 text-xs font-semibold ${
            stats.contractAlerts.expiredCount > 0
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {stats.contractAlerts.expiredCount > 0 &&
              `${stats.contractAlerts.expiredCount} hợp đồng lao động đã hết hạn. `}
            {stats.contractAlerts.expiringCount > 0 &&
              `${stats.contractAlerts.expiringCount} hợp đồng sẽ hết hạn trong ${stats.contractAlerts.alertDays} ngày tới.`}
          </span>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("hop-dong")}
              className="rounded-lg border border-current bg-white/70 px-2.5 py-1 text-[11px] font-bold"
            >
              Xem hợp đồng
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Section */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-3xs flex items-center gap-4 transition-all hover:shadow-xs">
          <div className="p-3.5 bg-cyan-50 text-cyan-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tổng lao động</p>
            <p className="mt-1 text-2xl font-black text-slate-850">
              {loading ? <span className="animate-pulse">...</span> : stats.totalWorkers}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-3xs flex items-center gap-4 transition-all hover:shadow-xs">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Đang hoạt động</p>
            <p className="mt-1 text-2xl font-black text-slate-850">
              {loading ? <span className="animate-pulse">...</span> : stats.activeWorkers}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-3xs flex items-center gap-4 transition-all hover:shadow-xs">
          <div className="p-3.5 bg-violet-50 text-violet-600 rounded-xl">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Dự án tiếp nhận</p>
            <p className="mt-1 text-2xl font-black text-slate-850">
              {loading ? <span className="animate-pulse">...</span> : stats.projects}
            </p>
          </div>
        </div>
      </section>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly Registration Chart */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-3xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">
                  Tình hình Đăng ký Lao động
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Số lượng lao động mới đăng ký theo từng tháng của năm {currentYear}
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-lg">
              Năm {currentYear}
            </span>
          </div>

          <div className="pt-6 pb-2">
            <div className="h-56 flex items-end justify-between gap-2 px-2 border-b border-slate-200 pb-2 relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                <div className="border-b border-slate-400 w-full" />
                <div className="border-b border-slate-400 w-full" />
                <div className="border-b border-slate-400 w-full" />
              </div>

              {monthlyRegistrations.map((count, idx) => {
                const heightPercent = Math.max(6, Math.round((count / maxRegCount) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative z-10">
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-8 bg-slate-900 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                      Tháng {idx + 1}: <strong>{count}</strong> lao động
                    </div>
                    <span className="text-[9px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors">
                      {count > 0 ? count : ""}
                    </span>
                    <div className="w-full max-w-[28px] bg-slate-50 rounded-t-lg overflow-hidden flex items-end h-full">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 group-hover:brightness-110 ${
                          count > 0
                            ? "bg-gradient-to-t from-indigo-650 to-cyan-500 shadow-md"
                            : "bg-slate-200/50"
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-2 px-2 pt-2">
              {months.map((m, idx) => (
                <div key={idx} className="flex-1 text-center text-[10px] font-bold text-slate-400">
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Status Breakdowns */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-3xs space-y-5 flex-1">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">
                  Trạng thái Lao động & Dự án
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Tỷ lệ phân bổ hiện tại trong hệ thống
                </p>
              </div>
            </div>

            {/* Workers status breakdown */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phân bổ lao động</h4>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {stats.totalWorkers > 0 ? (
                  <>
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${(stats.workersByStatus.active / stats.totalWorkers) * 100}%` }}
                      title={`Hoạt động: ${stats.workersByStatus.active}`}
                    />
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: `${(stats.workersByStatus.placed / stats.totalWorkers) * 100}%` }}
                      title={`Đã xuất khẩu/giao việc: ${stats.workersByStatus.placed}`}
                    />
                    <div
                      className="bg-slate-300 h-full"
                      style={{ width: `${(stats.workersByStatus.inactive / stats.totalWorkers) * 100}%` }}
                      title={`Không hoạt động: ${stats.workersByStatus.inactive}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-200 h-full" />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-bold">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
                  <span>Hoạt động: {stats.workersByStatus.active}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500 block" />
                  <span>Giao việc: {stats.workersByStatus.placed}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-350 block" />
                  <span>Nghỉ: {stats.workersByStatus.inactive}</span>
                </div>
              </div>
            </div>

            {/* Projects status breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái Dự án</h4>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                {stats.projects > 0 ? (
                  <>
                    <div
                      className="bg-indigo-500 h-full"
                      style={{ width: `${(stats.projectsByStatus.active / stats.projects) * 100}%` }}
                      title={`Đang chạy: ${stats.projectsByStatus.active}`}
                    />
                    <div
                      className="bg-amber-455 h-full"
                      style={{ width: `${(stats.projectsByStatus.planned / stats.projects) * 100}%` }}
                      title={`Lên kế hoạch: ${stats.projectsByStatus.planned}`}
                    />
                    <div
                      className="bg-sky-500 h-full"
                      style={{ width: `${(stats.projectsByStatus.completed / stats.projects) * 100}%` }}
                      title={`Hoàn thành: ${stats.projectsByStatus.completed}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-200 h-full" />
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-bold">
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 block" />
                  <span>Đang chạy: {stats.projectsByStatus.active}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-550">
                  <span className="w-2 h-2 rounded-full bg-amber-400 block" />
                  <span>Kế hoạch: {stats.projectsByStatus.planned}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-650">
                  <span className="w-2 h-2 rounded-full bg-sky-500 block" />
                  <span>Hoàn thành: {stats.projectsByStatus.completed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Project Quotas and Allocation */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-3xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">
              Phân bổ Nhân sự theo Dự án
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Tỷ lệ lao động tham gia so với chỉ tiêu (Quota) tuyển dụng của các dự án nổi bật
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-6 text-xs text-slate-400 font-bold uppercase animate-pulse">
            Đang tải dữ liệu phân bổ...
          </div>
        ) : stats.topProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            {stats.topProjects.map((p, idx) => {
              const percent = Math.min(100, p.quota > 0 ? Math.round((p.allocated / p.quota) * 100) : 0);
              return (
                <div key={idx} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-700 truncate max-w-[200px]" title={p.name}>
                      {p.name}
                    </span>
                    <span className="font-bold text-slate-500">
                      <strong>{p.allocated}</strong> / {p.quota} Chỉ tiêu ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percent >= 100
                          ? "bg-emerald-500"
                          : percent >= 75
                          ? "bg-indigo-500"
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
          <div className="text-center py-6 text-xs text-slate-400 font-bold">
            Chưa có dự án nào được gán chỉ tiêu lao động.
          </div>
        )}
      </section>
    </div>
  );
}
