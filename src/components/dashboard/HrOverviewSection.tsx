import React, { useEffect, useState, useCallback } from "react";
import { HrOverviewDashboard } from "./HrOverviewDashboard";
import { dashboardService } from "../../services/dashboardService";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import type { DashboardSummary } from "../../types/dashboard";
import { recruitmentApi } from "../../services/recruitmentService";
import type { RecruitmentApplicant, RecruitmentJob, RecruitmentPipeline } from "../../types/recruitment";
import { yesterday } from "./OverviewChartSummary";
import { useOverviewPeriod } from "./OverviewPeriodContext";
import { previousComparisonRange } from "./overviewComparison";
import { authService } from "../../services/authService";
import { summarizeDepartmentPayroll, type DepartmentPayrollRow } from "./hrPayrollOverview";

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
  const [applicants, setApplicants] = useState<RecruitmentApplicant[] | null>(null);
  const [jobs, setJobs] = useState<RecruitmentJob[] | null>(null);
  const [pipeline, setPipeline] = useState<RecruitmentPipeline | null>(null);
  const [payrollRows, setPayrollRows] = useState<DepartmentPayrollRow[] | null>(null);
  const [enterpriseCount, setEnterpriseCount] = useState<number | null>(null);

  const isManager =
    userProfile?.role === "superadmin" ||
    userProfile?.role === "admin" ||
    userProfile?.role === "manager";
  const canSeeTimekeeping = isManager || hasPermission("timekeeping:read") || hasPermission("timekeeping:manage");
  const canSeeRecruitment = isManager || hasPermission("recruitment:read") || hasPermission("recruitment:manage");
  const canSeePayroll = (userProfile?.role === "superadmin" || userProfile?.role === "admin" || hasPermission("payroll-period:read") || hasPermission("payroll-period:manage"))
    && (userProfile?.role === "superadmin" || userProfile?.role === "admin" || hasPermission("hr:read") || hasPermission("access:read"));
  const companyCode = userProfile?.companyCode;

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
        canSeeRecruitment ? recruitmentApi.listApplicants(undefined, activeBranchId) : Promise.resolve([]),
        canSeeRecruitment ? recruitmentApi.listJobs(undefined, activeBranchId) : Promise.resolve([]),
        canSeeRecruitment ? recruitmentApi.getPipeline(activeBranchId) : Promise.resolve(null),
        companyCode ? authService.getUsersByCompany(companyCode) : Promise.resolve(null),
      ] as const);
      if (results[0].status === "fulfilled") setSummary(results[0].value); else { setSummary(null); setError(true); }
      setPreviousSummary(results[1].status === "fulfilled" ? results[1].value : null);
      setYesterdayAttendance(results[2].status === "fulfilled" ? results[2].value : null);
      setApplicants(results[3].status === "fulfilled" ? results[3].value : null);
      setJobs(results[4].status === "fulfilled" ? results[4].value : null);
      setPipeline(results[5].status === "fulfilled" ? results[5].value : null);
      setEnterpriseCount(results[6].status === "fulfilled" && results[6].value
        ? results[6].value.filter(employee => employee.role !== "superadmin").length
        : null);
      if (results.slice(0, 6).some(result => result.status === "rejected")) setError(true);
      if (canSeePayroll && companyCode) {
        try {
          const employees = await authService.getUsersByCompany(companyCode, activeBranchId);
          setPayrollRows(summarizeDepartmentPayroll(employees));
        } catch {
          setPayrollRows(null);
        }
      } else setPayrollRows(null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, canSeeRecruitment, canSeeTimekeeping, canSeePayroll, companyCode, selectedFrom, selectedTo, selectedPeriod]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  const employeeCount = summary?.timekeeping?.employeesExistingAtRangeEnd
    ?? (summary?.personnelNow?.departmentHeadcounts.length ? summary.personnelNow.departmentHeadcounts.reduce((sum, row) => sum + row.value, 0) : null)
    ?? summary?.timekeeping?.totalEmployees ?? null;
  const branchName = branchContext?.activeBranch?.name || userProfile?.branchName || "Toàn công ty";

  return (
    <div className="text-left text-on-surface">
      <h2 className="sr-only">Tổng quan Nhân sự</h2>

      <HrOverviewDashboard
        summary={summary}
        previousSummary={previousSummary}
        yesterdayAttendance={yesterdayAttendance}
        employeeCount={employeeCount}
        employeeScope={branchName}
        enterpriseCount={enterpriseCount ?? (!activeBranchId ? summary?.timekeeping.totalEmployees ?? null : null)}
        branchEmployeeCount={canSeeTimekeeping ? summary?.timekeeping.totalEmployees ?? null : employeeCount}
        hasActiveBranch={Boolean(activeBranchId)}
        loading={loading}
        error={error}
        canSeeTimekeeping={canSeeTimekeeping}
        canSeeRecruitment={canSeeRecruitment}
        applicants={applicants}
        jobs={jobs}
        pipeline={pipeline}
        payrollRows={canSeePayroll ? payrollRows : undefined}
      />
    </div>
  );
}
