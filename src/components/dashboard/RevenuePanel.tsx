import React from "react";
import { CheckCircle, DollarSign, PackageCheck, Wallet } from "lucide-react";
import { formatDashboardCurrency } from "./dashboardUtils";
import { MetricCard, DonutCard, BarChart, WorkloadChart } from "./DashboardWidgets";

export function RevenuePanel({
  totalRevenue,
  growthRate,
  prevRevenueShort,
  avgOrderValue,
  orderCount,
  trendData,
  productSegments,
  totalProductsSold,
}: {
  totalRevenue: number;
  growthRate: number;
  prevRevenueShort: string;
  avgOrderValue: number;
  orderCount: number;
  trendData: Array<{ label: string; value: number }>;
  productSegments: Array<{ label: string; value: number; color: string }>;
  totalProductsSold: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={DollarSign}
          label="Tổng doanh thu"
          value={formatDashboardCurrency(totalRevenue, 1, false)}
          delta={`${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`}
          tone="emerald"
        />
        <MetricCard
          icon={CheckCircle}
          label="Đơn hàng hoàn thành"
          value={orderCount.toLocaleString("vi-VN")}
          delta={`Kỳ trước: ${prevRevenueShort}`}
          tone="blue"
        />
        <MetricCard
          icon={Wallet}
          label="Giá trị đơn trung bình"
          value={formatDashboardCurrency(avgOrderValue, 1, false)}
          delta="Đơn hoàn thành"
          tone="amber"
        />
        <MetricCard
          icon={PackageCheck}
          label="Sản phẩm đã bán"
          value={totalProductsSold.toLocaleString("vi-VN")}
          delta="Tổng số lượng"
          tone="indigo"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Doanh thu xuất kho</h3>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-600">Đơn vị: VNĐ</span>
          </div>
          <BarChart data={trendData} />
        </div>

        <DonutCard
          title="Cơ cấu nguồn"
          centerLabel="Sản phẩm đã bán"
          centerValue={totalProductsSold.toLocaleString("vi-VN")}
          segments={productSegments}
        />
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="mb-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Tần suất làm việc trong tuần</h3>
        </div>
        <WorkloadChart />
      </div>
    </div>
  );
}
