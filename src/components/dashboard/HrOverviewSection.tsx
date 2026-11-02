import React, { useEffect, useState, useCallback } from "react";
import { HrOverviewDashboard } from "./HrOverviewDashboard";
import { dashboardService } from "../../services/dashboardService";
import { useAuth } from "../../context/AuthContext";
import { useBranchOptional } from "../../context/BranchContext";
import type { DashboardSummary } from "../../types/dashboard";
import { RotateCcw } from "lucide-react";

export default function HrOverviewSection() {
  const { userProfile, hasPermission } = useAuth();
  const branchContext = useBranchOptional();
  const activeBranchId = branchContext?.activeBranchId;
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      const data = await dashboardService.getSummary(
        { filter: "custom", startDate, endDate },
        { branchId: activeBranchId }
      );
      setSummary(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

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
            <h2 className="text-xl font-semibold text-slate-900">Tổng quan Nhân sự</h2>
            <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
              {branchName}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Theo dõi quân số, chấm công và cảnh báo hợp đồng tháng này
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 text-xs font-medium shadow-xs hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 cursor-pointer"
        >
          <RotateCcw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </header>

      <HrOverviewDashboard
        summary={summary}
        employeeCount={employeeCount}
        newEmployeeCount={null}
        employeeScope={branchName}
        loading={loading}
        error={error}
        canSeeTimekeeping={canSeeTimekeeping}
        canSeeRecruitment={canSeeRecruitment}
      />
    </div>
  );
}
