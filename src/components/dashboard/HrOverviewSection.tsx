import React, { useEffect, useState, useCallback } from "react";
import { HrOverviewDashboard } from "./HrOverviewDashboard";
import { dashboardService } from "../../services/dashboardService";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import type { DashboardSummary } from "../../types/dashboard";
import { ErpRefreshButton } from "../common/ErpRefreshButton";
import { hrDepartmentService, type HrDepartment } from "../../services/hrDepartmentService";
import { recruitmentApi } from "../../services/recruitmentService";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../types/recruitment";
import { previousCalendarMonth, yesterday } from "./OverviewChartSummary";

export default function HrOverviewSection() {
  const { userProfile, hasPermission } = useAuth();
  const branchContext = useBranchOptional();
  const activeBranchId = branchContext?.activeBranchId;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<DashboardSummary | null>(null);
  const [yesterdayAttendance, setYesterdayAttendance] = useState<{ checkedIn: number; late: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [departments, setDepartments] = useState<HrDepartment[] | null>(null);
  const [applicants, setApplicants] = useState<RecruitmentApplicant[] | null>(null);
  const [jobs, setJobs] = useState<RecruitmentJob[] | null>(null);
  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);

  const isManager =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";
  const canSeeTimekeeping = isManager || hasPermission("timekeeping:read") || hasPermission("timekeeping:manage");
  const canSeeRecruitment = isManager || hasPermission("recruitment:read") || hasPermission("recruitment:manage");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const now = new Date();
      const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const previous = previousCalendarMonth(now);
      const results = await Promise.allSettled([
        dashboardService.getSummary({ filter: "custom", startDate, endDate }, { branchId: activeBranchId }),
        dashboardService.getSummary({ filter: "custom", startDate: previous.from, endDate: previous.to }, { branchId: activeBranchId }),
        canSeeTimekeeping ? dashboardService.getAttendanceForDate(yesterday(now), { branchId: activeBranchId }) : Promise.resolve(null),
        userProfile?.companyCode ? hrDepartmentService.list(userProfile.companyCode) : Promise.resolve([]),
        canSeeRecruitment ? recruitmentApi.listApplicants() : Promise.resolve([]),
        canSeeRecruitment ? recruitmentApi.listJobs() : Promise.resolve([]),
        canSeeRecruitment ? recruitmentApi.getPipeline() : Promise.resolve(null),
      ] as const);
      if (results[0].status === "fulfilled") setSummary(results[0].value); else { setSummary(null); setError(true); }
      setPreviousSummary(results[1].status === "fulfilled" ? results[1].value : null);
      setYesterdayAttendance(results[2].status === "fulfilled" ? results[2].value : null);
      setDepartments(results[3].status === "fulfilled" ? results[3].value : null);
      setApplicants(results[4].status === "fulfilled" ? results[4].value : null);
      setJobs(results[5].status === "fulfilled" ? results[5].value : null);
      setPipeline(results[6].status === "fulfilled" ? results[6].value : null);
      if (results.some(result => result.status === "rejected")) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, canSeeRecruitment, canSeeTimekeeping, userProfile?.companyCode]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const employeeCount = summary?.timekeeping?.totalEmployees ?? null;
  const branchName = branchContext?.activeBranch?.name || userProfile?.branchName || "Toàn công ty";

  return (
    <div className="space-y-5 text-left text-on-surface">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-5 w-1 rounded-sm bg-primary" />
            <h2 className="text-balance text-lg font-semibold text-on-surface">Tổng quan Nhân sự</h2>
            <span className="rounded-md bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface-variant">
              {branchName}
            </span>
          </div>
          <p className="mt-1 text-pretty text-xs text-on-surface-variant">
            Theo dõi quân số, chấm công, đào tạo, tuyển dụng và việc cần xử lý
          </p>
        </div>
        <ErpRefreshButton onClick={loadData} loading={loading} />
      </header>

      <HrOverviewDashboard
        summary={summary}
        previousSummary={previousSummary}
        yesterdayAttendance={yesterdayAttendance}
        employeeCount={employeeCount}
        employeeScope={branchName}
        loading={loading}
        error={error}
        canSeeTimekeeping={canSeeTimekeeping}
        canSeeRecruitment={canSeeRecruitment}
        departments={departments}
        applicants={applicants}
        jobs={jobs}
        pipeline={pipeline}
      />
    </div>
  );
}
