import { AlertTriangle, CheckCircle2, ClipboardList, PackageCheck } from "lucide-react";
import { DashboardActionItems } from "../../types/dashboard";
import { OverviewComparisonChart } from "./OverviewCharts";
import { DASHBOARD_CHART_PALETTE } from "./dashboardPalette";

function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("vi-VN");
}

export function ActionItemsWidget({
  actionItems,
  onGoToTasks,
  onGoToApprovals,
  onGoToInventory,
}: {
  actionItems: DashboardActionItems | null;
  onGoToTasks: () => void;
  onGoToApprovals: () => void;
  onGoToInventory: () => void;
}) {
  if (!actionItems) return null;

  const { overdueTasks, pendingApprovals, lowStockAlerts } = actionItems;
  const totalCount = overdueTasks.length + pendingApprovals.length + lowStockAlerts.length;

  if (totalCount === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#B5E8FF] bg-[#E8F7FF] p-4 text-sm font-semibold text-[#007EB8]">
        <CheckCircle2 className="h-5 w-5" />
        Không có việc gì cần xử lý gấp hôm nay. 🎉
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-800">
        <ClipboardList className="h-4 w-4 text-[#00ADFC]" />
        Việc cần xử lý hôm nay
      </h3>

      <div className="space-y-2">
        {overdueTasks.length > 0 && (
          <button
            type="button"
            onClick={onGoToTasks}
            className="flex w-full items-center justify-between rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2.5 text-left transition hover:bg-rose-50"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {overdueTasks.length} task quá hạn giao cho bạn
            </span>
            <span className="truncate pl-2 text-xs text-rose-500">{overdueTasks[0].title}</span>
          </button>
        )}

        {pendingApprovals.length > 0 && (
          <button
            type="button"
            onClick={onGoToApprovals}
            className="flex w-full items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-left transition hover:bg-amber-50"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-amber-700">
              <ClipboardList className="h-4 w-4 shrink-0" />
              {pendingApprovals.length} phiếu chờ duyệt
            </span>
            <span className="truncate pl-2 text-xs text-amber-600">
              {pendingApprovals[0].employeeName} · {formatRelativeDate(pendingApprovals[0].since)}
            </span>
          </button>
        )}

        {lowStockAlerts.length > 0 && (
          <button
            type="button"
            onClick={onGoToInventory}
            className="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-left transition hover:bg-blue-50"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <PackageCheck className="h-4 w-4 shrink-0" />
              {lowStockAlerts.length} sản phẩm sắp hết hàng
            </span>
            <span className="truncate pl-2 text-xs text-blue-600">{lowStockAlerts[0].name}</span>
          </button>
        )}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <OverviewComparisonChart
          title="Việc cần xử lý theo loại"
          items={[
            { label: "Công việc quá hạn", value: overdueTasks.length, color: DASHBOARD_CHART_PALETTE[0] },
            { label: "Phiếu chờ duyệt", value: pendingApprovals.length, color: DASHBOARD_CHART_PALETTE[1] },
            { label: "Hàng sắp hết", value: lowStockAlerts.length, color: DASHBOARD_CHART_PALETTE[2] },
          ]}
        />
      </div>
    </div>
  );
}
