import { useEffect, useState } from "react";
import { CalendarDays, RotateCcw, UsersRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { isModuleEnabled } from "../config/modules";
import { dashboardService } from "../services/dashboardService";
import { authService } from "../services/authService";
import { AdminDatePicker } from "../components/user-admin/AdminDatePicker";
import { countNewEmployeesInPeriod, localDateKey, type HrDashboardPeriod } from "../components/dashboard/hrDashboardPeriod";
import type { UserProfile } from "../types";
import type { DashboardSummary } from "../types/dashboard";
import { HrOverviewDashboard } from "../components/dashboard/HrOverviewDashboard";

export default function DashboardTab() {
  const { userProfile, hasPermission } = useAuth();
  const { activeBranchId } = useBranch();
  
  const canSeeHr = isModuleEnabled(userProfile?.enabledModules, "hr") &&
    (userProfile?.role === "superadmin" || hasPermission("hr:read"));
  const canSeeTimekeeping = userProfile?.role === "superadmin" ||
    (Boolean(userProfile?.enabledModules?.includes("timekeeping") || !userProfile?.enabledModules?.length) &&
      hasPermission("timekeeping:read"));
  const canSeeRecruitment = userProfile?.role === "superadmin" || userProfile?.role === "admin" ||
    hasPermission("recruitment:read") || hasPermission("recruitment:manage");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [employees, setEmployees] = useState<UserProfile[] | null>(null);
  const [period, setPeriod] = useState<HrDashboardPeriod>("month");
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!userProfile || !canSeeHr) return;
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const data = await dashboardService.getSummary({ filter: "day" });
        if (!cancelled) {
          setSummary(data);
          setError(false);
        }
      } catch (err) {
        console.error("Lỗi tải tổng quan nhân sự:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadSummary();
    const intervalId = window.setInterval(() => void loadSummary(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [userProfile, activeBranchId, refreshKey, canSeeHr]);

  useEffect(() => {
    if (!userProfile || !canSeeHr) return;
    let cancelled = false;
    const loadEmployees = async () => {
      try {
        const users = userProfile.role === "superadmin"
          ? await authService.getAllUsers()
          : await authService.getUsersByCompany(userProfile.companyCode || "SYSTEM", activeBranchId || undefined);
        if (!cancelled) setEmployees(users.filter((user) => user.role !== "superadmin"));
      } catch (err) {
        console.error("Lỗi tải số nhân sự:", err);
        if (!cancelled) setEmployees(null);
      }
    };
    void loadEmployees();
    return () => { cancelled = true; };
  }, [userProfile, activeBranchId, refreshKey, canSeeHr]);

  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const newEmployeeCount = countNewEmployeesInPeriod(employees, period, selectedDate);
  const periodOptions: Array<{ value: HrDashboardPeriod; label: string }> = [
    { value: "today", label: "Hôm nay" },
    { value: "week", label: "Tuần này" },
    { value: "month", label: "Tháng này" },
    { value: "year", label: "Năm nay" },
  ];

  return (
    <div className="mx-auto max-h-[85vh] max-w-[1600px] overflow-y-auto px-0.5 pb-8 text-left sm:pr-2" id="dashboard_tab_view">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#E5F6FF] text-[#0095D9]">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#143963]">Tổng quan nhân sự</h1>
            <p className="mt-0.5 text-xs text-slate-500">{todayLabel}</p>
          </div>
        </div>
        {canSeeHr && <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm text-[#007EB8] shadow-sm transition hover:bg-[#E8F7FF] focus-visible:outline-2 focus-visible:outline-[#00ADFC]" aria-label="Làm mới tổng quan nhân sự"><RotateCcw className="h-4 w-4" /> Làm mới</button>}
      </div>
      {canSeeHr && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2.5 shadow-[0_5px_20px_rgba(27,66,100,0.04)]">
          <span className="flex items-center gap-1.5 px-2 text-xs font-medium text-[#143963]"><CalendarDays className="h-4 w-4 text-[#0095D9]" /> Nhân sự mới</span>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#F3F8FC] p-1" role="group" aria-label="Lọc nhân sự mới theo thời gian">
            {periodOptions.map((option) => (
              <button key={option.value} type="button" aria-pressed={period === option.value} onClick={() => setPeriod(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ADFC] ${period === option.value ? "bg-[#00ADFC] font-medium text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#007EB8]"}`}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="min-w-[164px] [&>div>span]:sr-only [&>div>button]:min-h-9 [&>div>button]:bg-[#F3F8FC]">
            <AdminDatePicker label="Chọn ngày" value={period === "date" ? selectedDate : ""} max={localDateKey(new Date())}
              onChange={(value) => { if (value) { setSelectedDate(value); setPeriod("date"); } }} />
          </div>
          <span className="ml-auto px-2 text-[11px] text-slate-400">Công việc và đào tạo: hiện tại</span>
        </div>
      )}
      {!canSeeHr ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Bạn chưa được cấp quyền xem tổng quan nhân sự.</div> : <HrOverviewDashboard summary={summary} employeeCount={employees?.length ?? null} newEmployeeCount={newEmployeeCount} employeeScope={activeBranchId ? "Trong chi nhánh" : "Trong công ty"} loading={loading} error={error} canSeeTimekeeping={canSeeTimekeeping} canSeeRecruitment={canSeeRecruitment} />}
    </div>
  );
}
