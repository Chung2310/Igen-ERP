import { useEffect, useMemo, useState } from "react";
import { CalendarDays, UsersRound, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { isModuleEnabled } from "../config/modules";
import { dashboardService } from "../services/dashboardService";
import { authService } from "../services/authService";
import { hrDepartmentService } from "../services/hrDepartmentService";
import { AdminDatePicker } from "../components/user-admin/AdminDatePicker";
import { EnterpriseOverviewDashboard } from "../components/dashboard/EnterpriseOverviewDashboard";
import { PersonnelToday } from "../components/dashboard/PersonnelToday";
import { countCreatedInRange, getDashboardRange, localDateKey, type DashboardPeriod } from "../components/dashboard/dashboardPeriod";
import type { UserProfile } from "../types";
import type { DashboardSummary } from "../types/dashboard";
const summaryCache = new Map<string, { at: number; data: DashboardSummary }>();

const options: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Hôm nay" }, { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" }, { value: "year", label: "Năm nay" },
  { value: "custom", label: "Khoảng ngày" },
];

function GreetingIcon({ timeOfDay }: { timeOfDay: "morning" | "day" | "night" }) {
  if (timeOfDay === "morning") return <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-5 w-5">
    <circle cx="16" cy="16" r="6" fill="#FFBA4A" />
    <path d="M16 2.5v4M16 25.5v4M2.5 16h4M25.5 16h4M6.45 6.45l2.85 2.85m13.4 13.4 2.85 2.85M25.55 6.45 22.7 9.3M9.3 22.7l-2.85 2.85" stroke="#F49226" strokeWidth="2" strokeLinecap="round" />
  </svg>;
  if (timeOfDay === "day") return <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-5 w-5">
    <circle cx="12" cy="11" r="5.2" fill="#FFBA4A" />
    <path d="M12 2v2M3 11h2M5.6 4.6 7 6m10-1.4L15.6 6" stroke="#F49226" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8 25h16a4 4 0 0 0 .5-7.97 6.5 6.5 0 0 0-12.4-1.3A4.7 4.7 0 0 0 8 25Z" fill="#E5F5FF" stroke="#078DED" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>;
  return <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-5 w-5">
    <path d="M23.6 20.6A10.5 10.5 0 0 1 11.4 8.4 10.5 10.5 0 1 0 23.6 20.6Z" fill="#6D69D9" />
    <path d="M24.5 4.5v5m-2.5-2.5h5M28 13v3m-1.5-1.5h3" stroke="#8D8AF0" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

export default function BusinessDashboardTab() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const canSeeHr = isModuleEnabled(userProfile?.enabledModules, "hr") &&
    (userProfile?.role === "superadmin" || hasPermission("hr:read"));
  const canSeeTimekeeping = canSeeHr && (userProfile?.role === "superadmin" || hasPermission("timekeeping:read"));
  const canApproveLeave = canSeeHr && (userProfile?.role === "superadmin" || hasPermission("timekeeping:manage"));
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [employees, setEmployees] = useState<UserProfile[] | null>(null);
  const [departmentCount, setDepartmentCount] = useState<number | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [fromDate, setFromDate] = useState(() => localDateKey(new Date()));
  const [toDate, setToDate] = useState(() => localDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const range = useMemo(() => getDashboardRange(period, fromDate, toDate), [period, fromDate, toDate]);
  const start = range.valid ? localDateKey(range.start) : "";
  const end = range.valid ? localDateKey(range.end) : "";
  const userId = userProfile?.uid;
  const companyCode = userProfile?.companyCode;
  const role = userProfile?.role;
  const cacheKey = JSON.stringify([userId, companyCode, activeBranchId, start, end, userProfile?.role, userProfile?.permissions, localStorage.getItem('accessToken')]);

  useEffect(() => {
    if (!userId || !range.valid || !canSeeHr) return;
    let cancelled = false;
    let busy = false;
    const controller = new AbortController();
    const cached = summaryCache.get(cacheKey);
    let hasData = Boolean(cached && Date.now() - cached.at < 30000 && refreshKey === 0);
    const load = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const data = await dashboardService.getSummary({ filter: "custom", startDate: start, endDate: end }, { signal: controller.signal, branchId: activeBranchId || undefined });
        if (!cancelled) {
          hasData = true;
          summaryCache.delete(cacheKey); summaryCache.set(cacheKey, { at: Date.now(), data });
          if (summaryCache.size > 8) summaryCache.delete(summaryCache.keys().next().value!);
          setSummary(data); setError(false); setRefreshError('');
        }
      } catch (err) {
        console.error("Lỗi tải tổng quan doanh nghiệp:", err);
        if (!cancelled) { setError(!hasData); setRefreshError(hasData ? 'Chưa cập nhật được số liệu mới. Đang hiển thị dữ liệu đã tải; bạn có thể bấm Làm mới.' : ''); }
      } finally { busy = false; if (!cancelled) setLoading(false); }
    };
    // Let StrictMode cleanup cancel its first pass before starting a request.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setSummary(hasData ? cached!.data : null);
      setLoading(!hasData); setError(false); setRefreshError('');
      if (!hasData) void load();
    });
    const intervalId = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { cancelled = true; controller.abort(); window.clearInterval(intervalId); };
  }, [userId, activeBranchId, cacheKey, refreshKey, range.valid, start, end, canSeeHr]);

  useEffect(() => {
    if (!userId || !canSeeHr) return;
    let cancelled = false;
    const load = async () => {
      try {
        const users = role === "superadmin" ? await authService.getAllUsers() :
          await authService.getUsersByCompany(companyCode || "SYSTEM", activeBranchId || undefined);
        if (!cancelled) setEmployees(users.filter((person) => person.role !== "superadmin"));
      } catch (err) {
        console.error("Lỗi tải nhân sự tổng quan:", err);
        if (!cancelled) setEmployees(null);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [userId, companyCode, role, activeBranchId, refreshKey, canSeeHr]);

  useEffect(() => {
    const companyCode = userProfile?.companyCode;
    if (!companyCode || !canSeeHr) return;
    let cancelled = false;
    hrDepartmentService.list(companyCode)
      .then((departments) => { if (!cancelled) setDepartmentCount(departments.length); })
      .catch(() => { if (!cancelled) setDepartmentCount(null); });
    return () => { cancelled = true; };
  }, [userProfile?.companyCode, activeBranchId, refreshKey, canSeeHr]);

  const employeeCount = range.valid ? countCreatedInRange(employees, range.start, range.end) : null;
  const todayLabel = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hour = new Date().getHours();
  const timeOfDay = hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 18 ? "day" : "night";
  const greeting = timeOfDay === "morning" ? "Chào buổi sáng" : hour < 14 && hour >= 11 ? "Chào buổi trưa" : timeOfDay === "day" ? "Chào buổi chiều" : "Chào buổi tối";
  const greetingName = userProfile?.displayName?.trim().split(/\s+/).slice(-2).join(" ") || "bạn";
  return <div className="mx-auto max-h-[85vh] max-w-[1600px] overflow-y-auto px-0.5 pb-8 text-left sm:pr-2" id="dashboard_tab_view">
    {refreshError && <p role="status" className="mb-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-pretty text-sm text-on-surface-variant [--color-on-surface-variant:var(--color-slate-600)]">{refreshError}</p>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-[18px] bg-[#E5F3FF] text-[#078DED]"><UsersRound className="h-6 w-6" /></span>
        <div><h1 className="text-xl font-semibold tracking-tight text-[#143963]">Tổng quan nhân sự</h1><p className="mt-0.5 text-xs text-slate-600">{activeBranchId ? activeBranch?.name || userProfile?.branchName || "Chi nhánh" : "Toàn doanh nghiệp"} · {todayLabel}</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#355271]"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/80"><GreetingIcon timeOfDay={timeOfDay} /></span><span>{greeting}, <span className="font-semibold text-[#008FE3]">{greetingName}</span>! Chúc bạn làm việc hiệu quả.</span></p></div></div>
      <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm text-[#075B98] shadow-sm hover:bg-[#E8F7FF] focus-visible:outline-2 focus-visible:outline-[#00ADFC]"><RotateCcw className="h-4 w-4" /> Làm mới</button>
    </div>
    {canSeeHr && <PersonnelToday summary={summary} employees={employees} departmentCount={departmentCount} canSeeTimekeeping={canSeeTimekeeping} canApproveLeave={canApproveLeave} loading={loading} error={error} />}
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-[#143963]"><CalendarDays className="h-4 w-4 text-[#0095D9]" />Thống kê theo kỳ</h2>
      <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-[0_5px_20px_rgba(27,66,100,0.04)]" role="group" aria-label="Lọc thống kê nhân sự theo thời gian">
        {options.map((option) => <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => setPeriod(option.value)}
          className={`rounded-lg px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ADFC] ${period === option.value ? "bg-[#00ADFC] font-medium text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#007EB8]"}`}>{option.label}</button>)}
      </div>
      {period === "custom" ? <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-2 py-1 shadow-[0_5px_20px_rgba(27,66,100,0.04)]">
        <div className="min-w-[150px] [&>div>button]:min-h-9 [&>div>button]:bg-[#F3F8FC]"><AdminDatePicker label="Từ ngày" value={fromDate} max={toDate} onChange={setFromDate} /></div>
        <span className="text-xs text-slate-400">đến</span>
        <div className="min-w-[150px] [&>div>button]:min-h-9 [&>div>button]:bg-[#F3F8FC]"><AdminDatePicker label="Đến ngày" value={toDate} min={fromDate} onChange={setToDate} /></div>
      </div> : <span className="ml-auto flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-[#355271] shadow-[0_5px_20px_rgba(27,66,100,0.04)]"><CalendarDays className="h-4 w-4 text-[#078DED]" />Từ {range.start.toLocaleDateString("vi-VN")} đến {range.end.toLocaleDateString("vi-VN")}</span>}
      {!range.valid && <span role="alert" className="px-2 text-xs text-rose-600">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</span>}
    </div>
    {canSeeHr ? <EnterpriseOverviewDashboard summary={summary} employeeCount={employeeCount} employees={employees} period={period} rangeStart={range.start} rangeEnd={range.end} loading={loading} error={error} /> :
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Bạn chưa có quyền xem thống kê nhân sự.</div>}
  </div>;
}
