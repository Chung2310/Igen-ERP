/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  }, [userProfile?.uid]);

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
  }, [userProfile?.uid]);

  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="mx-auto max-h-[85vh] max-w-7xl overflow-y-auto px-0.5 pb-4 text-left sm:pr-2" id="dashboard_tab_view">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-cyan-600 rounded-full shrink-0" />
            <div>
              <h1 className="font-extrabold text-xl md:text-2xl tracking-tight text-cyan-700 dark:text-cyan-400">
                Tổng quan Doanh nghiệp
              </h1>
              <p className="text-xs text-slate-500 font-medium">Hôm nay, {todayLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 border-b border-slate-200/80 pb-0 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1.5 overflow-x-auto select-none pb-1">
            <button
              onClick={() => setActiveView("overview")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                activeView === "overview"
                  ? "bg-cyan-600 text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
              }`}
            >
              <LayoutDashboard className={`h-4 w-4 ${activeView === "overview" ? "text-white" : "text-slate-400"}`} />
              <span>Tổng quan</span>
            </button>
            <button
              onClick={() => setActiveView("revenue")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-all duration-200 cursor-pointer shrink-0 rounded-xl ${
                activeView === "revenue"
                  ? "bg-cyan-600 text-white font-bold shadow-sm"
                  : "text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 font-semibold"
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
        />
      ) : (
        <RevenueAnalysisPanel />
      )}
    </div>
  );
}
