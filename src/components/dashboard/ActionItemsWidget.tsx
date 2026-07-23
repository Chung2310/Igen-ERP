import { AlertTriangle, CheckCircle2, ClipboardList, PackageCheck } from "lucide-react";
import { DashboardActionItems } from "../../types/dashboard";

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
      <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="h-5 w-5" />
        Không có việc gì cần xử lý gấp hôm nay. 🎉
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-800">
        <ClipboardList className="h-4 w-4 text-blue-600" />
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
    </div>
  );
}
