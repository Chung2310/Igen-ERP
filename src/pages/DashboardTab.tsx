/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { LayoutDashboard, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { isModuleEnabled } from "../config/modules";
import { dashboardService } from "../services/dashboardService";
import { DashboardSummary, DashboardActionItems } from "../types/dashboard";
import { OverviewPanel } from "../components/dashboard/OverviewPanel";
import { RevenueAnalysisPanel } from "../components/dashboard/RevenueAnalysisPanel";

type DashboardView = "overview" | "revenue";

export default function DashboardTab() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  
  const canSeeHr = isModuleEnabled(userProfile?.enabledModules, "hr");
  const canSeeInventory = isModuleEnabled(userProfile?.enabledModules, "inventory");
  const canSeeResource = isModuleEnabled(userProfile?.enabledModules, "resource");
  const canSeeChat = isModuleEnabled(userProfile?.enabledModules, "chat");
  const canSeeStudent = isModuleEnabled(userProfile?.enabledModules, "student");

  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [actionItems, setActionItems] = useState<DashboardActionItems | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Poll summary data
  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;

    const loadSummary = () => {
      // Mặc định lấy theo ngày cho Dashboard tổng quan
      dashboardService
        .getSummary({ filter: "day" })
        .then((data) => {
          if (!cancelled) setSummary(data);
        })
        .catch((err) => {
          console.error("Lỗi tải dữ liệu tổng quan module:", err);
        });
    };

    loadSummary();
    const intervalId = setInterval(loadSummary, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userProfile?.uid, activeBranchId, refreshKey]);

  // Poll action items
  useEffect(() => {
    if (!userProfile) return;
    let cancelled = false;

    const loadActionItems = () => {
      dashboardService
        .getActionItems()
        .then((data) => {
          if (!cancelled) setActionItems(data);
        })
        .catch((err) => {
          console.error("Lỗi tải việc cần xử lý hôm nay:", err);
        });
    };

    loadActionItems();
    const intervalId = setInterval(loadActionItems, 30000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [userProfile?.uid, activeBranchId, refreshKey]);

  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-h-[85vh] max-w-[1600px] overflow-y-auto px-0.5 pb-6 text-left sm:pr-2" id="dashboard_tab_view">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <div className="h-5 w-1 shrink-0 self-center rounded-full bg-[#00ADFC]" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Tổng quan
          </h1>
          <p className="text-xs font-medium text-slate-500">Hôm nay, {todayLabel}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1 overflow-x-auto select-none rounded-xl bg-slate-100/70 p-1">
            <button
              onClick={() => setActiveView("overview")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                activeView === "overview"
                  ? "bg-[#00ADFC] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-[#007EB8] hover:bg-[#E8F7FF] font-semibold"
              }`}
            >
              <LayoutDashboard className={`h-4 w-4 ${activeView === "overview" ? "text-white" : "text-slate-400"}`} />
              <span>Tổng quan</span>
            </button>
            <button
              onClick={() => setActiveView("revenue")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                activeView === "revenue"
                  ? "bg-[#00ADFC] text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-[#007EB8] hover:bg-[#E8F7FF] font-semibold"
              }`}
            >
              <TrendingUp className={`h-4 w-4 ${activeView === "revenue" ? "text-white" : "text-slate-400"}`} />
              <span>Phân tích doanh thu</span>
            </button>
          </div>
        </div>
      </div>

      {activeView === "overview" ? (
        <OverviewPanel
          summary={summary}
          actionItems={actionItems}
          canSeeHr={canSeeHr}
          canSeeStudent={canSeeStudent}
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey((key) => key + 1)}
        />
      ) : (
        <RevenueAnalysisPanel />
      )}
    </div>
  );
}
