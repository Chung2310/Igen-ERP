import React, { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, FileText, FolderOpen, GraduationCap, RefreshCw, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { dashboardService } from "../services/dashboardService";
import type { DashboardActionItems, DashboardDateFilter, DashboardSummary } from "../types/dashboard";
import { toast } from "./Toast";
const C = { indigo: "#4f46e5", emerald: "#059669", amber: "#f59e0b", rose: "#e11d48", slate: "#64748b" };
const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="mb-5 text-sm font-black uppercase tracking-wide text-slate-700">{title}</h2>
    {children}
  </section>
);
const Kpi = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-3">
      <span className="rounded-xl p-2.5" style={{ color, backgroundColor: `${color}15` }}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    </div>
    <div className="mt-4 text-3xl font-black text-slate-800">{value}</div>
  </div>
);
export default function DashboardTab() {
  const { userProfile } = useAuth();
  const [filter, setFilter] = useState<DashboardDateFilter>("day");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [actions, setActions] = useState<DashboardActionItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [s, a] = await Promise.all([dashboardService.getSummary({ filter }), dashboardService.getActionItems()]);
      setSummary(s);
      setActions(a);
    } catch (e) {
      setLoadFailed(true);
      toast.error((e as Error)?.message || "Không thể tải dữ liệu tổng quan.", { title: "Tải dữ liệu thất bại" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  const tasks = useMemo(
    () =>
      summary
        ? [
            { name: "Chưa làm", value: summary.projects?.tasks?.todo ?? 0 },
            { name: "Đang làm", value: summary.projects?.tasks?.doing ?? 0 },
            { name: "Hoàn thành", value: summary.projects?.tasks?.done ?? 0 },
          ]
        : [],
    [summary],
  );
  const training = useMemo(
    () =>
      summary
        ? [
            { name: "Chưa bắt đầu", value: summary.training?.enrollments?.notStarted ?? 0 },
            { name: "Đang học", value: summary.training?.enrollments?.inProgress ?? 0 },
            { name: "Hoàn thành", value: summary.training?.enrollments?.completed ?? 0 },
          ]
        : [],
    [summary],
  );
  const attendance = useMemo(
    () =>
      summary
        ? [
            {
              name: "Đúng giờ",
              value: Math.max(0, (summary.timekeeping?.checkedInToday ?? 0) - (summary.timekeeping?.lateToday ?? 0)),
            },
            { name: "Đi muộn", value: summary.timekeeping?.lateToday ?? 0 },
            {
              name: "Chưa chấm",
              value: Math.max(
                0,
                (summary.timekeeping?.totalEmployees ?? 0) - (summary.timekeeping?.checkedInToday ?? 0),
              ),
            },
          ]
        : [],
    [summary],
  );
  const allowed =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.permissions?.includes("*") ||
    userProfile?.permissions?.includes("dashboard:read");
  if (!allowed) return <main className="p-8 text-center text-slate-500">Bạn không có quyền xem Tổng quan.</main>;
  const items = [
    ...(actions?.overdueTasks || []).map((x) => ({
      label: `Quá hạn: ${x.title}`,
      meta: x.dueDate,
      color: "text-rose-600",
    })),
    ...(actions?.pendingApprovals || []).map((x) => ({
      label: `Chờ duyệt: ${x.employeeName}`,
      meta: x.since,
      color: "text-amber-600",
    })),
  ];
  return (
    <main className="h-full overflow-y-auto space-y-6 bg-slate-50 p-4 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Tổng quan doanh nghiệp</h1>
          <p className="mt-1 text-sm text-slate-500">Số liệu từ các module đang hoạt động.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as DashboardDateFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="day">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="year">Năm nay</option>
          </select>
          <button onClick={load} className="rounded-xl border bg-white p-2.5 text-slate-600" title="Làm mới">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </button>
        </div>
      </div>
      {loadFailed && !loading && !summary && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <button type="button" onClick={load} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Thử lại</button>
        </div>
      )}
      {loading && !summary ? (
        <div className="rounded-2xl bg-white p-12 text-center text-sm text-slate-500">
          Đang tải dữ liệu tổng quan...
        </div>
      ) : (
        summary && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi
                icon={Users}
                label="Nhân sự đi làm"
                value={`${summary.timekeeping?.checkedInToday ?? 0}/${summary.timekeeping?.totalEmployees ?? 0}`}
                color={C.emerald}
              />
              <Kpi icon={Activity} label="Task đang làm" value={summary.projects?.tasks?.doing ?? 0} color={C.indigo} />
              <Kpi icon={Clock3} label="Task quá hạn" value={summary.projects?.overdueTasks ?? 0} color={C.rose} />
              <Kpi
                icon={GraduationCap}
                label="Khóa đào tạo"
                value={summary.training?.totalCourses ?? 0}
                color={C.amber}
              />
              <Kpi
                icon={FolderOpen}
                label="Tổng file"
                value={(summary.resources?.fileCount ?? 0).toLocaleString("vi-VN")}
                color={C.slate}
              />
              <Kpi
                icon={FileText}
                label="Thiết bị"
                value={(summary.equipment?.total ?? 0).toLocaleString("vi-VN")}
                color={C.indigo}
              />

            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel title="Trạng thái công việc">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={tasks}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" name="Số task" fill={C.indigo} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Chấm công hôm nay">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={attendance} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={88} label>
                      {attendance.map((_, i) => (
                        <Cell key={i} fill={[C.emerald, C.amber, "#cbd5e1"][i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Tiến độ đào tạo">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={training} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={85} />
                    <Tooltip />
                    <Bar dataKey="value" name="Lượt ghi danh" fill={C.amber} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>
              <Panel title="Tài nguyên">
                <div className="grid h-[280px] place-content-center gap-5 text-center sm:grid-cols-2">
                  <div>
                    <FileText className="mx-auto h-8 w-8 text-indigo-500" />
                    <div className="mt-2 text-3xl font-black">
                      {(summary.resources?.fileCount ?? 0).toLocaleString("vi-VN")}
                    </div>
                    <div className="text-xs text-slate-500">Tổng số file</div>
                  </div>
                  <div>
                    <FolderOpen className="mx-auto h-8 w-8 text-emerald-500" />
                    <div className="mt-2 text-3xl font-black">+{summary.resources?.recentUploads ?? 0}</div>
                    <div className="text-xs text-slate-500">Tải lên trong kỳ</div>
                  </div>
                </div>
              </Panel>
            </div>
            <Panel title="Việc cần xử lý">
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <CheckCircle2 className={`h-5 w-5 ${item.color}`} />
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.meta}</div>
                    </div>
                  </div>
                ))}
                {!items.length && <div className="text-sm text-slate-500">Không có việc cần xử lý.</div>}
              </div>
            </Panel>
          </>
        )
      )}
    </main>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function getTimekeepingStatusDisplay(
  isCheckedIn: boolean,
  _isLoading: boolean,
  checkInStatus: string | undefined,
  calendar: { date: string; isWorkingDay: boolean; label?: string } | null,
) {
  if (isCheckedIn) {
    const statusLabel = checkInStatus === "Late" ? "Muộn" : checkInStatus;
    return {
      statusText: `Đã check-in${statusLabel ? ` (${statusLabel})` : ""}`,
      statusColor: checkInStatus === "Late" ? "bg-amber-500" : "bg-emerald-500",
    };
  }
  if (calendar && !calendar.isWorkingDay)
    return { statusText: calendar.label || "Ngày nghỉ", statusColor: "bg-slate-400" };
  return { statusText: "Chưa chấm công", statusColor: "bg-rose-500" };
}
