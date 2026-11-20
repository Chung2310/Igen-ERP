import React from "react";
import { Package, Layers, AlertTriangle, Clock, Wallet } from "lucide-react";
import type { SupplyStats } from "../../types/supply";

interface Props {
  stats: SupplyStats;
}

export const SupplyStatsCards: React.FC<Props> = ({ stats }) => {
  const cards = [
    { label: "Tổng loại vật tư", value: stats.totalItems.toLocaleString("vi-VN"), icon: Package, tone: "text-primary" },
    { label: "Tổng số lượng tồn", value: stats.totalQuantity.toLocaleString("vi-VN"), icon: Layers, tone: "text-primary" },
    { label: "Tổng giá trị tồn kho", value: `${(stats.totalValue ?? 0).toLocaleString("vi-VN")} ₫`, icon: Wallet, tone: "text-primary" },
    { label: "Sắp hết hàng", value: (stats.lowStockCount + stats.outOfStockCount).toLocaleString("vi-VN"), icon: AlertTriangle, tone: "text-amber-600" },
    { label: "Đã hết hạn", value: stats.expiredCount.toLocaleString("vi-VN"), icon: Clock, tone: "text-rose-600" },
    { label: "Cận hạn (< 30 ngày)", value: stats.expiringSoonCount.toLocaleString("vi-VN"), icon: Clock, tone: "text-blue-600" },
  ];

  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
    {cards.map(({ label, value, icon: Icon, tone }) => <div key={label}
      className="min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2 text-on-surface-variant">
        <span className="text-xs font-medium">{label}</span>
        <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
      </div>
      <p className="mt-2 break-words text-xl font-semibold tabular-nums text-on-surface">{value}</p>
    </div>)}
  </div>;
};
