import React, { useState, useEffect } from "react";
import { BarChart3, PieChart, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { BarChart, DonutCard } from "./DashboardWidgets";
import { formatDashboardCurrency } from "./dashboardUtils";
import { analyticsService } from "../../services/analyticsService";

type TimeFilter = "month" | "quarter" | "year";

const revenueData: Record<TimeFilter, { label: string; value: number }[]> = {
  month: [],
  quarter: [],
  year: [],
};

const courseData: Record<TimeFilter, { label: string; value: number; color: string; display: string }[]> = {
  month: [],
  quarter: [],
  year: [],
};

export function RevenueAnalysisPanel() {
  const [filter, setFilter] = useState<TimeFilter>("month");

  const [isLoading, setIsLoading] = useState(true);
  const [realRevenueData, setRealRevenueData] = useState<{ label: string; value: number }[]>([]);
  const [realCourseData, setRealCourseData] = useState<{ label: string; value: number; color: string; display: string }[]>([]);
  const [currentTotal, setCurrentTotal] = useState(0);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const to = new Date();
        const from = new Date();
        let granularity: "day" | "week" | "month" = "day";
        
        if (filter === "month") {
          from.setDate(to.getDate() - 30);
          granularity = "day";
        } else if (filter === "quarter") {
          from.setDate(to.getDate() - 90);
          granularity = "week";
        } else if (filter === "year") {
          from.setDate(to.getDate() - 365);
          granularity = "month";
        }

        const data = await analyticsService.getRevenue({
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          granularity
        });

        if (isMounted) {
          setRealRevenueData(data.series.map(s => ({ label: s.bucket, value: s.amount })));
          setCurrentTotal(data.total);
          
          // Mock course breakdown temporarily as backend analytics doesn't support tuition by course yet
          setRealCourseData(courseData[filter]);
        }
      } catch (error) {
        console.error("Error fetching revenue data", error);
        if (isMounted) {
          setRealRevenueData(revenueData[filter]);
          setCurrentTotal(revenueData[filter].reduce((acc, curr) => acc + curr.value, 0));
          setRealCourseData(courseData[filter]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [filter]);

  return (
    <div className="space-y-6 pb-10">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-4 border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Phân tích Doanh thu</h3>
            <p className="text-xs text-slate-500">Xem chi tiết doanh thu theo thời gian và dịch vụ</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter("month")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === "month" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Theo Tháng
          </button>
          <button
            onClick={() => setFilter("quarter")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === "quarter" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Theo Quý
          </button>
          <button
            onClick={() => setFilter("year")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === "year" ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Theo Năm
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-500" />
                Biểu đồ Doanh thu
              </h3>
              <p className="text-2xl font-black text-slate-900 mt-2">{formatDashboardCurrency(currentTotal, 1, false)}</p>
            </div>
            <div className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {filter === "month" ? "Tháng này" : filter === "quarter" ? "Quý này" : "Năm nay"}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 min-h-[200px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <BarChart data={realRevenueData} />
            )}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-indigo-500" />
              Cơ cấu Khóa học
            </h3>
            <p className="text-xs text-slate-500 mt-1">Tỷ trọng doanh thu theo từng chương trình</p>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <DonutCard
                compact
                centerLabel="Tổng"
                centerValue="100%"
                segments={realCourseData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
