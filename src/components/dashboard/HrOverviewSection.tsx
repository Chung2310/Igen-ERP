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
import { yesterday } from "./OverviewChartSummary";
import { OverviewPeriodActions, useOverviewPeriod } from "./OverviewPeriodContext";
import { previousComparisonRange } from "./overviewComparison";

export default function HrOverviewSection() {
  const { userProfile, hasPermission } = useAuth();
  const branchContext = useBranchOptional();
  const activeBranchId = branchContext?.activeBranchId;
  const overviewPeriod = useOverviewPeriod();
  const selectedFrom = overviewPeriod?.from;
  const selectedTo = overviewPeriod?.to;
  const selectedPeriod = overviewPeriod?.selection;
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
      const startDate = selectedFrom || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const endDate = selectedTo || now.toLocaleDateString("en-CA");
      const previous = previousComparisonRange(startDate, endDate, selectedPeriod || "month");
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
  }, [activeBranchId, canSeeRecruitment, canSeeTimekeeping, userProfile?.companyCode, selectedFrom, selectedTo, selectedPeriod]);

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
      <OverviewPeriodActions>
        <h2 className="sr-only">Tổng quan Nhân sự</h2>
        <ErpRefreshButton onClick={loadData} loading={loading} />
      </OverviewPeriodActions>

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
