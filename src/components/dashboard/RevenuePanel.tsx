import React from "react";
import { AlertTriangle, CheckCircle, CreditCard, DollarSign, GraduationCap, PackageCheck, Users, Wallet } from "lucide-react";
import { formatDashboardCurrency } from "./dashboardUtils";
import { MetricCard, DonutCard, BarChart, WorkloadChart } from "./DashboardWidgets";
import { useEntityLabel } from "../../modules/student-management/hooks/useEntityLabel";

export function RevenuePanel({
  canSeeInventory,
  canSeeStudent,
  totalRevenue,
  growthRate,
  prevRevenueShort,
  avgOrderValue,
  orderCount,
  trendData,
  productSegments,
  totalProductsSold,
  tuitionRevenue,
  tuitionPaymentCount,
  outstandingDebt,
  totalStudents,
}: {
  canSeeInventory: boolean;
  canSeeStudent: boolean;
  totalRevenue: number;
  growthRate: number;
  prevRevenueShort: string;
  avgOrderValue: number;
  orderCount: number;
  trendData: Array<{ label: string; value: number }>;
  productSegments: Array<{ label: string; value: number; color: string }>;
  totalProductsSold: number;
  tuitionRevenue: number;
  tuitionPaymentCount: number;
  outstandingDebt: number;
  totalStudents: number;
}) {
  const { titleCase: studentEntityTitle, singular: studentEntitySingular } = useEntityLabel();

  return (
    <div className="space-y-6">
      {canSeeInventory && (
        <section className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Doanh thu bán hàng</h2>
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
        </section>
      )}

      {canSeeStudent && (
        <section className="space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Doanh thu học phí {studentEntitySingular}
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={GraduationCap}
              label="Doanh thu học phí"
              value={formatDashboardCurrency(tuitionRevenue, 1, false)}
              delta={`Từ ${studentEntitySingular}`}
              tone="emerald"
            />
            <MetricCard
              icon={CreditCard}
              label="Số lượt thanh toán"
              value={tuitionPaymentCount.toLocaleString("vi-VN")}
              delta="Trong kỳ"
              tone="blue"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Công nợ chưa thu"
              value={formatDashboardCurrency(outstandingDebt, 1, false)}
              delta="Cần thu hồi"
              tone="amber"
            />
            <MetricCard
              icon={Users}
              label={`Tổng ${studentEntitySingular}`}
              value={totalStudents.toLocaleString("vi-VN")}
              delta={`Xem chi tiết ở ${studentEntityTitle}`}
              tone="indigo"
            />
          </div>
        </section>
      )}

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="mb-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">Tần suất làm việc trong tuần</h3>
        </div>
        <WorkloadChart />
      </div>
    </div>
  );
}
